const MARGIN = 16;
const MIN_VISIBLE = 40; // px of the window that must overlap a display, both ways

function visibleOn(display, x, y, size) {
  const a = display.workArea;
  const w = Math.min(x + size.width, a.x + a.width) - Math.max(x, a.x);
  const h = Math.min(y + size.height, a.y + a.height) - Math.max(y, a.y);
  return w >= MIN_VISIBLE && h >= MIN_VISIBLE;
}

// Returns a saved position if it is still on a connected display, else the primary display's bottom right.
function safePosition(saved, displays, size) {
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    if (displays.some((d) => visibleOn(d, saved.x, saved.y, size))) return { x: saved.x, y: saved.y };
  }
  const primary = displays.find((d) => d.primary) || displays[0];
  const a = primary.workArea;
  return { x: a.x + a.width - size.width - MARGIN, y: a.y + a.height - size.height - MARGIN };
}

module.exports = { safePosition, MARGIN };
