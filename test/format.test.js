const test = require('node:test');
const assert = require('node:assert/strict');
const { formatWater } = require('../src/renderer/format');

test('formatWater picks sensible units', () => {
  assert.equal(formatWater(0), '0 mL');
  assert.equal(formatWater(412.4), '412 mL');
  assert.equal(formatWater(999.6), '1.0 L');
  assert.equal(formatWater(38600), '38.6 L');
  assert.equal(formatWater(1250000), '1,250 L');
});

test('formatWater treats bad input as zero', () => {
  assert.equal(formatWater(NaN), '0 mL');
  assert.equal(formatWater(-5), '0 mL');
});
