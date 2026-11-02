const os = require('node:os');
const path = require('node:path');
const { createReader, createLister } = require('./jsonlReader');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Where Gemini CLI keeps chats: <home>/.gemini/tmp/<project>/chats/..., with GEMINI_CLI_HOME
// replacing the home directory, as in the CLI's own Storage class.
function geminiRoot(env = process.env, home = os.homedir()) {
  return path.join(env.GEMINI_CLI_HOME || home, '.gemini', 'tmp');
}

// Layout and fields follow google-gemini/gemini-cli packages/core/src/services
// (chatRecordingService.ts and chatRecordingTypes.ts):
// - chats/session-<time>-<id>.jsonl holds one JSON record per line: a header with sessionId,
//   startTime and lastUpdated, then message records, plus $set, $patch and $rewindTo records.
// - A `gemini` message carries `tokens` {input, output, cached, thoughts, tool, total} for one
//   response, and is appended again in full when its tokens are attached, so the last copy wins.
// - Subagent chats live under chats/<parentSessionId>/ and belong to the parent session.
// Older sessions saved as a single .json file are not read, so they add nothing.
function createGeminiCliAdapter(rootDir = geminiRoot()) {
  const reader = createReader();
  const lister = createLister(rootDir);
  const files = new Map(); // path -> { sessionId, start, last }
  const messages = new Map(); // message id -> { file, tokens }
  let recognised = 0;
  let unrecognised = 0;

  function fileInfo(file) {
    let info = files.get(file);
    if (!info) {
      info = { sessionId: null, start: Infinity, last: -Infinity };
      files.set(file, info);
    }
    return info;
  }

  function touch(info, value) {
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) return;
    info.start = Math.min(info.start, ts);
    info.last = Math.max(info.last, ts);
  }

  // Takes only usage numbers and timestamps from a line; nothing else is kept.
  function ingest(file, line) {
    if (!line.includes('"tokens"') && !line.includes('"sessionId"') && !line.includes('"lastUpdated"')) return;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }
    if (!obj || typeof obj !== 'object') return;
    const info = fileInfo(file);

    if (typeof obj.sessionId === 'string') {
      if (!info.sessionId) info.sessionId = obj.sessionId;
      touch(info, obj.startTime);
      touch(info, obj.lastUpdated);
    }
    if (obj.$set && typeof obj.$set === 'object') touch(info, obj.$set.lastUpdated);

    if (obj.type !== 'gemini' || typeof obj.id !== 'string' || !obj.tokens || typeof obj.tokens !== 'object') return;
    const t = obj.tokens;
    if (!isNum(t.input) || !isNum(t.output)) {
      unrecognised++;
      return;
    }
    recognised++;
    touch(info, obj.timestamp);
    messages.set(obj.id, {
      file,
      tokens: {
        input: t.input,
        output: t.output,
        cached: isNum(t.cached) ? t.cached : 0,
        thoughts: isNum(t.thoughts) ? t.thoughts : 0,
        tool: isNum(t.tool) ? t.tool : 0,
      },
    });
  }

  // The path segments after the "chats" folder, or null if the file is not a chat.
  function afterChats(file) {
    const parts = path.relative(rootDir, file).split(path.sep);
    const i = parts.lastIndexOf('chats');
    return i === -1 ? null : parts.slice(i + 1);
  }

  function sessionKey(file) {
    const rest = afterChats(file);
    if (rest && rest.length > 1) return rest[0]; // subagent: folded into the parent session
    return (files.get(file) && files.get(file).sessionId) || path.basename(file, '.jsonl');
  }

  function scan() {
    try {
      for (const file of lister.list()) {
        if (!afterChats(file)) continue;
        for (const line of reader.readNew(file)) ingest(file, line);
      }
      if (unrecognised > 0 && recognised === 0) return { status: 'not-measured', sessions: [] };

      const sessions = new Map();
      for (const m of messages.values()) {
        const key = sessionKey(m.file);
        let s = sessions.get(key);
        if (!s) {
          s = { id: `gemini-cli:${key}`, tool: 'gemini-cli', startedAt: Infinity, lastActiveAt: -Infinity, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
          sessions.set(key, s);
        }
        const t = m.tokens;
        // cached tokens are part of the prompt count; tool-use prompt tokens are separate input
        s.usage.input += Math.max(0, t.input - t.cached) + t.tool;
        s.usage.cacheRead += t.cached;
        s.usage.output += t.output + t.thoughts; // thinking is billed as output
      }
      for (const [file, info] of files) {
        const s = sessions.get(sessionKey(file));
        if (!s) continue;
        s.startedAt = Math.min(s.startedAt, info.start);
        s.lastActiveAt = Math.max(s.lastActiveAt, info.last);
      }
      const fallback = Date.now();
      return {
        status: 'measured',
        sessions: [...sessions.values()].map((s) => ({
          ...s,
          startedAt: Number.isFinite(s.startedAt) ? s.startedAt : fallback,
          lastActiveAt: Number.isFinite(s.lastActiveAt) ? s.lastActiveAt : fallback,
        })),
      };
    } catch {
      return { status: 'not-measured', sessions: [] };
    }
  }

  return { tool: 'gemini-cli', label: 'Gemini CLI', scan };
}

module.exports = { createGeminiCliAdapter, geminiRoot };
