const test = require('node:test');
const assert = require('node:assert/strict');
const { lakeLevel, sceneState } = require('../src/core/lake');

const BASELINE = 140; // any baseline works here; the tracker passes the rate-adjusted one

test('average session is half gone', () => assert.equal(lakeLevel(100, 100, 5, BASELINE), 0.5));
test('caps at 1', () => assert.equal(lakeLevel(900, 100, 5, BASELINE), 1));
test('uses the baseline under 5 sessions', () => assert.equal(lakeLevel(140, 9999, 4, BASELINE), 0.5));
test('zero average with 5 sessions falls back to the baseline', () => assert.equal(lakeLevel(0, 0, 5, BASELINE), 0));
test('uses the user average from 5 sessions on', () => assert.equal(lakeLevel(50, 100, 5, BASELINE), 0.25));

test('stage boundaries', () => {
  assert.deepEqual(sceneState(0.39), { jump: true, haze: false, stranded: false });
  assert.deepEqual(sceneState(0.61), { jump: false, haze: true, stranded: false });
  assert.deepEqual(sceneState(0.81), { jump: false, haze: true, stranded: true });
});
