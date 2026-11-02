const test = require('node:test');
const assert = require('node:assert/strict');
const { loginItem } = require('../src/main/platform');

test('login item is labelled for the platform', () => {
  assert.deepEqual(loginItem('win32', true), { label: 'Start with Windows' });
  assert.deepEqual(loginItem('darwin', true), { label: 'Start at login' });
});

test('no login item on Linux, where Electron cannot set one', () => {
  assert.equal(loginItem('linux', true), null);
});

test('no login item from an unpackaged dev checkout, which would register bare Electron', () => {
  assert.equal(loginItem('win32', false), null);
  assert.equal(loginItem('darwin', false), null);
});
