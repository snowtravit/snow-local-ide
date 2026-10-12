const assert = require('node:assert/strict');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const app = require('../dist/app').default;
const { DockerService } = require('../dist/services/DockerService');
const { LocalExecutionService } = require('../dist/services/LocalExecutionService');

const original = {
  dockerAvailable: DockerService.isAvailable,
  dockerExecute: DockerService.executeCode,
  localExecute: LocalExecutionService.executeCode,
  localRuntimes: LocalExecutionService.getAvailableRuntimes,
  mode: process.env.EXECUTION_MODE,
};
const success = { output: 'Hello', exitCode: 0, executionTime: 1, status: 'success' };
const payload = { language: 'python', files: [{ name: 'main.py', content: 'print("Hello")' }] };
let server;
let baseURL;
let calls;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  delete process.env.EXECUTION_MODE;
  calls = { dockerAvailable: 0, dockerExecute: 0, localExecute: 0, localRuntimes: 0 };
  DockerService.isAvailable = async () => {
    calls.dockerAvailable++;
    return true;
  };
  DockerService.executeCode = async () => {
    calls.dockerExecute++;
    return { ...success };
  };
  LocalExecutionService.executeCode = async () => {
    calls.localExecute++;
    return { ...success };
  };
  LocalExecutionService.getAvailableRuntimes = async () => {
    calls.localRuntimes++;
    return { python: true };
  };
});

afterEach(() => {
  DockerService.isAvailable = original.dockerAvailable;
  DockerService.executeCode = original.dockerExecute;
  LocalExecutionService.executeCode = original.localExecute;
  LocalExecutionService.getAvailableRuntimes = original.localRuntimes;
  if (original.mode === undefined) delete process.env.EXECUTION_MODE;
  else process.env.EXECUTION_MODE = original.mode;
});

