const os = require('node:os');
const path = require('node:path');
const { createReader, findJsonl } = require('./jsonlReader');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function createCodexAdapter(rootDir = path.join(os.homedir(), '.codex', 'sessions')) {
  const reader = createReader();
  const files = new Map(); // path -> { last, startedAt, lastActiveAt }
  let recognised = 0;
  let unrecognised = 0;

  // Takes only the cumulative usage numbers from a line; nothing else is kept.
  function ingest(file, line) {
    if (!line.includes('token_count')) return;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }
    const p = obj && obj.payload;
    if (!p || p.type !== 'token_count' || !p.info) return;
    const u = p.info.total_token_usage;
    if (!u || !isNum(u.input_tokens) || !isNum(u.output_tokens)) {
      unrecognised++;
      return;
    }
    recognised++;
    const parsed = Date.parse(obj.timestamp);
    const ts = Number.isNaN(parsed) ? Date.now() : parsed;
    let f = files.get(file);
    if (!f) {
      f = { last: null, startedAt: ts, lastActiveAt: ts };
      files.set(file, f);
    }
    f.startedAt = Math.min(f.startedAt, ts);
    f.lastActiveAt = Math.max(f.lastActiveAt, ts);
    // total_token_usage is cumulative: keep the latest, never sum
    f.last = {
      input: u.input_tokens,
      cached: isNum(u.cached_input_tokens) ? u.cached_input_tokens : 0,
      output: u.output_tokens,
    };
  }

  function scan() {
    try {
      for (const file of findJsonl(rootDir)) {
        for (const line of reader.readNew(file)) ingest(file, line);
      }
      if (unrecognised > 0 && recognised === 0) return { status: 'not-measured', sessions: [] };
      const sessions = [];
      for (const [file, f] of files) {
        // Some sessions report only total_tokens; with no input/output split there is nothing to measure.
        if (!f.last || f.last.input + f.last.output === 0) continue;
        sessions.push({
          id: `codex:${path.basename(file, '.jsonl')}`,
          tool: 'codex',
          startedAt: f.startedAt,
          lastActiveAt: f.lastActiveAt,
          usage: {
            input: Math.max(0, f.last.input - f.last.cached),
            output: f.last.output,
            cacheRead: f.last.cached,
            cacheWrite: 0,
          },
        });
      }
      return { status: 'measured', sessions };
    } catch {
      return { status: 'not-measured', sessions: [] };
    }
  }

  return { tool: 'codex', label: 'Codex', scan };
}

module.exports = { createCodexAdapter };
