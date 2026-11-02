const BASELINE_ML = 140;
const MIN_SESSIONS = 5;

// Fraction of the lake gone: an average session leaves it half gone.
function lakeLevel(sessionMl, averageMl, sessionCount) {
  const average = sessionCount >= MIN_SESSIONS && averageMl > 0 ? averageMl : BASELINE_ML;
  return Math.min(1, sessionMl / (2 * average));
}

function sceneState(level) {
  return { jump: level < 0.4, haze: level > 0.6, stranded: level > 0.8 };
}

module.exports = { lakeLevel, sceneState };
