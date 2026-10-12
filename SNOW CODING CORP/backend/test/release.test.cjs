const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { before, after, test } = require('node:test');

const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-release-projects-'));
process.env.PROJECTS_DIR = projects;
const app = require('../dist/app').default;
const frontendDir = path.resolve(__dirname, '../../frontend/dist');
const createdDirectory = !fs.existsSync(frontendDir);
const filename = `release-${randomUUID()}.txt`;
let server, baseURL;

before(async () => {
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, filename), 'Built editor asset');
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.unlinkSync(path.join(frontendDir, filename));
  if (createdDirectory && fs.readdirSync(frontendDir).length === 0) fs.rmdirSync(frontendDir);
  fs.rmSync(projects, { recursive: true, force: true });
});

test('the release backend serves built editor files and retains its health API', async () => {
  const asset = await fetch(`${baseURL}/${filename}`);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), 'Built editor asset');
  const health = await fetch(`${baseURL}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
});

test('the built editor origin can create a project through the API', async () => {
  const response = await fetch(`${baseURL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4000' },
    body: JSON.stringify({ name: 'Release project' }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4000');
  assert.equal((await response.json()).data.name, 'Release project');
});
