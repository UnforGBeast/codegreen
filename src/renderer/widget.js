// Globals formatWater (format.js) and drawLake (scene.js) come from their own script tags.
const FRAME_MS = 125; // 8 frames per second
const ctx = document.getElementById('lake').getContext('2d');
ctx.imageSmoothingEnabled = false;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let snapshot = null;
let frame = 0;
let timer = null;

function draw() {
  if (!snapshot) return;
  drawLake(ctx, snapshot.level, frame, snapshot.scene);
}

// Animate only while a session is active, motion is allowed and the page is visible;
// otherwise draw one still frame and stop the timer.
function sync() {
  const animate = !!(snapshot && snapshot.session && snapshot.session.active) && !reduceMotion.matches && !document.hidden;
  if (animate && !timer) {
    timer = setInterval(() => {
      frame++;
      draw();
    }, FRAME_MS);
  } else if (!animate && timer) {
    clearInterval(timer);
    timer = null;
  }
  // draw now in every case, so the lake never lags the numbers by a timer tick
  draw();
}

function render(s) {
  snapshot = s;
  const session = s.session;
  document.getElementById('tool').textContent = session ? session.label.toUpperCase() : 'WAITING';
  document.getElementById('session').textContent = formatWater(session ? session.ml : 0);
  document.getElementById('all').textContent = formatWater(s.allTimeMl);
  document.getElementById('avg').textContent = formatWater(s.averageMl);
  sync();
}

window.freshwater.onSnapshot(render);
document.addEventListener('visibilitychange', sync);
reduceMotion.addEventListener('change', sync);

for (const id of ['r-session', 'r-all', 'r-avg']) {
  document.getElementById(id).addEventListener('click', () => window.freshwater.openInfo());
}
// The rows are no-drag, so Chromium delivers their context menu here; the canvas is handled in main.
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.freshwater.openMenu();
});
