# Contributing to Freshwater

Thanks for helping. Freshwater is a small Electron app in plain JavaScript, with no TypeScript and no build step, so you can read most of it in an afternoon. The app is called Freshwater; the repository is called `codegreen`.

By taking part you agree to follow the [code of conduct](CODE_OF_CONDUCT.md). If you have found a security problem, follow [SECURITY.md](SECURITY.md) instead of opening an issue. For questions, open an issue.

## Ways to help

Much of what the project needs most is something only you can do, because it takes a machine or a tool the maintainer does not have. Some of it needs no code at all.

| If you have | You can help with |
|---|---|
| Gemini CLI installed | [#31](https://github.com/UnforGBeast/codegreen/issues/31): check the adapter against real files |
| Cursor, GitHub Copilot, Aider or Cline | [#30](https://github.com/UnforGBeast/codegreen/issues/30), [#29](https://github.com/UnforGBeast/codegreen/issues/29), [#28](https://github.com/UnforGBeast/codegreen/issues/28): find out what the tool stores locally |
| A Mac or a Linux desktop | [#11](https://github.com/UnforGBeast/codegreen/issues/11) and [#1](https://github.com/UnforGBeast/codegreen/issues/1): check by eye how the widget looks and behaves |
| A better source for a figure | The **Challenge a number** issue form |
| Time to write JavaScript | [#20](https://github.com/UnforGBeast/codegreen/issues/20), [#22](https://github.com/UnforGBeast/codegreen/issues/22), [#33](https://github.com/UnforGBeast/codegreen/issues/33), or anything in the [issue list](https://github.com/UnforGBeast/codegreen/issues) |

## Getting set up

You need Node.js 22 or newer.

```
git clone https://github.com/UnforGBeast/codegreen.git
cd codegreen
npm install
npm test
npm start
```

Two things to know:

- **`npm start` uses your real data.** It reads your real tool logs and writes to your real `~/.freshwater/`. There is no separate development folder, so back up `ledger.json` before you work on anything that writes to it.
- **You can skip Electron for logic work.** `npm ci --ignore-scripts` skips the Electron download. `npm test` still works, but `npm start` does not.

A dev checkout never checks for updates and does not offer "Start at login".

To build an installer for your system, run `npm run dist` (Windows), `npm run dist:mac` or `npm run dist:linux`. Local builds are unsigned.

## How the code is laid out

| Path | What it does | Runs in |
|---|---|---|
| `src/adapters/` | Turns each tool's logs into session totals | Plain Node |
| `src/core/` | Water estimate, lake level, ledger, settings, tracker | Plain Node |
| `src/main/` | Electron main process: windows, menu, updates, preload | Electron |
| `src/renderer/` | The widget and info panel: HTML, CSS and canvas | Browser window |
| `test/` | One test file per module, run with plain Node | Plain Node |
| `scripts/` | Helpers for the release workflow | Plain Node |
| `docs/` | [Methodology](docs/methodology.md) and [releasing](docs/releasing.md) | |
| `docs/superpowers/` | The original design and plan, kept as history. If they disagree with the code, the code is right | |

Every 3 seconds the tracker calls `scan()` on each adapter, merges the results into the ledger and works out the figures. The main process then sends that snapshot to the windows.

## What the project promises

These come from the README, and people rely on them. A pull request that breaks one will not be merged.

1. **Never guess.** A tool without readable token counts is shown as not measured and adds nothing. Do not estimate tokens from text length.
2. **Usage numbers and timestamps only.** Conversation text is never stored, shown or logged. That includes fixtures, tests, issues and pull requests.
3. **Local by default.** There are no accounts and no telemetry, and assets are bundled. The only network request is the opt-in update check. Anything new that uses the network needs an agreed issue first, and must be opt-in and off by default.
4. **Never limit or block token use.**
5. **The fish never die.** The point is to feel responsible for the next prompt, not to feel bad. Art and wording should keep that tone.
6. **Every number has a source, or says it is a judgment call.**

## Changing a figure

Open a **Challenge a number** issue first, with the source. The figures appear in more than one place, so a change touches all of these:

- `src/core/water.js` (weights, energy and rates, plus the comment at the top) or `src/core/lake.js` (the baseline)
- The tests that pin them: `test/water.test.js` and `test/tracker.test.js`
- `README.md`, under "The figure is an estimate"
- `docs/methodology.md`, including the worked example
- `src/renderer/info.html`, which spells out the weights and the 0.6 by hand (the rates are read from `water.js`)

The ledger stores tokens, not water, so a new figure applies to past sessions automatically.

**Be careful with the ledger format.** Once a tool deletes its old logs, `~/.freshwater/ledger.json` is the only copy of those totals. A file that fails validation is moved to `ledger.json.bak` and the app starts fresh, so changing its shape without a migration loses people's all-time figures.

## Adding a tool

Before writing code, confirm that the tool stores token counts for each request somewhere readable. Look at field names and types only, then open a **Measure another tool** issue with what you found. If the tool has no readable counts, that is still a useful result: it gets listed as not measured.

### The adapter contract

An adapter is a factory in `src/adapters/<tool>.js`. It takes the folder to read, so tests can point it somewhere else, and returns `{ tool, label, scan }`:

```js
function createMyToolAdapter(rootDir = path.join(os.homedir(), '.mytool', 'sessions')) {
  // ...
  return { tool: 'my-tool', label: 'My Tool', scan };
}
```

`scan()` takes no arguments and returns this:

```js
{
  status: 'measured', // or 'not-measured'
  sessions: [
    {
      id: 'my-tool:<session id>', // stable from one scan to the next
      tool: 'my-tool',
      startedAt: 1793000000000, // milliseconds since the epoch
      lastActiveAt: 1793000600000,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
  ],
}
```

[`src/adapters/codex.js`](src/adapters/codex.js) is the shortest one to copy.

### Getting the numbers right

- **Return running totals for the whole session on every scan, never only the new tokens.** The ledger keeps the highest value of each field, so a scan that returned only new tokens would be ignored.
- **Count each token once.** Find out how the tool logs before adding anything up. Claude Code repeats a message across lines, so it is counted once per message id. Codex logs a running total, so the last value is used. Gemini CLI appends a message again when its tokens arrive, so the last copy wins.
- **Keep the fields separate.** `input` does not include cached tokens; those go in `cacheRead`. If the tool's input figure includes them, subtract them, as `codex.js` does. Thinking tokens count as `output`.
- **Skip what you cannot split.** A session that logs only a total is left out, not guessed.

### Staying cheap and private

- **Read incrementally.** `scan()` runs in the main process every 3 seconds. Use `createReader` and `createLister` from [`src/adapters/jsonlReader.js`](src/adapters/jsonlReader.js): the reader returns only new complete lines, and the lister walks the folder at most every 30 seconds. Because the reader only returns new lines, the adapter has to keep its own totals between scans. A tool that rewrites a whole file does not fit this reader and needs its own approach (see [#28](https://github.com/UnforGBeast/codegreen/issues/28)).
- **Keep only numbers and timestamps.** Check for a usage marker with `line.includes(...)` before calling `JSON.parse`, and copy out only the fields you need.
- **Report a format you no longer understand.** Count lines that look like usage but cannot be read. If there are some and none could be read, return `not-measured`. See `unrecognised` and `recognised` in the existing adapters.
- **Skip bad lines without throwing.** A half-written line is normal. A tool that is not installed scans nothing and returns `measured` with no sessions.

### Wiring it in

1. Add `guard(createMyToolAdapter())` to `createAdapters()` in [`src/adapters/index.js`](src/adapters/index.js). For a tool with no readable data, add `notMeasured('my-tool', 'My Tool')` and a comment saying what you checked.
2. Add the label to the expected list in `test/registry.test.js`.
3. Add `test/<tool>.test.js`.
4. Add a row to "What is measured" in `README.md` and a line to "How token counts are read" in `docs/methodology.md`. If you built it from source and not from a real install, say so, as the Gemini CLI row does.

### Fixtures

Tests either write sanitized lines to a temporary folder (see `test/codex.test.js`) or read them from `test/fixtures/<tool>/` (see `test/claudeCode.test.js`). Either way, they contain only usage numbers, timestamps and made-up ids. **Never commit a real log, even a trimmed one.**

Cover at least:

- a normal session
- whatever makes the tool easy to double count
- a half-written or malformed line
- an unrecognised format, which must give `not-measured`
- an empty folder

## Code style

There is no linter or formatter, so match the code around you. `.editorconfig` handles whitespace.

- CommonJS, `node:` prefixes on built-in modules, 2 spaces, single quotes, semicolons.
- `src/core` and `src/adapters` never import Electron. Logic in `src/main` that can be tested goes in its own module without Electron too, like `position.js` and `updates.js`.
- Pass in what a module depends on (`rootDir`, `now`, `updater`) so tests need no real clock, home folder or network.
- A failure should degrade, not crash. A bad tick is skipped, and an unwritable data folder keeps showing figures from memory.
- Renderer code has no Node access. It only talks to the main process through `window.freshwater`, defined in `src/main/preload.js`.
- The Content Security Policy blocks inline scripts, inline styles and anything remote. Set text with `textContent`, not `innerHTML`.
- A renderer file that tests also need ends with `if (typeof module !== 'undefined') module.exports = ...`, as `format.js` does.
- Write comments for reasons that are not obvious from the code, not for what it does.
- `electron-updater` is the only runtime dependency. Agree on a new one in an issue first.

## Tests

```
npm test
node --test test/water.test.js
```

The first command runs everything; the second runs one file. Tests use `node:test` and `node:assert/strict`, and none of them need Electron.

New behaviour needs a test, and a bug fix needs a test that fails without the fix. Tests cannot see the widget, so for anything visible, run `npm start` and say in the pull request what you checked and on which system.

## Pull requests

1. For anything bigger than a small fix, comment on an issue or open one first, so your time is not wasted.
2. Branch from `main`, with a short kebab-case name such as `gemini-cli-adapter`.
3. Start commit messages with `feat:`, `fix:` or `docs:`, followed by a lowercase summary in the imperative, such as `fix: keep showing figures when the data folder is unwritable`.
4. Keep each pull request to one concern, and update the docs in the same pull request as the behaviour they describe.
5. Fill in the template. CI runs the tests and builds the installers on Windows, macOS and Linux, and all of it has to pass. If you touch `package.json`, `scripts/`, `build/` or the release workflow, an unsigned dry run of the release runs too.

Releases are handled by the maintainer; see [docs/releasing.md](docs/releasing.md).

## License

Freshwater is [MIT licensed](LICENSE), and your contributions are accepted under the same license. Anything you add from elsewhere, such as fonts or art, must have a compatible license and be bundled with the app, like the font in `src/renderer/FONT-LICENSE.txt`.
