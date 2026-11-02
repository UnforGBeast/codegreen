const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checksumLines } = require('../scripts/checksums');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function distWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-dist-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test('lists a sha256 line for each installer, sorted by name', () => {
  const dir = distWith({ 'Freshwater-1.0.0.dmg': 'mac', 'Freshwater Setup 1.0.0.exe': 'win', 'Freshwater-1.0.0.AppImage': 'linux' });
  assert.deepEqual(checksumLines(dir), [
    `${sha('win')}  Freshwater Setup 1.0.0.exe`, // a space sorts before a hyphen
    `${sha('linux')}  Freshwater-1.0.0.AppImage`,
    `${sha('mac')}  Freshwater-1.0.0.dmg`,
  ]);
});

test('skips update manifests, blockmaps and anything that is not an installer', () => {
  const dir = distWith({ 'latest.yml': 'x', 'a.exe.blockmap': 'x', 'builder-debug.yml': 'x', 'a.deb': 'deb', 'a.zip': 'zip' });
  assert.deepEqual(checksumLines(dir).map((l) => l.split('  ')[1]), ['a.deb', 'a.zip']);
});

test('an empty or missing folder gives no lines', () => {
  assert.deepEqual(checksumLines(distWith({})), []);
  assert.deepEqual(checksumLines(path.join(os.tmpdir(), 'fw-no-dist')), []);
});
