const { loadLedger, saveLedger, mergeSessions } = require('./ledger');
const { waterMl } = require('./water');
const { lakeLevel } = require('./lake');

const ACTIVE_MS = 300000;

function createTracker({ adapters, ledgerPath, getRate, now }) {
  const ledger = loadLedger(ledgerPath); // rebuilt from logs on the first ticks if it was corrupt
  const status = new Map(adapters.map((a) => [a.tool, 'not-measured']));

  let unsaved = false; // stays set until a save succeeds, so a failed write is retried

  function tick() {
    let changed = false;
    for (const adapter of adapters) {
      let result;
      try {
        result = adapter.scan();
      } catch {
        result = { status: 'not-measured', sessions: [] };
      }
      status.set(adapter.tool, result.status);
      if (mergeSessions(ledger, result.sessions)) changed = true;
    }
    if (changed) unsaved = true;
    if (unsaved) {
      try {
        saveLedger(ledgerPath, ledger);
        unsaved = false;
      } catch {
        // unwritable data folder: keep showing figures from memory and try again next tick
      }
    }

    const rate = getRate();
    const records = Object.values(ledger.sessions);
    const allTimeMl = records.reduce((sum, r) => sum + waterMl(r.usage, rate), 0);
    const averageMl = records.length ? allTimeMl / records.length : 0;

    let latest = null;
    for (const r of records) if (!latest || r.lastActiveAt > latest.lastActiveAt) latest = r;

    let session = null;
    let level = 0;
    if (latest) {
      const owner = adapters.find((a) => a.tool === latest.tool);
      session = {
        tool: latest.tool,
        label: owner ? owner.label : latest.tool,
        ml: waterMl(latest.usage, rate),
        active: now() - latest.lastActiveAt < ACTIVE_MS,
      };
      level = lakeLevel(session.ml, averageMl, records.length);
    }

    return {
      session,
      allTimeMl,
      averageMl,
      level,
      rate,
      tools: adapters.map((a) => ({ label: a.label, status: status.get(a.tool) })),
    };
  }

  return { tick };
}

module.exports = { createTracker, ACTIVE_MS };
