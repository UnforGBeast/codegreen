const { createClaudeCodeAdapter } = require('./claudeCode');
const { createCodexAdapter } = require('./codex');

const NOT_MEASURED = { status: 'not-measured', sessions: [] };

// A failing adapter reports not-measured instead of taking the others down.
function guard(adapter) {
  return {
    tool: adapter.tool,
    label: adapter.label,
    scan() {
      try {
        return adapter.scan();
      } catch {
        return { ...NOT_MEASURED };
      }
    },
  };
}

function notMeasured(tool, label) {
  return { tool, label, scan: () => ({ ...NOT_MEASURED }) };
}

// Checked 2026-11-02 on the owner's Windows machine; both stay not-measured:
// - Antigravity: ~/.gemini/antigravity/conversations/<id>.db is SQLite (tables trajectory_meta, steps,
//   gen_metadata, ...). gen_metadata.data is binary protobuf with no plainly readable token counts.
// - Claude Desktop chat: the Store package under %LOCALAPPDATA%/Packages/Claude_* holds no .jsonl
//   logs. If its code features write under ~/.claude/projects, the Claude Code adapter already covers them.
function createAdapters() {
  return [
    guard(createClaudeCodeAdapter()),
    guard(createCodexAdapter()),
    notMeasured('antigravity', 'Antigravity'),
    notMeasured('claude-desktop-chat', 'Claude Desktop chat'),
  ];
}

module.exports = { createAdapters, guard };
