const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClaudeCodeAdapter } = require('../src/adapters/claudeCode');

const FIXTURES = path.join(__dirname, 'fixtures', 'claude');

// Copy a fixture tree to a temp dir so tests can append without touching the repo.
function fixtureCopy(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-claude-'));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

const byId = (result) => Object.fromEntries(result.sessions.map((s) => [s.id, s]));

test('identifies itself', () => {
  const a = createClaudeCodeAdapter(fixtureCopy('basic'));
  assert.equal(a.tool, 'claude-code');
  assert.equal(a.label, 'Claude Code');
});

test('dedupes repeated message.id', () => {
  const root = fixtureCopy('basic');
  fs.rmSync(path.join(root, 'proj', 's1'), { recursive: true }); // main file only; m1 appears twice in it
  const r = createClaudeCodeAdapter(root).scan();
  assert.deepEqual(byId(r)['claude-code:s1'].usage, { input: 11, output: 22, cacheRead: 100, cacheWrite: 5 });
});

test('dedupes across files', () => {
  // the subagent file repeats m1 from the main file; with it present the total must not change
  const r = createClaudeCodeAdapter(fixtureCopy('basic')).scan();
  assert.deepEqual(byId(r)['claude-code:s1'].usage, { input: 11, output: 22, cacheRead: 100, cacheWrite: 5 });
});

test('groups by sessionId', () => {
  const r = createClaudeCodeAdapter(fixtureCopy('basic')).scan();
  assert.equal(r.status, 'measured');
  assert.deepEqual(r.sessions.map((s) => s.id).sort(), ['claude-code:s1', 'claude-code:s2']);
  assert.deepEqual(byId(r)['claude-code:s2'].usage, { input: 3, output: 4, cacheRead: 50, cacheWrite: 7 });
});

test('takes timestamps from the lines', () => {
  const s = byId(createClaudeCodeAdapter(fixtureCopy('basic')).scan())['claude-code:s1'];
  assert.equal(s.startedAt, Date.parse('2026-11-02T10:00:05.000Z'));
  assert.equal(s.lastActiveAt, Date.parse('2026-11-02T10:01:00.000Z'));
});

test('skips malformed lines', () => {
  const r = createClaudeCodeAdapter(fixtureCopy('malformed')).scan();
  assert.equal(r.status, 'measured');
  assert.deepEqual(byId(r)['claude-code:s3'].usage, { input: 3, output: 3, cacheRead: 3, cacheWrite: 3 });
});

test('missing root is measured with no sessions', () => {
  const r = createClaudeCodeAdapter(path.join(os.tmpdir(), 'fw-no-such-root')).scan();
  assert.deepEqual(r, { status: 'measured', sessions: [] });
});

test('unrecognisable format is not-measured', () => {
  const r = createClaudeCodeAdapter(fixtureCopy('unrecognised')).scan();
  assert.equal(r.status, 'not-measured');
});

test('second scan adds only new usage', () => {
  const root = fixtureCopy('basic');
  const a = createClaudeCodeAdapter(root);
  a.scan();
  const line =
    '{"sessionId":"s2","timestamp":"2026-11-02T11:05:00.000Z","message":{"id":"m11","usage":' +
    '{"input_tokens":1,"output_tokens":2,"cache_read_input_tokens":3,"cache_creation_input_tokens":4}}}\n';
  fs.appendFileSync(path.join(root, 'proj', 's2.jsonl'), line);
  const r = a.scan();
  assert.deepEqual(byId(r)['claude-code:s2'].usage, { input: 4, output: 6, cacheRead: 53, cacheWrite: 11 });
  assert.deepEqual(byId(r)['claude-code:s1'].usage, { input: 11, output: 22, cacheRead: 100, cacheWrite: 5 });
});