async function request(body = payload, endpoint = '/api/execute', origin) {
  const response = await fetch(`${baseURL}${endpoint}`, {
    method: body === null ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

test('default mode refuses execution when Docker is unavailable without trying local runtimes', async () => {
  DockerService.isAvailable = async () => false;
  const response = await request();
  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.mode, 'docker');
  assert.match(response.body.error, /Start Docker/);
  assert.match(response.body.error, /Code was not executed/);
  assert.equal(calls.localExecute, 0);
  assert.equal(calls.localRuntimes, 0);
  assert.equal(calls.dockerExecute, 0);
});

test('default mode executes only in Docker and returns the actual mode', async () => {
  let received;
  DockerService.executeCode = async (...args) => {
    received = args;
    return { ...success };
  };
  const response = await request({ ...payload, stdin: 'input' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.mode, 'docker');
  assert.equal(response.body.data.status, 'success');
  assert.equal(received[0].id, 'python');
  assert.deepEqual(received[1], payload.files);
  assert.equal(received[3], 'input');
  assert.equal(calls.localExecute, 0);
});

test('a missing Docker image gives a build instruction and never runs locally', async () => {
  DockerService.executeCode = async () => ({ ...success, status: 'error', exitCode: 1, output: 'Execution error: No such image: snow-ide-python' });
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.body.data.mode, 'docker');
  assert.equal(response.body.data.status, 'error');
  assert.match(response.body.data.output, /Build the snow-ide-python image/);
  assert.equal(calls.localExecute, 0);
});

test('Docker service exceptions do not trigger local execution', async () => {
  DockerService.executeCode = async () => { throw new Error('daemon disconnected'); };
  const response = await request();
  assert.equal(response.status, 503);
  assert.match(response.body.error, /daemon disconnected/);
  assert.match(response.body.error, /No local execution was attempted/);
  assert.equal(calls.localExecute, 0);
});

test('program errors returned by Docker remain Docker results', async () => {
  DockerService.executeCode = async () => ({ ...success, status: 'error', exitCode: 2, output: 'SyntaxError' });
  const response = await request();
  assert.equal(response.body.data.output, 'SyntaxError');
  assert.equal(response.body.data.exitCode, 2);
  assert.equal(response.body.data.mode, 'docker');
  assert.equal(calls.localExecute, 0);
});

test('explicit local mode uses local execution even when Docker is available', async () => {
  process.env.EXECUTION_MODE = 'local';
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.body.data.mode, 'local');
  assert.equal(calls.localExecute, 1);
  assert.equal(calls.dockerAvailable, 0);
  assert.equal(calls.dockerExecute, 0);
});

test('an unavailable local runtime gives a clear error without switching modes', async () => {
  process.env.EXECUTION_MODE = 'local';
  LocalExecutionService.executeCode = async () => null;
  const response = await request();
  assert.equal(response.status, 503);
  assert.equal(response.body.mode, 'local');
  assert.match(response.body.error, /No local runtime available for Python/);
  assert.equal(calls.dockerExecute, 0);
});

test('Docker status remains unavailable when local mode has not been enabled', async () => {
  DockerService.isAvailable = async () => false;
  const response = await request(null, '/api/execute/status');
  assert.equal(response.body.data.mode, 'unavailable');
  assert.equal(response.body.data.configuredMode, 'docker');
  assert.deepEqual(response.body.data.localRuntimes, {});
  assert.equal(calls.localRuntimes, 0);
});

test('status reports explicit local mode despite an available Docker daemon', async () => {
  process.env.EXECUTION_MODE = 'local';
  const response = await request(null, '/api/execute/status');
  assert.equal(response.body.data.dockerAvailable, true);
  assert.equal(response.body.data.mode, 'local');
  assert.equal(response.body.data.configuredMode, 'local');
});

test('an invalid configured mode fails without executing code', async () => {
  process.env.EXECUTION_MODE = 'automatic';
  const response = await request();
  assert.equal(response.status, 500);
  assert.match(response.body.error, /EXECUTION_MODE must be docker or local/);
  assert.equal(calls.dockerExecute, 0);
  assert.equal(calls.localExecute, 0);
});

test('invalid file entries and paths are rejected before any execution', async () => {
  const invalidFiles = [
    null,
    { name: '../escape.py', content: '' },
    { name: '/absolute.py', content: '' },
    { name: 'folder/../../escape.py', content: '' },
    { name: 'C:\\escape.py', content: '' },
    { name: 'folder\\..\\escape.py', content: '' },
    { name: 'folder//main.py', content: '' },
    { name: 'main\0.py', content: '' },
    { name: '', content: '' },
    { name: 'main.py', content: 42 },
    { name: 'я'.repeat(51), content: '' },
  ];
  for (const file of invalidFiles) {
    const response = await request({ ...payload, files: [file] });
    assert.equal(response.status, 400, JSON.stringify(file));
  }
  assert.equal(calls.dockerAvailable, 0);
  assert.equal(calls.dockerExecute, 0);
  assert.equal(calls.localExecute, 0);
});

test('safe nested paths and UTF-8 content are accepted', async () => {
  const response = await request({ ...payload, files: [{ name: 'src/пример.py', content: 'print("Привет")' }] });
  assert.equal(response.status, 200);
  assert.equal(calls.dockerExecute, 1);
});

test('Docker tar entries preserve a validated UTF-8 filename', async () => {
  const Dockerode = require('dockerode');
  const { PassThrough, Readable } = require('node:stream');
  const { getLanguageById } = require('../dist/config/languages');
  const originalCreate = Dockerode.prototype.createContainer;
  let archive;
  Dockerode.prototype.createContainer = async () => ({
    putArchive: async (buffer) => { archive = buffer; },
    attach: async () => new PassThrough(),
    start: async () => {},
    wait: async () => ({ StatusCode: 0 }),
    logs: async () => Readable.from([]),
    stop: async () => {},
    remove: async () => {},
  });
  try {
    const filename = 'src/пример.py';
    const content = 'print("Привет")';
    const result = await original.dockerExecute.call(DockerService,
      { ...getLanguageById('python'), timeout: 10 }, [{ name: filename, content }]);
    assert.equal(result.status, 'success');
    assert.equal(archive.subarray(0, 100).toString('utf8').replace(/\0.*$/s, ''), 'src/');
    assert.equal(archive.subarray(156, 157).toString(), '5');
    assert.equal(archive.subarray(108, 115).toString(), '0177776');
    assert.equal(archive.subarray(512, 612).toString('utf8').replace(/\0.*$/s, ''), filename);
    assert.equal(archive.subarray(1024, 1024 + Buffer.byteLength(content)).toString('utf8'), content);
  } finally {
    Dockerode.prototype.createContainer = originalCreate;
  }
});

test('unsupported languages including prototype property names are rejected', async () => {
  for (const language of ['__proto__', 'constructor', 'unknown']) {
    const response = await request({ ...payload, language });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.dockerExecute, 0);
});

test('untrusted browser origins cannot call the execution route', async () => {
  const response = await request(payload, '/api/execute', 'https://example.com');
  assert.equal(response.status, 403);
  assert.equal(calls.dockerAvailable, 0);
  assert.equal(calls.dockerExecute, 0);
});

test('the local frontend origin is allowed', async () => {
  const response = await request(payload, '/api/execute', 'http://localhost:3000');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('explicit local mode can execute a trusted JavaScript smoke program', async () => {
  process.env.EXECUTION_MODE = 'local';
  LocalExecutionService.executeCode = original.localExecute;
  const response = await request({ language: 'javascript', files: [{ name: 'main.js', content: 'console.log("Local smoke")' }] });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.mode, 'local');
  assert.equal(response.body.data.status, 'success');
  assert.equal(response.body.data.output, 'Local smoke');
  assert.equal(calls.dockerExecute, 0);
});

test('client execution IDs are passed to the execution service', async () => {
  const id = require('node:crypto').randomUUID();
  let receivedId;
  DockerService.executeCode = async (_lang, _files, executionId) => {
    receivedId = executionId;
    return { ...success };
  };
  const response = await request({ ...payload, executionId: id });
  assert.equal(response.body.data.executionId, id);
  assert.equal(receivedId, id);
  const invalid = await request({ ...payload, executionId: '../escape' });
  assert.equal(invalid.status, 400);
});

test('Stop during a pending Docker availability check prevents code execution', async () => {
  const id = require('node:crypto').randomUUID();
  let pingEntered;
  let releasePing;
  const entered = new Promise((resolve) => { pingEntered = resolve; });
  DockerService.isAvailable = () => {
    pingEntered();
    return new Promise((resolve) => { releasePing = () => resolve(true); });
  };
  const execution = request({ ...payload, executionId: id });
  await entered;
  try {
    const stopped = await request({ executionId: id }, '/api/execute/stop');
    assert.equal(stopped.body.stopped, true);
  } finally {
    releasePing();
  }
  const response = await execution;
  assert.equal(response.body.data.exitCode, 137);
  assert.equal(response.body.data.status, 'error');
  assert.equal(calls.dockerExecute, 0);
});

test('a disconnected request during Docker availability never executes code', async () => {
  const id = require('node:crypto').randomUUID();
  let pingEntered;
  let releasePing;
  const entered = new Promise((resolve) => { pingEntered = resolve; });
  DockerService.isAvailable = () => {
    pingEntered();
    return new Promise((resolve) => { releasePing = () => resolve(true); });
  };
  const controller = new AbortController();
  const closed = new Promise((resolve) => {
    server.once('request', (_req, res) => res.once('close', resolve));
  });
  const execution = fetch(`${baseURL}/api/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, executionId: id }), signal: controller.signal,
  });
  await entered;
  controller.abort();
  await assert.rejects(execution, { name: 'AbortError' });
  // Observe the actual socket close before letting the pending ping complete.
  await closed;
  releasePing();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.dockerExecute, 0);
});

test('a duplicated in-flight execution ID is rejected without starting a second program', async () => {
  const id = require('node:crypto').randomUUID();
  let pingEntered;
  let releasePing;
  const entered = new Promise((resolve) => { pingEntered = resolve; });
  DockerService.isAvailable = () => {
    pingEntered();
    return new Promise((resolve) => { releasePing = () => resolve(true); });
  };
  const execution = request({ ...payload, executionId: id });
  await entered;
  try {
    const duplicate = await request({ ...payload, executionId: id });
    assert.equal(duplicate.status, 409);
  } finally {
    releasePing();
  }
  await execution;
  assert.equal(calls.dockerExecute, 1);
});

test('Stop while Docker start is pending cannot leave a newly started process running', async () => {
  const Dockerode = require('dockerode');
  const { PassThrough } = require('node:stream');
  const { getLanguageById } = require('../dist/config/languages');
  const originalCreate = Dockerode.prototype.createContainer;
  let enteredStart, releaseStart;
  const entered = new Promise((resolve) => { enteredStart = resolve; });
  let running = false, stops = 0, removes = 0, logs = 0;
  Dockerode.prototype.createContainer = async () => ({
    putArchive: async () => {}, attach: async () => new PassThrough(),
    start: async () => {
      enteredStart();
      await new Promise((resolve) => { releaseStart = resolve; });
      running = true;
    },
    logs: async () => { logs++; throw new Error('Should never follow logs after pending stop'); },
    stop: async () => { stops++; running = false; },
    remove: async () => { removes++; },
  });
  const id = require('node:crypto').randomUUID();
  try {
    const pending = original.dockerExecute(getLanguageById('javascript'), [{ name: 'renamed.js', content: '' }], id);
    await entered;
    assert.equal(await DockerService.stopExecution(id), true);
    releaseStart();
    const result = await pending;
    assert.equal(result.status, 'error');
    assert.equal(result.exitCode, 137);
    assert.equal(running, false);
    assert.ok(stops >= 2);
    assert.equal(removes, 1);
    assert.equal(logs, 0);
  } finally {
    releaseStart?.();
    Dockerode.prototype.createContainer = originalCreate;
  }
});

test('an abruptly closed Docker output stream reports an error and removes its container', async () => {
  const Dockerode = require('dockerode');
  const { Duplex } = require('node:stream');
  const { getLanguageById } = require('../dist/config/languages');
  const originalCreate = Dockerode.prototype.createContainer;
  const stream = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  let removes = 0;
  Dockerode.prototype.createContainer = async () => ({
    putArchive: async () => {},
    attach: async () => stream,
    start: async () => { setImmediate(() => stream.destroy()); },
    wait: async () => ({ StatusCode: 0 }),
    stop: async () => {},
    remove: async () => { removes++; },
  });
  try {
    const result = await original.dockerExecute(
      { ...getLanguageById('javascript'), timeout: 1000 },
      [{ name: 'main.js', content: '' }],
    );
    assert.equal(result.status, 'error');
    assert.equal(result.exitCode, 1);
    assert.match(result.output, /output connection closed before EOF/);
    assert.equal(removes, 1);
  } finally {
    Dockerode.prototype.createContainer = originalCreate;
    stream.destroy();
  }
});
