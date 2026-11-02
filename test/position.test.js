const test = require('node:test');
const assert = require('node:assert/strict');
const { safePosition, MARGIN } = require('../src/main/position');

const size = { width: 220, height: 240 };
const primary = { primary: true, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const second = { primary: false, workArea: { x: 1920, y: 0, width: 1920, height: 1040 } };
const bottomRight = { x: 1920 - 220 - MARGIN, y: 1040 - 240 - MARGIN };

test('safePosition keeps a visible position', () => {
  assert.deepEqual(safePosition({ x: 300, y: 200 }, [primary], size), { x: 300, y: 200 });
});

test('safePosition keeps a position on a second display that is still connected', () => {
  assert.deepEqual(safePosition({ x: 2500, y: 100 }, [primary, second], size), { x: 2500, y: 100 });
});

test("safePosition moves an off-screen position to the primary display's bottom right", () => {
  // saved on a second monitor that has since been unplugged
  assert.deepEqual(safePosition({ x: 2500, y: 100 }, [primary], size), bottomRight);
});

test('safePosition moves a position that is only a sliver on screen', () => {
  assert.deepEqual(safePosition({ x: 1915, y: 100 }, [primary], size), bottomRight);
});

test('safePosition uses bottom right when nothing is saved', () => {
  assert.deepEqual(safePosition(undefined, [primary], size), bottomRight);
  assert.deepEqual(safePosition({}, [primary], size), bottomRight);
});

test('safePosition finds the primary display wherever it is listed', () => {
  assert.deepEqual(safePosition(undefined, [second, primary], size), bottomRight);
});
