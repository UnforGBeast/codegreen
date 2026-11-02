const { readJsonOrBackup, writeJsonAtomic } = require('./jsonFile');
const { RATES } = require('./water');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function clean(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const s = { ratePreset: Object.hasOwn(RATES, obj.ratePreset) ? obj.ratePreset : 'default' };
  if (isNum(obj.x) && isNum(obj.y)) {
    s.x = obj.x;
    s.y = obj.y;
  }
  return s;
}

function loadSettings(filePath) {
  return readJsonOrBackup(filePath, clean) || { ratePreset: 'default' };
}

function saveSettings(filePath, settings) {
  writeJsonAtomic(filePath, clean(settings) || { ratePreset: 'default' });
}

// Returns the same object for an unknown preset, a new one otherwise.
function withRatePreset(settings, preset) {
  if (typeof preset !== 'string' || !Object.hasOwn(RATES, preset)) return settings;
  return { ...settings, ratePreset: preset };
}

module.exports = { loadSettings, saveSettings, withRatePreset };
