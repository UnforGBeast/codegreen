# Freshwater Widget: Design

**Status:** draft, awaiting approval
**Mockup:** `.superpowers/brainstorm/1588-1793640568/content/lake-fish-v2.html` (the approved look)

Items marked **[Ata]** were decided by the project owner. Items marked **[builder call]** were chosen during design and can still be challenged.

## Why this exists

AI coding feels free because its cost is invisible. This widget makes one cost visible while you work, so people feel responsible for the tokens they use. **[Ata]**

It succeeds if someone glances at it mid-session and thinks about whether the next prompt is worth it.

## What it is

A small floating 8-bit widget that stays on top of whatever you are working in. It shows a pixel lake with fish that dries up as a coding session uses tokens, plus three figures: freshwater used this **session**, **all time**, and on **average**. **[Ata]**

Target tools named by the owner: VS Code, cmd, Claude Desktop, Codex Desktop and Antigravity. **[Ata]**

## Goals

- Stay on top of other windows, be draggable, and remember its position.
- Update within a few seconds of new tokens being logged.
- Show exact token-based estimates for every tool that exposes token counts.
- Be honest that the water figure is an estimate, and show where the rate comes from. **[Ata: estimating is fine]**
- Work for other developers, not only the owner. **[Ata]**

## Non-goals

- Reading, storing or displaying conversation text. Only usage numbers are read.
- Sending anything over the network: no accounts, telemetry or leaderboards.
- Limiting or blocking token use. The widget informs, it never interferes.
- Cost tracking in money.

## Anti-goals

These would make it a failure even if it worked:

- **Invented numbers.** A tool with no token data shows "not measured", never a guess. **[Ata]**
- **False precision.** Water figures are always labelled as estimates and rounded sensibly.
- **Cruelty.** The fish get stranded and flop, but they never die. The aim is responsibility, not distress.
- **Waste.** A sustainability widget that burns CPU defeats itself. See Constraints.

## Tool coverage

Findings from checking the owner's Windows machine on 2026-11-02:

| Tool | Local data | Status |
|---|---|---|
| Claude Code (CLI, VS Code extension) | `~/.claude/projects/**/*.jsonl`, `message.usage` | Measured |
| Codex | `~/.codex/sessions/**/*.jsonl`, `token_count` events with `payload.info.total_token_usage` | Measured |
| Antigravity | `~/.gemini/antigravity/`. No readable counts found; `conversations/` not yet inspected | Not measured |
| Claude Desktop chat | Store package with no local conversation logs found | Not measured |

Not measured means the tool is listed in the info panel as "not measured" and contributes nothing to any figure. **[Ata]**

Adapters must be pluggable, one per tool, so that Antigravity or others can be added if a readable source appears. **[builder call]**

## Parsing rules

- **Claude Code:** the same `message.id` repeats across log lines. In the owner's logs 12,519 of about 22,000 usage lines were duplicates. Deduplicate by `message.id` or totals will be badly inflated.
- **Codex:** `total_token_usage` is cumulative, so take the last value in a session, never the sum. Verify whether `input_tokens` already includes `cached_input_tokens` before weighting.
- Tolerate malformed or half-written lines, because logs are read while being appended to.
- Treat log formats as unstable. A parse failure shows that tool as "not measured" rather than crashing or showing wrong numbers.

## Water estimate

```
weighted tokens = output × 1 + input × 0.1 + cache write × 0.1 + cache read × 0.001
energy (Wh)     = weighted tokens / 1000 × 0.6
water (mL)      = energy (Wh) × water rate (mL per Wh)
```

**Token weights [builder call].** These are judgment values, not sourced figures. Cached tokens are about 98% of the owner's Claude Code total, so counting them fully would swamp everything else.

**Energy: 0.6 Wh per 1,000 tokens [builder call].** Derived from Epoch AI's estimate of about 0.3 Wh per ChatGPT query, assuming a 500-token response. The 500-token figure comes from a secondary source and was not confirmed in Epoch's article, so check it during the build.

**Water rate [builder call].** Three presets, adjustable in the info panel:

| Preset | mL per Wh | Basis |
|---|---|---|
| Low | 1.08 | Google's 0.26 mL / 0.24 Wh per median Gemini prompt. Critics say it omits indirect water |
| Default | 1.8 | U.S. national average cited in the Li et al. preprint (v1) |
| High | 3.8 | Comparison training site in the same preprint |

Check the Li et al. values against the paper during the build, as they differ between versions and were read from search summaries.

**Sanity check.** Applied to the owner's logs, the default gives about 9.2 kWh and about 16.6 L across 118 Claude Code sessions, or about 140 mL per session.

## Behaviour

**[builder call]** for everything in this section.

- **Session:** the most recently active session across measured tools. The widget shows a small tag for which tool it is.
- **All time:** every measured session, backfilled from existing logs on first run.
- **Average:** mean water per session.
- **Lake level:** session water ÷ (2 × the user's average), capped at 1. An average session leaves the lake half gone, so it compares you against yourself. Until 5 sessions exist, use a baseline of 140 mL.
- **Stages:** follow the mockup. Fish jump below 0.4, the sky turns hazy above 0.6, and fish are stranded above 0.8.
- **New session:** the lake refills.
- **No active session:** show the last session's state, calm and unanimated.
- **Ledger:** keep per-session totals in `~/.freshwater/ledger.json`, because tools may prune old logs and all-time figures must survive that. Totals and timestamps only, never content.

## Interface

- Scene and three rows as in the mockup, 204 px wide, with an `EST.` label visible at all times.
- Clicking opens an info panel: water rate preset, the formula, sources, and each tool's measured or not-measured status.
- Close from a right-click menu, with an option to start with Windows.
- Respect the system's reduced-motion setting.

## Constraints and how it gets made

**[builder call]** for all of these.

- **Stack:** Electron with plain JavaScript and canvas. Node is already installed, Rust is not, and Electron gives a transparent, frameless, always-on-top window directly.
- **Platform:** Windows first. Paths come from the home directory, so macOS and Linux should need little extra work, but they are not a launch target.
- **Resource use:** draw at 8 frames per second, stop drawing when hidden, and read only the new bytes of changed logs. Aim for under 1% CPU when idle. Electron's memory use is the known cost of this choice.
- **Testing:** unit tests for parsers and the water formula against sanitized fixture logs, including duplicates and half-written lines. Fixtures contain no real conversation text.

## Left to the builder

- Project layout, file-watching approach and packaging.
- Whether Antigravity's `conversations/` folder holds readable counts.
- Whether Claude Desktop's code features write to `~/.claude/projects`. If they do, they are already covered.
- Which units to show as values grow, for example mL to L.
