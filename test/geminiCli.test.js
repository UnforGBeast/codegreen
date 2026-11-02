const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGeminiCliAdapter, geminiRoot } = require('../src/adapters/geminiCli');

// Records follow google-gemini/gemini-cli packages/core/src/services/chatRecordingTypes.ts,
// with the conversation content left out: usage numbers and timestamps only.
const header = (sessionId, start = '2026-11-02T10:00:00.000Z') =>
  JSON.stringify({ sessionId, projectHash: 'p', startTime: start, lastUpdated: start });
const msg = (id, ts, tokens, type = 'gemini') =>
  JSON.stringify({ id, timestamp: ts, type, ...(tokens === undefined ? {} : { tokens }) });
const tok = (input, output, cached = 0, thoughts = 0, tool = 0) => ({
  input, output, cached, thoughts, tool, total: input + output + thoughts + tool,
});

// files: { 'proj/chats/session-x.jsonl': [lines] }, relative to a temp tmp/ root
function tmpRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-gemini-'));
  for (const [rel, lines] of Object.entries(files)) {
    const f = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, lines.join('\n') + '\n');
  }
  return root;
}
const only = (r) => {
  assert.equal(r.sessions.length, 1);
  return r.sessions[0];
};
const C = 'proj/chats';

test('identifies itself', () => {
  const a = createGeminiCliAdapter(tmpRoot({}));
  assert.equal(a.tool, 'gemini-cli');
  assert.equal(a.label, 'Gemini CLI');
});

test('maps tokens: cached comes out of input, thoughts count as output, tool use as input', () => {
  const root = tmpRoot({ [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(1000, 40, 700, 15, 25))] });
  assert.deepEqual(only(createGeminiCliAdapter(root).scan()).usage, { input: 325, output: 55, cacheRead: 700, cacheWrite: 0 });
});

test('sums the messages of one session', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)), msg('m2', '2026-11-02T10:01:00.000Z', tok(200, 20))],
  });
  const s = only(createGeminiCliAdapter(root).scan());
  assert.equal(s.id, 'gemini-cli:s1');
  assert.deepEqual(s.usage, { input: 300, output: 30, cacheRead: 0, cacheWrite: 0 });
});

test('the last copy of a message id wins and a repeated copy counts once', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [
      header('s1'),
      msg('m1', '2026-11-02T10:00:05.000Z', undefined), // first written without tokens
      msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)), // re-appended with tokens
      msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)), // and once more
    ],
  });
  assert.deepEqual(only(createGeminiCliAdapter(root).scan()).usage, { input: 100, output: 10, cacheRead: 0, cacheWrite: 0 });
});

test('a later copy without tokens does not erase earlier tokens', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)), msg('m1', '2026-11-02T10:00:05.000Z', null)],
  });
  assert.equal(only(createGeminiCliAdapter(root).scan()).usage.output, 10);
});

test('dedupes the same message across files', () => {
  const line = msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10));
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), line],
    [`${C}/session-b.jsonl`]: [header('s1'), line],
  });
  assert.equal(only(createGeminiCliAdapter(root).scan()).usage.output, 10);
});

test('a subagent chat folds into its parent session', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('parent-1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10))],
    [`${C}/parent-1/sub-9.jsonl`]: [header('sub-9'), msg('m2', '2026-11-02T10:00:06.000Z', tok(50, 5))],
  });
  const s = only(createGeminiCliAdapter(root).scan());
  assert.equal(s.id, 'gemini-cli:parent-1');
  assert.deepEqual(s.usage, { input: 150, output: 15, cacheRead: 0, cacheWrite: 0 });
});

test('separate sessions stay separate', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(1, 1))],
    [`${C}/session-b.jsonl`]: [header('s2'), msg('m2', '2026-11-02T11:00:05.000Z', tok(1, 1))],
  });
  assert.deepEqual(createGeminiCliAdapter(root).scan().sessions.map((s) => s.id).sort(), ['gemini-cli:s1', 'gemini-cli:s2']);
});

