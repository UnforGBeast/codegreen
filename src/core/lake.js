const BASELINE_ML = 140;
// The baseline is an amount of energy, so it follows whichever water rate is chosen.
// 140 mL was written at the original 1.8 mL/Wh.
const BASELINE_WH = BASELINE_ML / 1.8;
const MIN_SESSIONS = 5;

// Fraction of the lake gone: an average session leaves it half gone.
// baselineMl stands in for the average until there are enough sessions.
function lakeLevel(sessionMl, averageMl, sessionCount, baselineMl = BASELINE_ML) {
  const average = sessionCount >= MIN_SESSIONS && averageMl > 0 ? averageMl : baselineMl;
  return Math.min(1, sessionMl / (2 * average));
}

function sceneState(level) {
  return { jump: level < 0.4, haze: level > 0.6, stranded: level > 0.8 };
}

module.exports = { lakeLevel, sceneState, BASELINE_WH };
