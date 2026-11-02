// mL of water per Wh of server energy. See docs/methodology.md.
// Li et al. (arXiv 2304.03271 v5): operational water = energy x [on-site WUE + PUE x EWIF].
//   low     1.08  data-centre cooling water only (Google's fleetwide figure)
//   default 4.23  cooling plus electricity water, U.S. average: 0.55 + 1.17 x 3.142
//   high    5.64  the same, with the 4.35 L/kWh electricity factor the paper cites: 0.55 + 1.17 x 4.35
const RATES = { low: 1.08, default: 4.23, high: 5.64 };

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
