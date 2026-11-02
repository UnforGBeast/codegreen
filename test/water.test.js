const test = require('node:test');
const assert = require('node:assert/strict');
const { RATES, weightedTokens, waterMl } = require('../src/core/water');

const owners = { input: 19927, output: 8343417, cacheRead: 2731736180, cacheWrite: 42832568 };

test('weights tokens', () =>
  assert.equal(weightedTokens({ input: 1000, output: 1000, cacheRead: 1000, cacheWrite: 1000 }), 1201));

test('default rate on owner totals gives about 39 L', () =>
  assert.ok(Math.abs(waterMl(owners, RATES.default) - 38984) < 100));

// Li et al. (arXiv 2304.03271 v5): operational water = energy x [on-site WUE + PUE x EWIF].
// U.S. average: WUE 0.55 L/kWh, PUE 1.17, EWIF 3.142 L/kWh; the paper also cites 4.35 L/kWh for EWIF.
test('default is the paper U.S. average of cooling plus electricity water', () =>
  assert.ok(Math.abs(RATES.default - (0.55 + 1.17 * 3.142)) < 0.01));

test('high uses the higher electricity factor the paper cites', () =>
  assert.ok(Math.abs(RATES.high - (0.55 + 1.17 * 4.35)) < 0.01));

test('low is the Google cooling-water figure and presets are ordered', () => {
  assert.equal(RATES.low, 1.08);
  assert.ok(RATES.low < RATES.default && RATES.default < RATES.high);
});

test('zero usage is zero water', () =>
  assert.equal(waterMl({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, RATES.default), 0));
