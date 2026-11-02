const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReader, createLister } = require('../src/adapters/jsonlReader');

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-reader-'));
  return path.join(dir, 'log.jsonl');
}

test('returns complete lines only', () => {
  const f = tmpFile();
  const r = createReader();
  fs.writeFileSync(f, 'a\nb');
  assert.deepEqual(r.readNew(f), ['a']);
  fs.appendFileSync(f, 'c\n');
  assert.deepEqual(r.readNew(f), ['bc']);
});

test('reads only new bytes', () => {
  const f = tmpFile();
  const r = createReader();
  fs.writeFileSync(f, 'a\nb\n');
  assert.deepEqual(r.readNew(f), ['a', 'b']);
  assert.deepEqual(r.readNew(f), []);
  fs.appendFileSync(f, 'c\n');
  assert.deepEqual(r.readNew(f), ['c']);
});

test('re-reads a shrunk file', () => {
  const f = tmpFile();
  const r = createReader();
  fs.writeFileSync(f, 'one\ntwo\nthree\n');
  r.readNew(f);
  fs.writeFileSync(f, 'x\ny\n');
  assert.deepEqual(r.readNew(f), ['x', 'y']);
});

test('missing file returns empty', () => {
  const r = createReader();
  assert.deepEqual(r.readNew(path.join(os.tmpdir(), 'fw-does-not-exist.jsonl')), []);
});

test('lister rewalks the directory only after the interval', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-lister-'));
  fs.writeFileSync(path.join(dir, 'a.jsonl'), '');
  const clock = { t: 1000 };
  const lister = createLister(dir, { intervalMs: 30000, now: () => clock.t });
  assert.deepEqual(lister.list().map((f) => path.basename(f)), ['a.jsonl']);
  fs.writeFileSync(path.join(dir, 'b.jsonl'), '');
  clock.t += 29999;
  assert.deepEqual(lister.list().map((f) => path.basename(f)), ['a.jsonl']);
  clock.t += 2;
  assert.deepEqual(lister.list().map((f) => path.basename(f)).sort(), ['a.jsonl', 'b.jsonl']);
});

test('lister on a missing directory is empty', () => {
  const lister = createLister(path.join(os.tmpdir(), 'fw-no-such-dir'), { intervalMs: 1, now: Date.now });
  assert.deepEqual(lister.list(), []);
});
