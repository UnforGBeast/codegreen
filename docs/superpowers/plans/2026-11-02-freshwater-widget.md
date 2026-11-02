# Freshwater Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a floating 8-bit lake widget that turns local AI coding token logs into an estimated freshwater figure for the session, all time, and on average.

**Architecture:** Electron main process polls per-tool adapters, merges sessions into a local ledger, and pushes a snapshot to a canvas renderer. All calculation lives in pure modules under `src/core` and `src/adapters`, so it is tested with plain Node and never needs Electron.

**Tech Stack:** Electron, plain CommonJS JavaScript, HTML canvas, `node:test`. No other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-freshwater-widget-design.md`

## Global Constraints

- Never store, display or log conversation text. Adapters parse a line only to take its usage numbers, then discard it. Ledger holds totals and timestamps only.
- No network calls at runtime: no accounts, telemetry or leaderboards.
- The widget never limits or blocks token use.
- A tool with no token data, or whose parse fails, shows "not measured" and adds nothing to any figure. Never a guess.
- Water figures always carry an `EST.` label on screen.
- Fish never die.
- Draw at 8 frames per second, stop drawing when hidden, read only new bytes of changed logs, aim for under 1% CPU when idle.
- Widget is 204 px wide. Pixel scene is 64×48 drawn at 192×144.
- Respect the system's reduced-motion setting.
- Windows first. All paths derive from `os.homedir()`.
- Test fixtures contain no real conversation text.

## Review Focus

1. A log is still being written when read, so the last line is partial. It must be picked up complete on the next read, neither lost nor double-counted.
2. Tools delete old logs. All-time figures must not fall when a session's log disappears.
3. A log shrinks or is replaced, so a saved read position points past the end. Re-read it from the start instead of reading nothing forever.
4. `ledger.json` or `settings.json` is corrupt or half-written after a crash. Keep the bad file as `.bak`, start fresh, rebuild from logs, and never crash.
5. A saved window position is off-screen after a monitor is unplugged. The widget must return to a visible place.

---

## Shared types

```
Usage         = { input, output, cacheRead, cacheWrite }   // all numbers
SessionRecord = { id, tool, startedAt, lastActiveAt, usage: Usage }  // ms epoch; id = "<tool>:<sessionId>"
AdapterResult = { status: 'measured'|'not-measured', sessions: SessionRecord[] }
Adapter       = { tool, label, scan(): AdapterResult }  // stateful, incremental; never throws
Snapshot      = { session: {tool, ml, active}|null, allTimeMl, averageMl, level, rate, tools: [{label, status}] }
```

---

### Task 1: Project setup and water estimate

**Files:**
- Create: `package.json`, `.gitignore`, `src/core/water.js`, `src/core/lake.js`
- Test: `test/water.test.js`, `test/lake.test.js`

**Interfaces:**
- Produces: `RATES = {low:1.08, default:1.8, high:3.8}`, `weightedTokens(usage): number`, `waterMl(usage, rate): number`, `lakeLevel(sessionMl, averageMl, sessionCount): number`, `sceneState(level): {jump, haze, stranded}`

- [ ] **Step 1: Set up the project.** Run `git init`, then `npm init -y`, then `npm i -D electron`. Set `"main": "src/main/main.js"`, `"scripts": {"start": "electron .", "test": "node --test test/"}`. `.gitignore`: `node_modules/`, `.superpowers/`, `dist/`.

- [ ] **Step 2: Check the rates against their sources.** Fetch Epoch AI's article and arXiv 2304.03271. Confirm the 500-token assumption and the 1.8 and 3.8 L/kWh values. If any differ, stop and report them, because the spec's figures would need changing.

- [ ] **Step 3: Write the failing tests.**

```js
const owners = {input:19927, output:8343417, cacheRead:2731736180, cacheWrite:42832568};
test('weights tokens', () => assert.equal(weightedTokens({input:1000,output:1000,cacheRead:1000,cacheWrite:1000}), 1201));
test('default rate on owner totals gives about 16.6 L', () =>
  assert.ok(Math.abs(waterMl(owners, RATES.default) - 16580) < 100));
