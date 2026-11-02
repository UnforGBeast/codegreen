const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReader } = require('./jsonlReader');

const FIELDS = {
  input: 'input_tokens',
  output: 'output_tokens',
  cacheRead: 'cache_read_input_tokens',
  cacheWrite: 'cache_creation_input_tokens',
};

function findJsonl(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findJsonl(full, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

function createClaudeCodeAdapter(rootDir = path.join(os.homedir(), '.claude', 'projects')) {
  const reader = createReader();
  const seenMessages = new Set(); // message.id repeats across lines and files
  const sessions = new Map();
  let recognised = 0;
  let unrecognised = 0;

  // Takes only the usage numbers from a line; nothing else is kept.
  function ingest(line) {
    if (!line.includes('"usage"')) return;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }
    const usage = obj && obj.message && obj.message.usage;
    if (!usage || typeof usage !== 'object') return;
    const id = obj.message.id;
    const sessionId = obj.sessionId;
    const counts = {};
    let numeric = 0;
    for (const [key, field] of Object.entries(FIELDS)) {
      const v = usage[field];
      counts[key] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      if (counts[key] === v) numeric++;
    }
    if (typeof id !== 'string' || typeof sessionId !== 'string' || numeric === 0) {
      unrecognised++;
      return;
    }
    recognised++;

    const parsed = Date.parse(obj.timestamp);
    const ts = Number.isNaN(parsed) ? Date.now() : parsed;
    const key = `claude-code:${sessionId}`;
    let s = sessions.get(key);
    if (!s) {
      s = { id: key, tool: 'claude-code', startedAt: ts, lastActiveAt: ts, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
      sessions.set(key, s);
    }
    s.startedAt = Math.min(s.startedAt, ts);
    s.lastActiveAt = Math.max(s.lastActiveAt, ts);
    // timestamps count every sighting, usage only the first
    if (seenMessages.has(id)) return;
    seenMessages.add(id);
    for (const k of Object.keys(FIELDS)) s.usage[k] += counts[k];
  }

  function scan() {
    try {
      for (const file of findJsonl(rootDir, [])) {
        for (const line of reader.readNew(file)) ingest(line);
      }
      if (unrecognised > 0 && recognised === 0) return { status: 'not-measured', sessions: [] };
      return {
        status: 'measured',
        sessions: [...sessions.values()].map((s) => ({ ...s, usage: { ...s.usage } })),
      };
    } catch {
      return { status: 'not-measured', sessions: [] };
    }
  }

  return { tool: 'claude-code', label: 'Claude Code', scan };
}

module.exports = { createClaudeCodeAdapter };
