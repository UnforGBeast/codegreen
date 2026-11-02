const test = require('node:test');
const assert = require('node:assert/strict');
const { drawLake } = require('../src/renderer/scene');
const { sceneState } = require('../src/core/lake');

function recorder() {
  const calls = [];
  return { calls, set fillStyle(v) { this._c = v; }, fillRect(x, y, w, h) { calls.push({ x, y, w, h, c: this._c }); } };
}

test('draws every level and frame with finite, on-canvas pixels', () => {
  for (const level of [0, 0.2, 0.39, 0.5, 0.61, 0.8, 0.81, 1]) {
    for (let tk = 0; tk < 200; tk++) {
      const c = recorder();
      drawLake(c, level, tk, sceneState(level));
      assert.ok(c.calls.length > 50);
      for (const r of c.calls) {
        assert.ok([r.x, r.y, r.w, r.h].every(Number.isFinite), `non-finite rect at level ${level} tk ${tk}`);
        assert.match(r.c, /^#[0-9a-f]{6}$/);
      }
    }
  }
});

test('haze changes the sky colour and an empty lake still draws fish', () => {
  const clear = recorder();
  const hazy = recorder();
  drawLake(clear, 0.2, 0, sceneState(0.2));
  drawLake(hazy, 0.7, 0, sceneState(0.7));
  assert.equal(clear.calls[0].c, '#6ec6ff');
  assert.equal(hazy.calls[0].c, '#e8a85a');
  const stranded = recorder();
  drawLake(stranded, 1, 3, sceneState(1));
  for (const col of ['#ff8a3c', '#ff5a6a']) assert.ok(stranded.calls.some((r) => r.c === col), `fish ${col} missing when stranded`);
});
