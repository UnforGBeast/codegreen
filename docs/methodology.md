# Methodology

Freshwater shows an **estimate** of the freshwater used by the AI tokens your coding tools have logged on this computer. This page says exactly how the number is made, where each input comes from, how sure we are of it, and what it leaves out. The aim is that you can check it, and change it if you disagree.

**In one sentence:** it is a rough order-of-magnitude figure, good for noticing that a session was heavy, not for reporting a precise litre count.

## What it computes

```
weighted tokens = output x 1
                + input x 0.1
                + cache write x 0.1
                + cache read x 0.001

energy (Wh) = weighted tokens / 1000 x 0.6
water (mL)  = energy (Wh) x water rate (mL per Wh)
```

The code is in [`src/core/water.js`](../src/core/water.js) and is covered by tests.

### Worked example

A made-up session: 5,000 input, 50,000 output, 5,000,000 cache-read and 200,000 cache-write tokens.

| Part | Tokens | Weight | Weighted |
|---|---:|---:|---:|
| Output | 50,000 | 1 | 50,000 |
| Cache write | 200,000 | 0.1 | 20,000 |
| Cache read | 5,000,000 | 0.001 | 5,000 |
| Input | 5,000 | 0.1 | 500 |
| **Total** | | | **75,500** |

75,500 weighted tokens is 45.3 Wh, which is **49 mL** at the Low rate, **192 mL** at Default and **256 mL** at High.

Cache reads are 95% of the raw tokens here but only about 7% of the weighted total. The estimate is driven by output tokens and cache writes.

## The inputs, and how much to trust each

| Input | Value | Source | Confidence |
|---|---|---|---|
| Token counts | per session | Your tool's own logs | High, where a tool logs them |
| Token weights | 1 / 0.1 / 0.1 / 0.001 | **Judgment**, not a sourced figure | Low |
| Energy per weighted token | 0.6 Wh per 1,000 | Derived from Epoch AI (below) | Low to medium |
| Water per Wh | 1.08 / 4.23 / 5.64 mL | Published figures combined with the paper's formula (below) | Low to medium |

### Token weights (judgment)

Cached tokens are about 98% of Claude Code's raw volume. On the author's logs, cache reads were 98.2% of all tokens. Counting them at full weight would make the figure almost entirely about cache reads, which are far cheaper to serve than generating new text. So they are weighted at 0.001, and input and cache writes at 0.1, against 1 for output.

