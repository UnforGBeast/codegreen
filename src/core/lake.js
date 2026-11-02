// Energy of an average session, used in place of the user's own average until there are
// MIN_SESSIONS. It is the mean over 66 sessions on the author's Claude Code and Codex logs
// (median 80 Wh; a few long sessions dominate the mean). It is an amount of energy, so it
// follows whichever water rate is chosen. See docs/methodology.md.
const BASELINE_WH = 146;
const MIN_SESSIONS = 5;

// Fraction of the lake gone: an average session leaves it half gone.
// baselineMl stands in for the average until there are enough sessions.
function lakeLevel(sessionMl, averageMl, sessionCount, baselineMl) {
  const average = sessionCount >= MIN_SESSIONS && averageMl > 0 ? averageMl : baselineMl;
  return Math.min(1, sessionMl / (2 * average));
}

function sceneState(level) {
  return { jump: level < 0.4, haze: level > 0.6, stranded: level > 0.8 };
}

module.exports = { lakeLevel, sceneState, BASELINE_WH };
