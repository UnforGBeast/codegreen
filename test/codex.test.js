const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCodexAdapter } = require('../src/adapters/codex');

// Sanitized event lines: usage numbers and timestamps only, no conversation text.
const ev = (ts, info) =>
  JSON.stringify({ timestamp: ts, type: 'event_msg', payload: { type: 'token_count', info } });
const usage = (input, cached, output, reasoning = 0) => ({
  total_token_usage: {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: input + output,
  },
});

function sessionsDir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-codex-'));
  for (const [name, lines] of Object.entries(files)) {
    const f = path.join(root, '2026', '11', '02', name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, lines.join('\n') + '\n');
  }
  return root;
}

const only = (r) => {
  assert.equal(r.sessions.length, 1);
  return r.sessions[0];
};

test('identifies itself', () => {
  const a = createCodexAdapter(sessionsDir({}));
  assert.equal(a.tool, 'codex');
  assert.equal(a.label, 'Codex');
});

test('takes the last cumulative value', () => {
  const root = sessionsDir({
    'rollout-a.jsonl': [
      ev('2026-11-02T10:00:00.000Z', usage(100, 0, 10)),
      ev('2026-11-02T10:01:00.000Z', usage(300, 0, 30)),
      ev('2026-11-02T10:02:00.000Z', usage(600, 0, 60)),
    ],
  });
  const s = only(createCodexAdapter(root).scan());
  assert.deepEqual(s.usage, { input: 600, output: 60, cacheRead: 0, cacheWrite: 0 });
});

test('ignores token_count with null info', () => {
  const root = sessionsDir({
    'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', null), ev('2026-11-02T10:01:00.000Z', usage(50, 0, 5))],
  });
  const r = createCodexAdapter(root).scan();
  assert.equal(r.status, 'measured');
  assert.deepEqual(only(r).usage, { input: 50, output: 5, cacheRead: 0, cacheWrite: 0 });
});

test('subtracts cached from input', () => {
  const root = sessionsDir({ 'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', usage(1000, 800, 40, 15))] });
  assert.deepEqual(only(createCodexAdapter(root).scan()).usage, { input: 200, output: 40, cacheRead: 800, cacheWrite: 0 });
});

test('session id comes from the filename', () => {
  const root = sessionsDir({ 'rollout-2026-11-02T10-00-00-abc123.jsonl': [ev('2026-11-02T10:00:00.000Z', usage(1, 0, 1))] });
  assert.equal(only(createCodexAdapter(root).scan()).id, 'codex:rollout-2026-11-02T10-00-00-abc123');
});

test('takes timestamps from the events', () => {
  const root = sessionsDir({
    'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', usage(1, 0, 1)), ev('2026-11-02T10:05:00.000Z', usage(2, 0, 2))],
  });
  const s = only(createCodexAdapter(root).scan());
  assert.equal(s.startedAt, Date.parse('2026-11-02T10:00:00.000Z'));
  assert.equal(s.lastActiveAt, Date.parse('2026-11-02T10:05:00.000Z'));
});

test('skips malformed lines', () => {
  const root = sessionsDir({
    'rollout-a.jsonl': ['{"payload":{"type":"token_count","info":{"total_token_usage":', ev('2026-11-02T10:00:00.000Z', usage(7, 0, 3))],
  });
  assert.deepEqual(only(createCodexAdapter(root).scan()).usage, { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 });
});

test('a session with no input/output split is not counted', () => {
  const totalOnly = { total_token_usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 5000 } };
  const root = sessionsDir({
    'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', totalOnly)],
    'rollout-b.jsonl': [ev('2026-11-02T10:00:00.000Z', usage(9, 0, 1))],
  });
  const r = createCodexAdapter(root).scan();
  assert.equal(r.status, 'measured');
  assert.equal(only(r).id, 'codex:rollout-b');
});

test('unrecognisable format is not-measured', () => {
  const root = sessionsDir({ 'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', { total_token_usage: { tokens: 5 } })] });
  assert.equal(createCodexAdapter(root).scan().status, 'not-measured');
});

test('missing root is measured with no sessions', () => {
  assert.deepEqual(createCodexAdapter(path.join(os.tmpdir(), 'fw-no-codex-root')).scan(), { status: 'measured', sessions: [] });
});

test('second scan picks up new events', () => {
  const root = sessionsDir({ 'rollout-a.jsonl': [ev('2026-11-02T10:00:00.000Z', usage(10, 0, 1))] });
  const a = createCodexAdapter(root);
  a.scan();
  fs.appendFileSync(path.join(root, '2026', '11', '02', 'rollout-a.jsonl'), ev('2026-11-02T10:01:00.000Z', usage(30, 0, 4)) + '\n');
  assert.deepEqual(only(a.scan()).usage, { input: 30, output: 4, cacheRead: 0, cacheWrite: 0 });
});