These weights are not measured. They reflect the idea that generating a token costs more than reading one, and that a cache hit costs much less than processing fresh input. See [what could be wrong](#what-could-be-wrong) for which way this probably errs.

### Energy: 0.6 Wh per 1,000 weighted tokens

Epoch AI estimated that a typical ChatGPT query on GPT-4o uses about **0.3 Wh**. That estimate assumes **500 output tokens** per query, 100 billion active parameters, H100 GPUs drawing about 1,500 W at roughly 70% of peak on average, and 10% utilisation. 0.3 Wh over 500 tokens is 0.6 Wh per 1,000 output tokens, which is where the 0.6 comes from. The weights then scale other token types against output.

Source: Josh You, ["How much energy does ChatGPT use?"](https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use), Epoch AI, 7 February 2025.

Caveats from the same article, which matter here:

- The author calls 0.3 Wh "relatively pessimistic" for a typical chat query, and says other assumptions give anything from about 0.1 Wh up to 1 to 4 Wh.
- It is a GPT-4o estimate. The models behind the tools Freshwater reads are different and their size and hardware are not public. Applying this figure to them is an assumption.
- Long inputs cost far more. The article puts a 10,000-token input at around 2.4 to 2.5 Wh and a 100,000-token input at almost 40 Wh, and says reasoning models likely use substantially more than 0.3 Wh.

### Water per Wh: three presets

You choose one in the info panel. Li et al. split a data centre's operational water into two parts and add them:

```
water = server energy x [ on-site cooling water (WUE)  +  PUE x electricity water (EWIF) ]
```

- **Cooling water** is evaporated on site to remove heat.
- **Electricity water** is used at power stations to make the electricity. PUE is the data centre's overhead factor, so the electricity it draws is more than the servers' own.

For their U.S. average the paper uses WUE 0.55 L/kWh, PUE 1.17 and EWIF 3.142 L/kWh. A kilowatt-hour is a thousand watt-hours, so litres per kWh are the same number as millilitres per Wh.

| Preset | mL per Wh | What it counts |
|---|---:|---|
| Low | 1.08 | **Cooling water only.** Google reports 0.26 mL and 0.24 Wh for a median Gemini text prompt, and says it derived the water by multiplying energy by its fleetwide water usage effectiveness. It leaves out the water used to generate the electricity, which critics have pointed out. |
| Default | 4.23 | **Cooling plus electricity water**, U.S. average from Li et al.: 0.55 + 1.17 x 3.142. |
| High | 5.64 | **Cooling plus electricity water**, using the higher electricity factor of 4.35 L/kWh that the paper says another study reported: 0.55 + 1.17 x 4.35. |

Low is a deliberate lower bound that counts only part of the cost. Default and High count the full operational water and differ only in the electricity factor. None of them includes water used to build the hardware.

Sources:

- Li, Yang, Islam and Ren, ["Making AI Less Thirsty"](https://arxiv.org/abs/2304.03271), arXiv 2304.03271, **version 5** (26 March 2025). The formula, the U.S. averages and the 4.35 L/kWh figure were read from this version's text and Table 1. As a check, the paper's U.S. average row works out to 16.9 mL of water for a 4 Wh request, which is 4.23 mL per Wh.
- Google Cloud, a blog post on [measuring the environmental impact of AI inference](https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference) (August 2025). The 0.26 mL and 0.24 Wh figures were checked against the blog and secondary coverage, not the full paper.

The paper itself says its numbers lean low: Microsoft's data centres "already have some of the lowest on-site WUE in the industry", and a third-party colocation data centre would likely use several times more cooling water.

**History.** Earlier versions of Freshwater used 1.8 and 3.8 mL per Wh from version 1 of the paper. Those were not like-for-like: 1.8 was only the bare electricity factor, with no cooling water and no PUE, and 3.8 was a cooling-only figure. Version 5 no longer contains them. Moving to the combined figure raised the Default by a factor of 2.35, so any totals you remember from an older build were about 2.35 times lower. Your saved ledger stores token counts, not water, so every figure is recalculated automatically. This was tracked in [#25](https://github.com/UnforGBeast/codegreen/issues/25).

## What could be wrong

The error runs in both directions, and the width of it is large.

- **Water rate alone** spans a factor of 5 between Low and High, mostly because Low counts only cooling water.
- **Cache reads are probably under-weighted for long sessions.** A cache hit saves reprocessing the prompt, but the model still reads that context for every token it generates, so long conversations cost more than a tiny weight implies. Epoch's long-input figures are several times higher than this model gives for the same input (10,000 input tokens is 0.6 Wh here against about 2.4 Wh in Epoch's estimate). In the worked example, raising the cache-read weight from 0.001 to 0.01 lifts the Default result from 192 mL to 306 mL.
- **Reasoning and agentic work** can use more energy per token than a short chat answer.
- **Efficiency is improving.** Google reports its median text prompt energy fell 33-fold over a year, so older estimates can overstate current use.
- **A different model and hardware** from the GPT-4o assumption could move the energy either way.

The honest reading is a wide range, with the stated figure somewhere in the middle of it.

## What it leaves out

- Water used to build the hardware, and water used for training.
- Your own device and the network.
- Tools that do not log readable token counts: Antigravity and Claude Desktop chat are shown as **not measured** and add nothing.
- Codex sessions that log only a total with no input and output split. They are not counted rather than guessed.
- Usage from before the logs were kept. On first run it backfills from the logs that still exist, then keeps its own ledger so later log deletion does not lower your all-time figure.

## How the lake level is derived

The lake compares a session against **your own average**:

```
level = min(1, session water / (2 x average water per session))
```

So an average session leaves the lake half gone, and a session twice your average empties it. Until you have 5 sessions it uses a baseline of about 78 Wh of energy per session (140 mL at the original 1.8 mL per Wh), turned into millilitres at the rate you chose, so the lake looks the same whichever preset you pick. That baseline was taken from an early count that overstated the number of sessions, and is tracked for revision in [#10](https://github.com/UnforGBeast/codegreen/issues/10).

| Level | What you see |
|---|---|
| below 0.4 | Fish swim and jump |
| above 0.6 | The sky turns hazy |
| above 0.8 | The fish are stranded and flop on the mud (they never die) |

A session counts as active for 5 minutes after its last logged activity. When none is active the widget shows the last session's state, still and calm.

## How token counts are read

- Only usage numbers and timestamps are read. Conversation text is never stored or shown.
- Claude Code repeats the same message id across log lines and files, so tokens are counted once per message id. Without this, totals were badly inflated: on the author's logs 12,519 of about 22,000 usage lines were duplicates.
- Codex logs a running total, so the last value in a session is used, never a sum.
- Half-written lines are picked up whole on the next read. Unparseable formats show the tool as not measured.

## Disagree with a number?

Open an issue with the figure you think is better and its source. The weights, the energy constant and the rates are single values in [`src/core/water.js`](../src/core/water.js). Making them adjustable in settings is tracked in [#12](https://github.com/UnforGBeast/codegreen/issues/12).