test('zero usage is zero water', () => assert.equal(waterMl({input:0,output:0,cacheRead:0,cacheWrite:0}, RATES.default), 0));
test('average session is half gone', () => assert.equal(lakeLevel(100, 100, 5), 0.5));
test('caps at 1', () => assert.equal(lakeLevel(900, 100, 5), 1));
test('uses 140 mL baseline under 5 sessions', () => assert.equal(lakeLevel(140, 9999, 4), 0.5));
test('zero average with 5 sessions falls back to baseline', () => assert.equal(lakeLevel(0, 0, 5), 0));
test('stage boundaries', () => {
  assert.deepEqual(sceneState(0.39), {jump:true, haze:false, stranded:false});
  assert.deepEqual(sceneState(0.61), {jump:false, haze:true, stranded:false});
  assert.deepEqual(sceneState(0.81), {jump:false, haze:true, stranded:true});
});
```

- [ ] **Step 4: Run `npm test`.** Expected: FAIL, modules not found.

- [ ] **Step 5: Implement `src/core/water.js` and `src/core/lake.js`.** Weights 1 / 0.1 / 0.1 / 0.001, then 0.6 Wh per 1,000 weighted tokens, then multiply by rate.

- [ ] **Step 6: Run `npm test`.** Expected: PASS.

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat: add water estimate and lake level"`

---

### Task 2: Incremental log reader and Claude Code adapter

**Files:**
- Create: `src/adapters/jsonlReader.js`, `src/adapters/claudeCode.js`
- Test: `test/jsonlReader.test.js`, `test/claudeCode.test.js`, `test/fixtures/claude/`

**Interfaces:**
- Consumes: `Usage`, `SessionRecord`, `AdapterResult`
- Produces: `createReader(): {readNew(filePath): string[]}` returns complete new lines only. `createClaudeCodeAdapter(rootDir = ~/.claude/projects): Adapter` with `tool:'claude-code'`, `label:'Claude Code'`.

- [ ] **Step 1: Write the failing reader tests.** Using temp files:
  - `returns complete lines only`: write `a\nb`, expect `['a']`; append `c\n`, expect `['bc']`.
  - `reads only new bytes`: second call with no change returns `[]`.
  - `re-reads a shrunk file`: replace with shorter content, expect all its lines.
  - `missing file returns empty`.

- [ ] **Step 2: Write the failing adapter tests** with fixtures of sanitized lines (`{"sessionId","timestamp","message":{"id","model","usage":{...}}}`, no text):
  - `dedupes repeated message.id`: same id on two lines counts once.
  - `dedupes across files`: a subagent file with the same `sessionId` and repeated id adds nothing.
  - `groups by sessionId`: two ids in one folder give two records.
  - `skips malformed lines`: fixture with a bad line still parses the rest.
  - `missing root is measured with no sessions`: returns `{status:'measured', sessions:[]}`.
  - `unrecognisable format is not-measured`: a file of valid JSON with `message.usage` present but no numeric fields returns `status:'not-measured'`.
  - `second scan adds only new usage`: append a line, scan again, totals grow by exactly that line.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL.

- [ ] **Step 4: Implement both modules.** Before `JSON.parse`, skip lines without `"usage"` so most lines are never parsed. Map `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`. `startedAt` and `lastActiveAt` come from line `timestamp`. Wrap `scan` so it never throws. Keep seen ids in a `Set` for the process lifetime.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Check against real logs.** From a throwaway script printing totals only, confirm about 9,523 unique messages and 8.34M output tokens, allowing for sessions added since 2026-11-02.

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat: add Claude Code adapter"`

---

### Task 3: Codex adapter and tool registry

**Files:**
- Create: `src/adapters/codex.js`, `src/adapters/index.js`
- Test: `test/codex.test.js`, `test/registry.test.js`, `test/fixtures/codex/`

