const { readJsonOrBackup, writeJsonAtomic } = require('./jsonFile');

const USAGE_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Keeps only the known fields (totals and timestamps, never content). Null if unusable.
function cleanRecord(r) {
  if (!r || typeof r.id !== 'string' || typeof r.tool !== 'string') return null;
  if (!isNum(r.startedAt) || !isNum(r.lastActiveAt)) return null;
  const u = r.usage || {};
  const usage = {};
  for (const k of USAGE_KEYS) usage[k] = isNum(u[k]) && u[k] > 0 ? u[k] : 0;
  return { id: r.id, tool: r.tool, startedAt: r.startedAt, lastActiveAt: r.lastActiveAt, usage };
}

function emptyLedger() {
  return { version: 1, sessions: {} };
}

function loadLedger(filePath) {
  const loaded = readJsonOrBackup(filePath, (obj) => {
    if (!obj || obj.version !== 1 || !obj.sessions || typeof obj.sessions !== 'object' || Array.isArray(obj.sessions)) {
      return null;
    }
    const ledger = emptyLedger();
    for (const r of Object.values(obj.sessions)) {
      const clean = cleanRecord(r);
      if (clean) ledger.sessions[clean.id] = clean;
    }
    return ledger;
  });
  return loaded || emptyLedger();
}

function saveLedger(filePath, ledger) {
  const out = emptyLedger();
  for (const r of Object.values(ledger.sessions)) {
    const clean = cleanRecord(r);
    if (clean) out.sessions[clean.id] = clean;
  }
  writeJsonAtomic(filePath, out);
}

// Field-wise max on usage keeps totals when a tool prunes or resets its logs.
// Returns true if the ledger changed.
function mergeSessions(ledger, records) {
  let changed = false;
  for (const incoming of records) {
    const clean = cleanRecord(incoming);
    if (!clean) continue;
    const existing = ledger.sessions[clean.id];
    if (!existing) {
      ledger.sessions[clean.id] = clean;
      changed = true;
      continue;
    }
    for (const k of USAGE_KEYS) {
      if (clean.usage[k] > existing.usage[k]) {
        existing.usage[k] = clean.usage[k];
        changed = true;
      }
    }
    if (clean.startedAt < existing.startedAt) {
      existing.startedAt = clean.startedAt;
      changed = true;
    }
    if (clean.lastActiveAt > existing.lastActiveAt) {
      existing.lastActiveAt = clean.lastActiveAt;
      changed = true;
    }
  }
  return changed;
}

module.exports = { loadLedger, saveLedger, mergeSessions };
