const test = require('node:test');
const assert = require('node:assert/strict');
const { lakeLevel, sceneState } = require('../src/core/lake');

test('average session is half gone', () => assert.equal(lakeLevel(100, 100, 5), 0.5));
test('caps at 1', () => assert.equal(lakeLevel(900, 100, 5), 1));
test('uses 140 mL baseline under 5 sessions', () => assert.equal(lakeLevel(140, 9999, 4), 0.5));
test('zero average with 5 sessions falls back to baseline', () => assert.equal(lakeLevel(0, 0, 5), 0));

test('stage boundaries', () => {
  assert.deepEqual(sceneState(0.39), { jump: true, haze: false, stranded: false });
  assert.deepEqual(sceneState(0.61), { jump: false, haze: true, stranded: false });
  assert.deepEqual(sceneState(0.81), { jump: false, haze: true, stranded: true });
});
