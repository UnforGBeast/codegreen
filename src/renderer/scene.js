// Pixel scene ported from the approved mockup (lake-fish-v2.html). Drawn on a 64x48 canvas.
// Loaded as a plain script in the renderer; `state` comes from sceneState() in the main process.
const SCENE_W = 64;
const SCENE_H = 48;
const FISH = ['.ooo.', 'ooooo', '.ooo.'];
const FISH_COLORS = ['#ff8a3c', '#ffd84a', '#ff5a6a'];

function rect(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

function drawFish(c, x, y, col, flip) {
  FISH.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'o') rect(c, x + i, y + j, 1, 1, col);
  });
  rect(c, flip ? x + 1 : x + 3, y + 1, 1, 1, '#0a0f1f');
  rect(c, flip ? x + 5 : x - 1, y, 1, 3, col);
}

// level: 0 full lake .. 1 empty. tk: frame counter. state: {jump, haze, stranded}.
function drawLake(c, level, tk, state) {
  const p = level;
  rect(c, 0, 0, SCENE_W, SCENE_H, state.haze ? '#e8a85a' : '#6ec6ff');
  rect(c, 0, 24, SCENE_W, 3, state.haze ? '#b87a3a' : '#3f8f5a');
  rect(c, 0, 27, SCENE_W, 21, state.haze ? '#8a6236' : '#4fa35f');
  const flick = (tk >> 2) & 1;
  rect(c, 49, 3, 8, 8, '#ffd84a');
  rect(c, 47 - flick, 6, 1, 2, '#ffd84a');
  rect(c, 58 + flick, 6, 1, 2, '#ffd84a');
  rect(c, 52, 1 - flick, 2, 1, '#ffd84a');
  rect(c, 52, 12 + flick, 2, 1, '#ffd84a');

  const rx = Math.max(3, Math.round(22 * (1 - p)));
  const ry = Math.max(2, Math.round(9 * (1 - p)));
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
      rect(c, 25 + x, 37 + y, 1, 1, ((x + y + tk) >> 3) & 3 ? '#2b7fff' : '#8fd3ff');
    }
  }

  rect(c, 52, 22, 2, 10, '#5a3a22');
  const leaves = [[48, 14], [52, 12], [56, 14], [46, 18], [50, 17], [54, 17], [58, 18]];
  const keep = Math.ceil(leaves.length * (1 - p));
  leaves.slice(0, keep).forEach((l) => rect(c, l[0], l[1], 4, 4, '#2f8f3f'));
  if (p > 0.5) {
    [[6, 44], [9, 45], [12, 44], [44, 42], [47, 43], [50, 42], [34, 45], [37, 46]].forEach((k, i) => {
      if (i / 8 < (p - 0.5) * 2) rect(c, k[0], k[1], 3, 1, '#4a3218');
    });
  }

  FISH_COLORS.forEach((col, i) => {
    let fx;
    let fy;
    let flip;
    if (state.stranded) {
      // Stranded: spread either side of the puddle and flop in place. They never die.
      fx = 25 + (i - 1) * 9 - 2;
      fy = 40 - ((tk + i * 3) % 6 < 2 ? 2 : 0);
      flip = ((tk + i) >> 1) & 1;
    } else {
      const reach = Math.max(1, rx - 7);
      const s = Math.sin(tk / 7 + i * 2.1);
      fx = 23 + Math.round(s * reach);
      fy = 36 + Math.round((i - 1) * Math.max(1, ry - 3) * 0.8);
      flip = Math.cos(tk / 7 + i * 2.1) < 0;
      if (state.jump) {
        const jump = (tk + i * 37) % 64;
        if (jump < 8) {
          fy -= Math.round(Math.sin((jump / 8) * Math.PI) * (ry + 5));
          if (jump === 0 || jump === 7) rect(c, fx, 37 - ry + 2, 5, 1, '#ffffff');
        }
      }
    }
    drawFish(c, fx, fy, col, flip);
  });
}

if (typeof module !== 'undefined') module.exports = { drawLake, drawFish };