**Interfaces:**
- Consumes: `createReader`, `createClaudeCodeAdapter`
- Produces: `createCodexAdapter(rootDir = ~/.codex/sessions): Adapter` with `tool:'codex'`, `label:'Codex'`. `createAdapters(): Adapter[]` returning Claude Code, Codex, and fixed entries for `Antigravity` and `Claude Desktop chat` whose `scan()` returns `{status:'not-measured', sessions:[]}`.

- [ ] **Step 1: Settle the Codex fields from real logs.** With a totals-only script, check across all sessions whether `total_tokens === input_tokens + output_tokens` and `cached_input_tokens <= input_tokens`. If both hold, input includes cached and output includes reasoning, so `Usage.input = input_tokens - cached_input_tokens`, `Usage.cacheRead = cached_input_tokens`, `Usage.output = output_tokens`, `Usage.cacheWrite = 0`. If either fails, stop and report.

- [ ] **Step 2: Write the failing tests:**
  - `takes the last cumulative value`: 3 `token_count` lines with rising totals give the last, not the sum.
  - `ignores token_count with null info`.
  - `subtracts cached from input`.
  - `session id comes from the filename`.
  - `skips malformed lines`.
  - `registry lists all four tools` and `not-measured tools add no sessions`.
  - `one adapter failing leaves the others working`: an adapter whose internals throw returns `not-measured`.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL.

- [ ] **Step 4: Implement both modules.** Read only `payload.info.total_token_usage`.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Inspect Antigravity and Claude Desktop.** Check `~/.gemini/antigravity/conversations/` file formats and whether Claude Desktop code features write under `~/.claude/projects`, looking at types and field names only. Record the outcome in a comment in `src/adapters/index.js`. Leave both not-measured unless numbers are plainly readable, and report if they are.

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat: add Codex adapter and tool registry"`

---

### Task 4: Ledger, settings and snapshot

**Files:**
- Create: `src/core/ledger.js`, `src/core/settings.js`, `src/core/tracker.js`
- Test: `test/ledger.test.js`, `test/settings.test.js`, `test/tracker.test.js`

**Interfaces:**
- Consumes: `Adapter`, `waterMl`, `lakeLevel`, `RATES`
- Produces:
  - `loadLedger(path): Ledger`, `saveLedger(path, ledger)`, `mergeSessions(ledger, SessionRecord[])`. `Ledger = {version:1, sessions:{[id]:SessionRecord}}`.
  - `loadSettings(path): {ratePreset:'low'|'default'|'high', x?, y?}`, `saveSettings(path, settings)`.
  - `createTracker({adapters, ledgerPath, getRate, now}): {tick(): Snapshot}`. `ACTIVE_MS = 300000`.
  - Default folder `~/.freshwater/`.

- [ ] **Step 1: Write the failing tests:**
  - `merge keeps the higher value per usage field`: re-merging older data never lowers a total.
  - `pruned session stays in all-time`: a session absent from the next scan remains in the ledger and totals.
  - `corrupt ledger is kept as .bak and starts empty`.
  - `save is atomic`: writes a temp file then renames.
  - `corrupt settings fall back to default preset`.
  - `ledger contains only known fields`: unknown keys on a record are not written.
  - `session is the most recent lastActiveAt across tools`.
  - `active is false after 5 minutes`, and `session` stays populated so the last state shows.
  - `average is all-time water over session count`.
  - `empty ledger gives a null session and zeros`.
  - `changing rate recalculates all figures`, because the ledger stores tokens, not mL.
  - `tools lists each adapter's status`.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.

- [ ] **Step 3: Implement the three modules.** `tick()` saves the ledger only when something changed. Field-wise max in `mergeSessions` is what protects against pruned or reset logs.

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: add ledger, settings and tracker"`

---

### Task 5: Floating window and live widget

**Files:**
- Create: `src/main/main.js`, `src/main/position.js`, `src/main/preload.js`, `src/renderer/widget.html`, `src/renderer/widget.js`, `src/renderer/scene.js`, `src/renderer/format.js`
- Test: `test/position.test.js`, `test/format.test.js`

