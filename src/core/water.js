const RATES = { low: 1.08, default: 1.8, high: 3.8 }; // mL per Wh

const WEIGHTS = { output: 1, input: 0.1, cacheWrite: 0.1, cacheRead: 0.001 };
const WH_PER_1000_WEIGHTED = 0.6;

function weightedTokens(usage) {
  return (
    usage.output * WEIGHTS.output +
    usage.input * WEIGHTS.input +
    usage.cacheWrite * WEIGHTS.cacheWrite +
    usage.cacheRead * WEIGHTS.cacheRead
  );
}

function waterMl(usage, rate) {
  return (weightedTokens(usage) / 1000) * WH_PER_1000_WEIGHTED * rate;
}

module.exports = { RATES, weightedTokens, waterMl };
