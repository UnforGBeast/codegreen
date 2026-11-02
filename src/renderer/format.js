// Loaded as a plain script in the renderer and with require() in tests.
function formatWater(ml) {
  if (!Number.isFinite(ml) || ml <= 0) return '0 mL';
  if (ml < 999.5) return `${Math.round(ml)} mL`;
  const litres = ml / 1000;
  if (litres < 100) return `${litres.toFixed(1)} L`;
  return `${Math.round(litres).toLocaleString('en-US')} L`;
}

if (typeof module !== 'undefined') module.exports = { formatWater };
