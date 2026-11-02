const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReader } = require('../src/adapters/jsonlReader');

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
