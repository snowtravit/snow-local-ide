const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { before, after, afterEach, test } = require('node:test');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-ide-files-test-'));
process.env.PROJECTS_DIR = path.join(directory, 'projects');
const app = require('../dist/app').default;
const { FileService } = require('../dist/services/FileService');
const originals = { writeFile: FileService.writeFile, deleteFile: FileService.deleteFile, deleteProject: FileService.deleteProject };
let server, baseURL;
before(async () => {
  FileService.init();
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  baseURL = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});
afterEach(() => Object.assign(FileService, originals));
async function request(endpoint, body, method = 'POST') {
  const response = await fetch(`${baseURL}${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
async function project(languages = []) {
  const created = await request('/projects', { name: 'Files test', description: 'Original', languages });
  assert.equal(created.status, 201);
  return created.body.data;
}
async function createFile(id, name = 'main.js', content = 'original') {
  const response = await request(`/files/${id}`, { name, path: name, content, language: 'javascript' });
  assert.equal(response.status, 201);
  return response.body.data;
}
async function files(id) { return (await request(`/files/${id}`, undefined, 'GET')).body.data; }

test('invalid create paths and non-string content do not alter file records or the filesystem', async () => {
  const p = await project();
  for (const filePath of ['../escape.js', '/absolute.js', 'C:\\escape.js', 'nested//file.js']) {
    const response = await request(`/files/${p.id}`, { name: 'file.js', path: filePath, content: 'escape', language: 'javascript' });
    assert.equal(response.status, 400, filePath);
  }
  assert.equal((await request(`/files/${p.id}`, { name: 'main.js', path: 'main.js', content: {}, language: 'javascript' })).status, 400);
  assert.deepEqual(await files(p.id), []);
  assert.equal(fs.existsSync(path.join(process.env.PROJECTS_DIR, 'escape.js')), false);
});
test('duplicate paths are rejected without overwriting existing content', async () => {
  const p = await project();
  await createFile(p.id);
  const duplicate = await request(`/files/${p.id}`, { name: 'main.js', path: 'main.js', content: 'changed', language: 'javascript' });
  assert.equal(duplicate.status, 409);
  assert.equal(FileService.readFile(p.id, 'main.js'), 'original');
  assert.equal((await files(p.id)).length, 1);
});
test('a failed create write leaves no phantom stored file', async () => {
  const p = await project();
  FileService.writeFile = () => { throw new Error('Disk unavailable'); };
  const response = await request(`/files/${p.id}`, { name: 'main.js', path: 'main.js', content: 'new', language: 'javascript' });
  assert.equal(response.status, 500);
  assert.deepEqual(await files(p.id), []);
});
test('a failed update write keeps the previous stored and disk contents', async () => {
  const p = await project();
  const file = await createFile(p.id);
  FileService.writeFile = () => { throw new Error('Disk unavailable'); };
  const response = await request(`/files/${p.id}/${file.id}`, { content: 'changed' }, 'PUT');
  assert.equal(response.status, 500);
  assert.equal((await files(p.id))[0].content, 'original');
  assert.equal(FileService.readFile(p.id, file.path), 'original');
});
test('rename changes both disk and metadata, preserving the original nested directory', async () => {
  const p = await project();
  const file = await createFile(p.id, 'src/original.js');
  const response = await request(`/files/${p.id}/${file.id}`, { name: 'renamed.js', content: 'renamed contents' }, 'PUT');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.path, 'src/renamed.js');
  assert.equal(FileService.exists(p.id, 'src/original.js'), false);
  assert.equal(FileService.readFile(p.id, 'src/renamed.js'), 'renamed contents');
});
test('rename conflicts and failed rename-save retain the original file', async () => {
  const p = await project();
  const file = await createFile(p.id);
  await createFile(p.id, 'other.js', 'other');
  assert.equal((await request(`/files/${p.id}/${file.id}`, { name: 'other.js' }, 'PUT')).status, 409);
  FileService.writeFile = () => { throw new Error('Disk unavailable'); };
  assert.equal((await request(`/files/${p.id}/${file.id}`, { name: 'renamed.js', content: 'changed' }, 'PUT')).status, 500);
  assert.equal((await files(p.id)).find((entry) => entry.id === file.id).path, 'main.js');
  assert.equal(FileService.exists(p.id, 'renamed.js'), false);
  assert.equal(FileService.readFile(p.id, 'main.js'), 'original');
});
test('project file paths cannot follow a symlink outside the project', async () => {
  const p = await project();
  const outside = path.join(directory, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'sentinel.js'), 'outside');
  fs.symlinkSync(outside, path.join(FileService.getProjectPath(p.id), 'linked'), 'dir');
  const response = await request(`/files/${p.id}`, { name: 'sentinel.js', path: 'linked/sentinel.js', content: 'changed', language: 'javascript' });
  assert.equal(response.status, 400);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.js'), 'utf8'), 'outside');
  assert.deepEqual(await files(p.id), []);
});
test('failed deletions retain their file and project metadata', async () => {
  const p = await project();
  const file = await createFile(p.id);
  FileService.deleteFile = () => { throw new Error('Disk unavailable'); };
  assert.equal((await request(`/files/${p.id}/${file.id}`, undefined, 'DELETE')).status, 500);
  assert.equal((await files(p.id)).length, 1);
  FileService.deleteProject = () => { throw new Error('Disk unavailable'); };
  assert.equal((await request(`/projects/${p.id}`, undefined, 'DELETE')).status, 500);
  assert.equal((await request(`/projects/${p.id}`, undefined, 'GET')).status, 200);
});
test('partial project updates preserve omitted fields and reject malformed languages', async () => {
  const p = await project(['javascript']);
  const updated = await request(`/projects/${p.id}`, { description: 'Updated' }, 'PUT');
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.name, p.name);
  assert.deepEqual(updated.body.data.languages, ['javascript']);
  assert.equal(updated.body.data.description, 'Updated');
  assert.equal((await request(`/projects/${p.id}`, { languages: 'javascript' }, 'PUT')).status, 400);
});
test('failed default-file creation rolls back the newly created project', async () => {
  const before = (await request('/projects', undefined, 'GET')).body.data.length;
  FileService.writeFile = () => { throw new Error('Disk unavailable'); };
  assert.equal((await request('/projects', { name: 'Failure', languages: ['javascript'] })).status, 500);
  assert.equal((await request('/projects', undefined, 'GET')).body.data.length, before);
});
