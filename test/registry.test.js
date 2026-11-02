const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdapters, guard } = require('../src/adapters/index');

test('registry lists all four tools', () => {
  assert.deepEqual(
    createAdapters().map((a) => a.label),
    ['Claude Code', 'Codex', 'Gemini CLI', 'Antigravity', 'Claude Desktop chat']
  );
});

test('not-measured tools add no sessions', () => {
  const fixed = createAdapters().filter((a) => ['Antigravity', 'Claude Desktop chat'].includes(a.label));
  assert.equal(fixed.length, 2);
  for (const a of fixed) assert.deepEqual(a.scan(), { status: 'not-measured', sessions: [] });
});

test('one adapter failing leaves the others working', () => {
  const broken = guard({ tool: 'x', label: 'X', scan() { throw new Error('boom'); } });
  const fine = guard({ tool: 'y', label: 'Y', scan: () => ({ status: 'measured', sessions: [] }) });
  assert.deepEqual(broken.scan(), { status: 'not-measured', sessions: [] });
  assert.deepEqual(fine.scan(), { status: 'measured', sessions: [] });
  assert.equal(broken.label, 'X');
});