test('user and info messages and gemini messages without tokens add nothing', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [
      header('s1'),
      msg('u1', '2026-11-02T10:00:01.000Z', undefined, 'user'),
      msg('g1', '2026-11-02T10:00:02.000Z', undefined),
      msg('g2', '2026-11-02T10:00:03.000Z', null),
    ],
  });
  const r = createGeminiCliAdapter(root).scan();
  assert.equal(r.status, 'measured');
  assert.deepEqual(r.sessions, []);
});

test('patch and rewind records are ignored and spent tokens stay counted', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [
      header('s1'),
      msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)),
      JSON.stringify({ $patch: { id: 'm1', content: 'x' } }),
      JSON.stringify({ $rewindTo: 'm1' }),
      JSON.stringify({ $set: { summary: 'x' } }),
    ],
  });
  assert.equal(only(createGeminiCliAdapter(root).scan()).usage.output, 10);
});

test('takes timestamps from the header, updates and messages', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [
      header('s1', '2026-11-02T10:00:00.000Z'),
      msg('m1', '2026-11-02T10:00:05.000Z', tok(1, 1)),
      JSON.stringify({ $set: { lastUpdated: '2026-11-02T10:09:00.000Z' } }),
    ],
  });
  const s = only(createGeminiCliAdapter(root).scan());
  assert.equal(s.startedAt, Date.parse('2026-11-02T10:00:00.000Z'));
  assert.equal(s.lastActiveAt, Date.parse('2026-11-02T10:09:00.000Z'));
});

test('skips malformed lines', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), '{"id":"x","tokens":{"input":', msg('m1', '2026-11-02T10:00:05.000Z', tok(7, 3))],
  });
  assert.deepEqual(only(createGeminiCliAdapter(root).scan()).usage, { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 });
});

test('only files under a chats folder are read', () => {
  const root = tmpRoot({
    [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', tok(1, 1))],
    'proj/other/session-z.jsonl': [header('z'), msg('mz', '2026-11-02T10:00:05.000Z', tok(999, 999))],
  });
  assert.equal(only(createGeminiCliAdapter(root).scan()).usage.output, 1);
});

test('missing root is measured with no sessions', () => {
  assert.deepEqual(createGeminiCliAdapter(path.join(os.tmpdir(), 'fw-no-gemini-root')).scan(), { status: 'measured', sessions: [] });
});

test('unrecognisable format is not-measured', () => {
  const root = tmpRoot({ [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', { count: 5 })] });
  assert.equal(createGeminiCliAdapter(root).scan().status, 'not-measured');
});

test('second scan picks up tokens added to a known message and new messages', () => {
  const root = tmpRoot({ [`${C}/session-a.jsonl`]: [header('s1'), msg('m1', '2026-11-02T10:00:05.000Z', undefined)] });
  const a = createGeminiCliAdapter(root);
  assert.deepEqual(a.scan().sessions, []);
  const more = [msg('m1', '2026-11-02T10:00:05.000Z', tok(100, 10)), msg('m2', '2026-11-02T10:01:00.000Z', tok(5, 1))];
  fs.appendFileSync(path.join(root, 'proj', 'chats', 'session-a.jsonl'), more.join('\n') + '\n');
  assert.deepEqual(only(a.scan()).usage, { input: 105, output: 11, cacheRead: 0, cacheWrite: 0 });
});

test('the default root follows GEMINI_CLI_HOME like the CLI does', () => {
  assert.equal(geminiRoot({ GEMINI_CLI_HOME: path.join('x', 'home') }, path.join('u', 'me')), path.join('x', 'home', '.gemini', 'tmp'));
  assert.equal(geminiRoot({}, path.join('u', 'me')), path.join('u', 'me', '.gemini', 'tmp'));
});
