const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { LocalExecutionService } = require('../dist/services/LocalExecutionService');
const { LANGUAGES } = require('../dist/config/languages');
const js = LANGUAGES.javascript;
const file = (content) => [{ name: 'main.js', content }];

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return !fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ')[2].includes('Z');
  } catch { return false; }
}

test('local timeout kills both the shell and its program descendants', async () => {
  const result = await LocalExecutionService.executeCode({ ...js, timeout: 250 }, file(
    'const {spawn}=require("child_process");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});console.log(child.pid);setInterval(()=>{},1000);'
  ));
  assert.equal(result.status, 'timeout');
  assert.equal(result.exitCode, 124);
  assert.match(result.output, /timed out/);
  const childPID = Number(result.output.split('\n')[0]);
  assert.ok(Number.isInteger(childPID) && childPID > 0);
  assert.equal(isRunning(childPID), false);
  assert.ok(result.executionTime < 2000);
});

test('Stop kills an active local execution and reports a stopped error', async () => {
  const id = randomUUID();
  const execution = LocalExecutionService.executeCode(js,
    file('console.log("Started");setInterval(()=>{},1000);'), undefined, id);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(await LocalExecutionService.stopExecution(id), true);
  const result = await execution;
  assert.equal(result.status, 'error');
  assert.equal(result.exitCode, 137);
  assert.match(result.output, /Execution stopped/);
  assert.equal(await LocalExecutionService.stopExecution(id), false);
});

test('local output overflow stops the program without misreporting a timeout', async () => {
  const result = await LocalExecutionService.executeCode(js,
    file('while(true)process.stdout.write("x".repeat(16384));'));
  assert.equal(result.status, 'error');
  assert.match(result.output, /Output exceeded 100 KiB/);
  assert.ok(Buffer.byteLength(result.output) < 102500);
  assert.ok(result.executionTime < 2000);
});

test('local stdin reaches EOF and timeout cleanup removes the working directory', async () => {
  const result = await LocalExecutionService.executeCode(js,
    file('console.log(process.cwd());console.log(require("fs").readFileSync(0,"utf8"));'), 'Привет');
  assert.equal(result.status, 'success');
  assert.match(result.output, /Привет/);
  assert.equal(fs.existsSync(result.output.split('\n')[0]), false);
});

test('local JavaScript preserves a nested renamed entry and its relative imports', async () => {
  const result = await LocalExecutionService.executeCode(js, [
    { name: 'src/entry with space.js', content: 'console.log(require("./helper.js"));console.log(__filename);' },
    { name: 'src/helper.js', content: 'module.exports="Nested import OK";' },
  ]);
  assert.equal(result.status, 'success', result.output);
  assert.match(result.output, /Nested import OK/);
  assert.match(result.output, /src\/entry with space\.js/);
});

test('local Python preserves a nested renamed entry and imports from its directory', async () => {
  const result = await LocalExecutionService.executeCode(LANGUAGES.python, [
    { name: 'src/entry with space.py', content: 'import helper\nprint(helper.value)\nprint(__file__)' },
    { name: 'src/helper.py', content: 'value="Nested import OK"' },
  ]);
  assert.ok(result, 'Python is required for this regression');
  assert.equal(result.status, 'success', result.output);
  assert.match(result.output, /Nested import OK/);
  assert.match(result.output, /src\/entry with space\.py/);
});
