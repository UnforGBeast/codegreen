const test = require('node:test');
const assert = require('node:assert/strict');
const { RATES, weightedTokens, waterMl } = require('../src/core/water');

const owners = { input: 19927, output: 8343417, cacheRead: 2731736180, cacheWrite: 42832568 };

test('weights tokens', () =>
  assert.equal(weightedTokens({ input: 1000, output: 1000, cacheRead: 1000, cacheWrite: 1000 }), 1201));

test('default rate on owner totals gives about 16.6 L', () =>
  assert.ok(Math.abs(waterMl(owners, RATES.default) - 16580) < 100));

test('zero usage is zero water', () =>
  assert.equal(waterMl({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, RATES.default), 0));
