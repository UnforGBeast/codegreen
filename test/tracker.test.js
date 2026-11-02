const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTracker, ACTIVE_MS } = require('../src/core/tracker');
const { waterMl, RATES } = require('../src/core/water');
const { lakeLevel, BASELINE_WH } = require('../src/core/lake');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fw-tracker-')), 'ledger.json');
const usage = (output) => ({ input: 0, output, cacheRead: 0, cacheWrite: 0 });
const rec = (tool, id, output, lastActiveAt) => ({
  id: `${tool}:${id}`, tool, startedAt: lastActiveAt - 1000, lastActiveAt, usage: usage(output),
});
// A fake adapter whose scan result the test controls.
const fake = (tool, label, result) => ({ tool, label, result, scan() { return this.result; } });

function setup(adapters, now = 1_000_000, rate = RATES.default) {
  const clock = { now };
  const state = { rate };
  const tracker = createTracker({ adapters, ledgerPath: tmp(), getRate: () => state.rate, now: () => clock.now });
  return { tracker, clock, state };
}

test('empty ledger gives a null session and zeros', () => {
  const { tracker } = setup([fake('claude-code', 'Claude Code', { status: 'measured', sessions: [] })]);
  assert.deepEqual(tracker.tick(), {
    session: null, allTimeMl: 0, averageMl: 0, level: 0, rate: RATES.default,
    tools: [{ label: 'Claude Code', status: 'measured' }],
  });
});

test('session is the most recent lastActiveAt across tools', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 900_000)] });
  const b = fake('codex', 'Codex', { status: 'measured', sessions: [rec('codex', 'b', 2000, 990_000)] });
  const { tracker } = setup([a, b]);
  const snap = tracker.tick();
  assert.equal(snap.session.tool, 'codex');
  assert.equal(snap.session.label, 'Codex');
  assert.equal(snap.session.ml, waterMl(usage(2000), RATES.default));
  assert.equal(snap.session.active, true);
});

test('active is false after 5 minutes and session stays populated', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 1_000_000)] });
  const { tracker, clock } = setup([a]);
  assert.equal(tracker.tick().session.active, true);
  clock.now += ACTIVE_MS + 1;
  const snap = tracker.tick();
  assert.equal(snap.session.active, false);
  assert.equal(snap.session.tool, 'claude-code');
  assert.ok(snap.session.ml > 0);
});

test('average is all-time water over session count', () => {
  const a = fake('claude-code', 'Claude Code', {
    status: 'measured',
    sessions: [rec('claude-code', 'a', 1000, 1), rec('claude-code', 'b', 3000, 2)],
  });
  const snap = setup([a]).tracker.tick();
  const total = waterMl(usage(4000), RATES.default);
  assert.ok(Math.abs(snap.allTimeMl - total) < 1e-9);
  assert.ok(Math.abs(snap.averageMl - total / 2) < 1e-9);
});

test('level follows the lake formula', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 5)] });
  const snap = setup([a]).tracker.tick();
  assert.equal(snap.level, lakeLevel(snap.session.ml, snap.averageMl, 1, BASELINE_WH * RATES.default));
});

test('pruned session stays in all-time', () => {
  const a = fake('claude-code', 'Claude Code', {
    status: 'measured',
    sessions: [rec('claude-code', 'a', 1000, 1), rec('claude-code', 'b', 1000, 2)],
  });
  const { tracker } = setup([a]);
  const before = tracker.tick().allTimeMl;
  a.result = { status: 'measured', sessions: [rec('claude-code', 'b', 1000, 2)] };
  assert.equal(tracker.tick().allTimeMl, before);
});

test('changing rate recalculates all figures', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 5)] });
  const { tracker, state } = setup([a]);
  const lo = tracker.tick();
  state.rate = RATES.high;
  const hi = tracker.tick();
  assert.equal(hi.rate, RATES.high);
  assert.ok(Math.abs(hi.allTimeMl / lo.allTimeMl - RATES.high / RATES.default) < 1e-9);
  assert.ok(Math.abs(hi.session.ml / lo.session.ml - RATES.high / RATES.default) < 1e-9);
});

test('tools lists each adapter status', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [] });
  const b = fake('antigravity', 'Antigravity', { status: 'not-measured', sessions: [] });
  assert.deepEqual(setup([a, b]).tracker.tick().tools, [
    { label: 'Claude Code', status: 'measured' },
    { label: 'Antigravity', status: 'not-measured' },
  ]);
});

test('a throwing adapter reads as not-measured', () => {
  const bad = { tool: 'x', label: 'X', scan() { throw new Error('boom'); } };
  assert.deepEqual(setup([bad]).tracker.tick().tools, [{ label: 'X', status: 'not-measured' }]);
});

test('ledger is saved only when something changed', () => {
  const ledgerPath = tmp();
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 5)] });
  const tracker = createTracker({ adapters: [a], ledgerPath, getRate: () => RATES.default, now: () => 10 });
  tracker.tick();
  const first = fs.statSync(ledgerPath).mtimeMs;
  fs.utimesSync(ledgerPath, new Date(1000), new Date(1000));
  tracker.tick();
  assert.equal(fs.statSync(ledgerPath).mtimeMs, 1000);
  assert.ok(first > 1000);
});

test('totals survive a restart from the saved ledger', () => {
  const ledgerPath = tmp();
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 5)] });
  const mk = (adapters) => createTracker({ adapters, ledgerPath, getRate: () => RATES.default, now: () => 10 });
  const before = mk([a]).tick().allTimeMl;
  const empty = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [] });
  assert.equal(mk([empty]).tick().allTimeMl, before);
});

test('a failing ledger save still yields a snapshot and is retried', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-tracker-'));
  const blocker = path.join(dir, 'not-a-dir');
  fs.writeFileSync(blocker, 'x'); // a file where the data folder should be, so every save fails
  const ledgerPath = path.join(blocker, 'ledger.json');
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 1000, 5)] });
  const tracker = createTracker({ adapters: [a], ledgerPath, getRate: () => RATES.default, now: () => 10 });
  const snap = tracker.tick();
  assert.equal(snap.session.ml, waterMl(usage(1000), RATES.default));
  fs.rmSync(blocker);
  tracker.tick(); // the folder is now creatable: the unsaved ledger is written without any new usage
  assert.ok(fs.existsSync(ledgerPath));
});

test('the early lake level does not depend on the rate preset', () => {
  const a = fake('claude-code', 'Claude Code', { status: 'measured', sessions: [rec('claude-code', 'a', 50000, 5)] });
  const levels = Object.values(RATES).map((rate) => setup([a], 1_000_000, rate).tracker.tick().level);
  assert.ok(levels[0] > 0 && levels[0] < 1);
  for (const l of levels) assert.ok(Math.abs(l - levels[0]) < 1e-9, `levels differ: ${levels}`);
});