**Interfaces:**
- Consumes: `createAdapters`, `createTracker`, `loadSettings`, `saveSettings`, `Snapshot`, `sceneState`
- Produces: `safePosition(saved, displays, size): {x, y}`, `formatWater(ml): string`, `drawLake(ctx, level, tick, state)`. Preload exposes `window.freshwater = {onSnapshot(cb), openMenu()}`.

- [ ] **Step 1: Write the failing tests:**
  - `formatWater`: `0` → `0 mL`, `412.4` → `412 mL`, `999.6` → `1.0 L`, `38600` → `38.6 L`, `1250000` → `1,250 L`.
  - `safePosition keeps a visible position`.
  - `safePosition moves an off-screen position to the primary display's bottom right`.
  - `safePosition uses bottom right when nothing is saved`.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.

- [ ] **Step 3: Implement `format.js` and `position.js`.**

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Implement `main.js`.** Frameless, transparent, `alwaysOnTop: true` at level `screen-saver`, `skipTaskbar: true`, not resizable, `contextIsolation: true`, `nodeIntegration: false`. Enforce a single instance. Every 3 seconds run `tracker.tick()` and send the snapshot; adapters do a full directory walk at most every 30 seconds and otherwise stat files they already know. Save position on move, debounced. Right-click menu: Info, Start with Windows (`app.setLoginItemSettings`), Quit.

- [ ] **Step 6: Implement the renderer.** Port `lake`, `drawFish` and the sprites from `.superpowers/brainstorm/1588-1793640568/content/lake-fish-v2.html` into `scene.js`, using `sceneState(level)` for the thresholds. The approved look is that file. Show the SESSION, ALL TIME and AVERAGE rows, an always-visible `EST.` label, and a small tool tag. Animate at 125 ms per frame only when the session is active, reduced motion is off and the page is visible; otherwise draw one still frame on each snapshot. Bundle the pixel font locally under `src/renderer/` so nothing is fetched at runtime, because of the no-network rule. Use CSS `-webkit-app-region: drag` on the canvas only, because a drag region swallows clicks; the rows are `no-drag` and open Info on click. Show the right-click menu from both areas: the renderer's `contextmenu` event on the rows, and `system-context-menu` on the main window for the canvas, calling `preventDefault()` to suppress the Windows system menu.

- [ ] **Step 7: Run it.** `npm start`. Expected: the widget stays above VS Code and a cmd window, drags, reopens where it was left, and the session number rises within a few seconds of a Claude Code reply.

- [ ] **Step 8: Measure idle cost.** With no active session, check CPU in Task Manager for 2 minutes. Expected: under 1%. Report the memory figure.

- [ ] **Step 9: Commit.** `git add -A && git commit -m "feat: add floating lake widget"`

---

### Task 6: Info panel and packaging

**Files:**
- Create: `src/renderer/info.html`, `src/renderer/info.js`, `README.md`
- Modify: `src/main/main.js`, `src/main/preload.js`, `package.json`

**Interfaces:**
- Consumes: `Snapshot`, `RATES`, `saveSettings`
- Produces: preload adds `getRates()` and `setRatePreset(preset)`. Clicking the rows or choosing Info from the menu opens the panel.

- [ ] **Step 1: Build the panel.** A small non-transparent window with: the three rate presets and their basis, the formula, the sources from the spec as text, and each tool's Measured or Not measured status. Changing a preset updates the widget at the next tick and persists. External sources are plain text, so the panel makes no network calls.

- [ ] **Step 2: Add packaging.** `npm i -D electron-builder`, with `"build"` config for a Windows NSIS installer and a `"dist"` script.

- [ ] **Step 3: Write `README.md`.** What it is, install, what is measured and not, that the figure is an estimate and how it is calculated, and that nothing leaves the computer.

- [ ] **Step 4: Verify.** Run `npm test` (expected PASS) and `npm run dist` (expected installer in `dist/`). Install it and confirm it starts, shows all-time figures backfilled from logs, and that changing a preset changes the numbers.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: add info panel and installer"`
