const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadLedger, saveLedger, mergeSessions } = require('../src/core/ledger');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fw-ledger-')), 'ledger.json');
const rec = (id, usage, extra = {}) => ({
  id, tool: 'claude-code', startedAt: 1000, lastActiveAt: 2000,
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, ...usage }, ...extra,
});

test('merge keeps the higher value per usage field', () => {
  const l = loadLedger(tmp());
  mergeSessions(l, [rec('claude-code:a', { input: 10, output: 50 })]);
  mergeSessions(l, [rec('claude-code:a', { input: 30, output: 20 })]);
  assert.deepEqual(l.sessions['claude-code:a'].usage, { input: 30, output: 50, cacheRead: 0, cacheWrite: 0 });
});

test('re-merging older data never lowers a total', () => {
  const l = loadLedger(tmp());
  mergeSessions(l, [rec('claude-code:a', { output: 100 })]);
  const changed = mergeSessions(l, [rec('claude-code:a', { output: 40 })]);
  assert.equal(l.sessions['claude-code:a'].usage.output, 100);
  assert.equal(changed, false);
});

test('merge widens the time range and reports change', () => {
  const l = loadLedger(tmp());
  assert.equal(mergeSessions(l, [rec('claude-code:a', { output: 1 })]), true);
  mergeSessions(l, [rec('claude-code:a', { output: 1 }, { startedAt: 500, lastActiveAt: 9000 })]);
  assert.equal(l.sessions['claude-code:a'].startedAt, 500);
  assert.equal(l.sessions['claude-code:a'].lastActiveAt, 9000);
});

test('missing ledger loads empty without a backup', () => {
  const p = tmp();
  assert.deepEqual(loadLedger(p), { version: 1, sessions: {} });
  assert.equal(fs.existsSync(p + '.bak'), false);
});

test('round trip', () => {
  const p = tmp();
  const l = loadLedger(p);
  mergeSessions(l, [rec('codex:x', { input: 5 })]);
  saveLedger(p, l);
  assert.deepEqual(loadLedger(p), l);
});

test('corrupt ledger is kept as .bak and starts empty', () => {
  const p = tmp();
  fs.writeFileSync(p, '{"version":1,"sessions":{"a":');
  assert.deepEqual(loadLedger(p), { version: 1, sessions: {} });
  assert.equal(fs.readFileSync(p + '.bak', 'utf8'), '{"version":1,"sessions":{"a":');
});

test('ledger of the wrong shape is treated as corrupt', () => {
  const p = tmp();
  fs.writeFileSync(p, '[1,2,3]');
  assert.deepEqual(loadLedger(p), { version: 1, sessions: {} });
  assert.ok(fs.existsSync(p + '.bak'));
});

test('save is atomic: temp file then rename', () => {
  const p = tmp();
  const calls = [];
  const real = fs.renameSync;
  fs.renameSync = (from, to) => {
    calls.push([from, to, fs.existsSync(from)]);
    return real(from, to);
  };
  try {
    saveLedger(p, loadLedger(p));
  } finally {
    fs.renameSync = real;
  }
  assert.equal(calls.length, 1);
  assert.notEqual(calls[0][0], p);
  assert.equal(calls[0][1], p);
  assert.equal(calls[0][2], true);
  assert.deepEqual(fs.readdirSync(path.dirname(p)), ['ledger.json']);
});

test('ledger contains only known fields', () => {
  const p = tmp();
  const l = loadLedger(p);
  mergeSessions(l, [rec('claude-code:a', { output: 1, text: 'secret' }, { prompt: 'hello', title: 'x' })]);
  saveLedger(p, l);
  const written = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(Object.keys(written.sessions['claude-code:a']).sort(), ['id', 'lastActiveAt', 'startedAt', 'tool', 'usage']);
  assert.deepEqual(Object.keys(written.sessions['claude-code:a'].usage).sort(), ['cacheRead', 'cacheWrite', 'input', 'output']);
});
