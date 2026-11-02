const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSettings, saveSettings } = require('../src/core/settings');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fw-settings-')), 'settings.json');

test('missing settings give the default preset', () => {
  assert.deepEqual(loadSettings(tmp()), { ratePreset: 'default' });
});

test('round trip with a saved position', () => {
  const p = tmp();
  saveSettings(p, { ratePreset: 'high', x: 10, y: 20 });
  assert.deepEqual(loadSettings(p), { ratePreset: 'high', x: 10, y: 20 });
});

test('corrupt settings fall back to default preset', () => {
  const p = tmp();
  fs.writeFileSync(p, '{"ratePreset":');
  assert.deepEqual(loadSettings(p), { ratePreset: 'default' });
  assert.ok(fs.existsSync(p + '.bak'));
});

test('unknown preset and bad position fall back, unknown keys are dropped', () => {
  const p = tmp();
  fs.writeFileSync(p, JSON.stringify({ ratePreset: 'bogus', x: 'a', y: 5, extra: 1 }));
  assert.deepEqual(loadSettings(p), { ratePreset: 'default' });
});
