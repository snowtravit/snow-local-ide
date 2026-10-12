const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { before, after, test } = require('node:test');
const Dockerode = require('dockerode');
const app = require('../dist/app').default;
const { DockerService } = require('../dist/services/DockerService');
const { LANGUAGES } = require('../dist/config/languages');
const docker = new Dockerode({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
const js = LANGUAGES.javascript;
let server;
let baseURL;
before(async () => {
  assert.equal(await DockerService.isAvailable(), true, 'Start Docker and build all language images first');
  for (const language of Object.values(LANGUAGES)) await docker.getImage(language.image).inspect();
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
const files = (content, name = 'main.js') => [{ name, content }];
async function execute(content, { stdin, name = 'main.js', language = js, id = randomUUID() } = {}) {
  const result = await DockerService.executeCode(language, files(content, name), id, stdin);
  await assert.rejects(docker.getContainer(`ide-exec-${id}`).inspect(), (error) => error.statusCode === 404);
  return result;
}
async function request(endpoint, body, signal) {
  const response = await fetch(`${baseURL}/api/execute${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function waitFor(predicate, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('Timed out waiting for container state');
}
async function isRunning(id) {
  try { return (await docker.getContainer(`ide-exec-${id}`).inspect()).State.Running; }
  catch (error) { if (error.statusCode === 404) return false; throw error; }
}

// Run sequentially: Docker's vfs driver copies an entire image per execution.
for (const [id, language] of Object.entries(LANGUAGES)) {
  test(`Docker ${id} runs its default program from a renamed editor file`, { timeout: 300000 }, async () => {
    const result = await execute(language.defaultCode, { language, name: `renamed${language.extension}` });
    assert.equal(result.status, 'success', JSON.stringify(result));
    assert.equal(result.exitCode, 0);
    assert.match(result.output, /Hello, World!/);
  });
}

test('Docker Python includes its bundled scientific and HTTP libraries', { timeout: 180000 }, async () => {
  const result = await execute('import numpy, pandas, requests\nprint("Imports OK")', { language: LANGUAGES.python, name: 'main.py' });
  assert.equal(result.output, 'Imports OK');
  assert.equal(result.status, 'success');
});
test('Docker stdin and empty input both reach EOF', async () => {
  const content = 'console.log(JSON.stringify(require("fs").readFileSync(0,"utf8")));';
  const supplied = await execute(content, { stdin: 'Привет' });
  assert.equal(supplied.output, '"Привет\\n"');
  const empty = await execute(content);
  assert.equal(empty.output, '""');
});
test('Docker output joins fragmented Unicode and captures stderr', async () => {
  const result = await execute('const b=Buffer.from("Привет 🌨");process.stdout.write(b.subarray(0,1));setTimeout(()=>{process.stdout.write(b.subarray(1));setTimeout(()=>console.error("stderr"),30);},30);');
  assert.equal(result.status, 'success');
  assert.equal(result.output, 'Привет 🌨stderr');
});
test('Docker timeout keeps partial output and removes its container', async () => {
  const result = await execute('process.stdout.write("Before timeout");setInterval(()=>{},1000);', { language: { ...js, timeout: 400 } });
  assert.equal(result.status, 'timeout');
  assert.equal(result.exitCode, 124);
  assert.match(result.output, /Before timeout/);
  assert.match(result.output, /timed out/);
});
test('Docker output overflow stops execution and bounds captured output', async () => {
  const result = await execute('while(true)process.stdout.write("x".repeat(16384));');
  assert.equal(result.status, 'error');
  assert.match(result.output, /Output exceeded 100 KiB/);
  assert.ok(Buffer.byteLength(result.output) < 102500);
});
test('Docker syntax errors and missing images clean up without local fallback', async () => {
  const syntax = await execute('function {');
  assert.equal(syntax.status, 'error');
  assert.match(syntax.output, /SyntaxError/);
  const missing = await execute('console.log("Never")', { language: { ...js, image: 'snow-ide-missing-integration-image' } });
  assert.equal(missing.status, 'error');
  assert.match(missing.output, /No such image/);
});
test('Docker execution preserves writable nested files and cannot see a host file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-host-check-'));
  const hostFile = path.join(directory, 'host-only.txt');
  await fs.writeFile(hostFile, 'host secret sentinel');
  const id = randomUUID();
  try {
    const result = await DockerService.executeCode(js, [
      { name: 'main.js', content: `const fs=require('fs');fs.writeFileSync('/code/nested/new.txt','written');console.log(fs.readFileSync('/code/nested/пример.txt','utf8'));console.log(fs.readFileSync('/code/nested/new.txt','utf8'));console.log(fs.existsSync(${JSON.stringify(hostFile)}));console.log(process.getuid());console.log(process.env.GITHUB_TOKEN===undefined);` },
      { name: 'nested/пример.txt', content: 'Привет' },
    ], id);
    assert.equal(result.status, 'success', result.output);
    assert.equal(result.output, 'Привет\nwritten\nfalse\n65534\ntrue');
    await assert.rejects(docker.getContainer(`ide-exec-${id}`).inspect(), (error) => error.statusCode === 404);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('Docker Stop terminates the requested execution and keeps container isolation limits', async () => {
  const id = randomUUID();
  const pending = request('', { language: 'javascript', files: files('setInterval(()=>{},1000);'), executionId: id });
  await waitFor(() => isRunning(id));
  const inspect = await docker.getContainer(`ide-exec-${id}`).inspect();
  assert.equal(inspect.HostConfig.NetworkMode, 'none');
  assert.equal(inspect.HostConfig.Memory, 256 * 1024 * 1024);
  assert.equal(inspect.HostConfig.PidsLimit, 100);
  assert.deepEqual(inspect.HostConfig.CapDrop, ['ALL']);
  assert.equal(inspect.Config.User, 'nobody');
  const stopped = await request('/stop', { executionId: id });
  assert.equal(stopped.stopped, true);
  const result = await pending;
  assert.equal(result.data.exitCode, 137);
  assert.equal(result.data.status, 'error');
  await assert.rejects(docker.getContainer(`ide-exec-${id}`).inspect(), (error) => error.statusCode === 404);
});
test('closing the HTTP execute request stops Docker and cleans up', async () => {
  const id = randomUUID();
  const controller = new AbortController();
  const pending = request('', { language: 'javascript', files: files('setInterval(()=>{},1000);'), executionId: id }, controller.signal);
  await waitFor(() => isRunning(id));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await waitFor(async () => {
    try { await docker.getContainer(`ide-exec-${id}`).inspect(); return false; }
    catch (error) { return error.statusCode === 404; }
  });
});

test('Docker nested JavaScript preserves the actual entry path and relative imports', async () => {
  const result = await DockerService.executeCode(js, [
    { name: 'src/entry with space.js', content: 'console.log(require("./helper.js"));console.log(__filename);' },
    { name: 'src/helper.js', content: 'module.exports="Nested import OK";' },
  ]);
  assert.equal(result.status, 'success', result.output);
  assert.equal(result.output, 'Nested import OK\n/code/src/entry with space.js');
});
test('Docker nested Python preserves __file__ and imports from its directory', { timeout: 180000 }, async () => {
  const result = await DockerService.executeCode(LANGUAGES.python, [
    { name: 'src/entry with space.py', content: 'import helper\nprint(helper.value)\nprint(__file__)' },
    { name: 'src/helper.py', content: 'value="Nested import OK"' },
  ]);
  assert.equal(result.status, 'success', result.output);
  assert.equal(result.output, 'Nested import OK\n/code/src/entry with space.py');
});


test('Docker interleaved stdout and stderr decode fragmented Unicode independently', async () => {
  const result = await execute('const b=Buffer.from("🌨");process.stdout.write(b.subarray(0,2));setTimeout(()=>{process.stderr.write("stderr\\n");setTimeout(()=>process.stdout.write(b.subarray(2)),30);},30);');
  assert.equal(result.status, 'success');
  assert.equal(result.output, 'stderr\n🌨');
  assert.equal(result.output.includes('�'), false);
});

test('Docker Java compiles and runs a declared package with a renamed source file', { timeout: 180000 }, async () => {
  const result = await execute('package demo; public class Example { public static void main(String[] args) { System.out.println("Package OK"); } }', { language: LANGUAGES.java, name: 'renamed.java' });
  assert.equal(result.status, 'success', result.output);
  assert.equal(result.output, 'Package OK');
});
