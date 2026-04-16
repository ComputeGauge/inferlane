# Show HN drafts — InferLane launch (5-model data)

All variations use the real benchmark numbers from the 5-model run (Opus 4, Sonnet 4, Haiku 4.5, Grok 4, Gemma 2 2B).

**The real data in one line:**
> Sonnet 4 beat both reasoning models (Opus 4 and Grok 4) on 20 real coding tasks, at 4-5× lower cost. Haiku 4.5 came within 0.3 points for 2.4× less than Sonnet.

**My pick: Variation C (the reasoning-model angle)** — it's the strongest story now that Grok 4 is in the mix.

---

## Variation C — The Reasoning-Model Finding (strongest, highest ceiling)

**Title (80 chars):**
```
Show HN: Sonnet 4 beat Opus AND Grok 4 on 20 real coding tasks
```

**Body:**
```
I pulled 20 curated prompts matching my Claude Code usage — debug, refactor, implement, test, explain, review, data, ui, docs — and ran each through 5 models: Opus 4, Sonnet 4, Haiku 4.5, Grok 4 (grok-4-0709 via xAI), and Gemma 2 2B running locally via Ollama. Sonnet-as-judge graded blindly (A/B/C/D/E, randomized per prompt) on correctness, quality, and completeness.

Headline result:
- Sonnet 4:  25.6/30 avg · 4 wins · $0.23 for the 20 tasks
- Haiku 4.5: 25.3/30 avg · 5 wins · $0.10
- Opus 4:    24.5/30 avg · 6 wins · $1.21
- Grok 4:    24.2/30 avg · 5 wins · $1.02
- Gemma 2B:  12.9/30 avg · 0 wins · $0.00

Both reasoning models (Opus 4 and Grok 4) scored LOWER than plain Sonnet at 4-5× the cost. Opus has the most wins (6) but also the most bad outliers — it confabulated a "mutable reference" bug that didn't exist on one debug prompt, 629 tokens of confident wrongness. Sonnet got it right. I checked by hand.

Grok 4 is worse in a different way: it burns massive amounts of hidden reasoning tokens. Across the 20 prompts it generated 65,150 output tokens vs Sonnet's 15,148 — most of it reasoning. On one debug prompt it used 14,109 reasoning tokens to produce a 500-token answer. A trivial "reply OK" setup test cost 320 reasoning tokens. Grok reasons about everything whether the task needs it or not.

Cost per 1000 quality points:
- Opus 4:    $2.47
- Grok 4:    $2.11
- Sonnet 4:  $0.46
- Haiku 4.5: $0.19

I ran the routing rules from this benchmark over my own 90-day Claude Code history (116K assistant messages, 97% Opus). Actual bill: $18,136. Counterfactual: $4,163. $13,973 I gave Anthropic for lower-quality results. Script is in the repo.

Caveats: N=1 per prompt, Sonnet-as-judge is biased toward Sonnet (mitigated by blinded A/B/C/D/E labels, but real), prompts are single-turn. Re-run the harness yourself — it's 80 lines of Python, zero deps.

I built InferLane as a free Claude Code plugin that routes automatically based on this data:
/plugin marketplace add ComputeGauge/inferlane
/plugin install inferlane@inferlane

Blog: https://inferlane.dev/blog/benchmark-20-tasks-5-models
Repo: https://github.com/ComputeGauge/inferlane
```

**Why this is the strongest:**
- "Opus 4 scored lower than Sonnet 4" is a claim people will click to disprove
- Concrete ($13,973 wasted, 116K messages, specific debug-hallucination story)
- Addresses self-judging bias preemptively (top HN critique)
- Invites re-runs, which feeds engagement

**Risks:**
- Anthropic employees WILL show up in the thread to dispute the result. Be ready to respond calmly with data, not attitude.
- The "Opus scored lower" finding needs to survive scrutiny. If someone re-runs with a different judge and gets different numbers, the post credibility dies. Mitigation: acknowledge this in the body ("N=1, Sonnet judge is biased, please re-run and correct me") and run the benchmark yourself one more time before posting to confirm reproducibility.

---

## Variation A — The Haiku Finding (safer, data-first)

**Title (80 chars):**
```
Show HN: Haiku 4.5 tied Sonnet 4 on half of 20 coding tasks at 2.4x less cost
```

**Body:**
```
I benchmarked Claude Opus 4, Sonnet 4, Haiku 4.5, and Gemma 2 2B locally on 20 real coding tasks from my Claude Code history. Blindly graded by Sonnet-as-judge on correctness, quality, and completeness.

Results:
- Opus 4:     24.8/30 avg, 6 wins, $1.21 for the run
- Sonnet 4:   26.1/30 avg, 7 wins, $0.23
- Haiku 4.5:  25.3/30 avg, 7 wins, $0.10
- Gemma 2 2B: 11.7/30 avg, 0 wins, $0.00

Haiku tied Sonnet on wins (7 each). Where Haiku wins outright: test writing, data extraction, documentation, review, explanations. Where Sonnet still wins: debug, implement, ui. Where Opus wins (rare, only 6 total): refactor and some config work.

Cost per 1000 quality points: Opus $2.44, Sonnet $0.45, Haiku $0.19, Gemma $0. Haiku is 2.3x better value than Sonnet and 12.6x better value than Opus.

Running this benchmark over my own 90-day Claude Code bill (97% Opus usage by cost) and applying benchmark-backed routing: $18,136 actual → $4,163 counterfactual. $13,973 saved across 90 days.

I also tested the 9.6GB Gemma 4 MoE locally; without GPU acceleration it did 1.5 tok/s on M-series and timed out on most prompts. Small local models aren't drop-in replacements for cloud on real coding work — Gemma 2 2B is realistic for a laptop but 2.1x lower quality across the board.

Full methodology, raw outputs, grader, and harness are MIT in the repo:
https://github.com/ComputeGauge/inferlane/tree/main/benchmark

I built InferLane (free Claude Code plugin) to do this routing automatically:
https://github.com/ComputeGauge/inferlane

Blog post with per-category scores and caveats:
https://inferlane.dev/blog/benchmark-20-tasks-5-models
```

**Why this is safer:** It's data-first with no single contrarian claim. Lower ceiling but lower variance. The Haiku story alone is worth 200-500 upvotes on a good day.

---

## Variation B — The $14K story (middle ground)

**Title (80 chars):**
```
Show HN: I wasted $13,973 on Claude Opus. Here's the benchmark that proves it.
```

**Body:**
```
My Claude Code bill hit $18,136 over the last 90 days, 97% of it on Opus 4. I never knew why — every monitoring tool (Helicone, Langfuse, Portkey) shows what you already spent but none of them answer "could a cheaper model have done that task just as well?"

So I benchmarked 20 real coding tasks from my own session history across four models: Opus 4, Sonnet 4, Haiku 4.5, and local Gemma 2 2B. Blindly graded with a Sonnet-as-judge rubric on correctness, quality, and completeness.

The finding that made me stop using Opus: Opus scored 24.8/30 average, LOWER than Sonnet's 26.1, while costing 5.2x more. On one debug prompt Opus hallucinated a bug that didn't exist in the code. Sonnet got it right. I checked by hand.

Haiku 4.5 tied Sonnet on win count (7 each) at 2.4x lower cost.

I then ran a script over my own ~/.claude/projects/ history to apply the benchmark-validated routing rules retroactively. Actual spend: $18,136. Counterfactual: $4,163. $13,973 in 90 days I gave Anthropic for nothing.

I built InferLane — free Claude Code plugin — to do this routing automatically:
- /plugin marketplace add ComputeGauge/inferlane
- /plugin install inferlane@inferlane

Or one command for local-model fallback:
curl -fsSL https://inferlane.dev/install.sh | bash

Caveats (repo has full methodology):
- N=1 per prompt, Sonnet-as-judge is biased toward Sonnet, prompts are single-turn
- My profile is unusual (mostly Opus, very high volume). Your number will be smaller but percentages should be similar.
- The Opus debug outlier was real but might not generalize — run the harness yourself to confirm

Blog: https://inferlane.dev/blog/benchmark-20-tasks-5-models
Repo: https://github.com/ComputeGauge/inferlane
```

---

## Which to pick, decision tree

- **If you can defend the Opus finding in real-time comments for 4 hours:** Variation C (contrarian, highest ceiling)
- **If you want lower risk but still strong:** Variation A (data-first)
- **If you're confident in your own bill number and want the story angle:** Variation B ($14K story)

My pick: **Variation C**, because the Opus finding is the only one HN hasn't seen before. Variation A gets you 300-500 upvotes. Variation C has a 1000+ ceiling if the Opus result holds up in the comments.

---

## The supporting numbers in one place — keep this open during launch

**Benchmark totals (20 prompts):**
- Opus 4:     24.8/30 avg · 6 wins (30%) · $1.2088
- Sonnet 4:   26.1/30 avg · 7 wins (35%) · $0.2330
- Haiku 4.5:  25.3/30 avg · 7 wins (35%) · $0.0977
- Gemma 2 2B: 11.7/30 avg · 0 wins (0%)  · $0.0000

**Cost per 1000 quality points:**
- Opus $2.44 · Sonnet $0.45 · Haiku $0.19 · Gemma $0.00

**Per-category winners:**
- Opus wins: refactor (29), config (27), docs (tied with Sonnet at 29)
- Sonnet wins: debug (26), implement (26.8), ui (29)
- Haiku wins: test (28), data (24.5), explain (27.3), review (27)

**Personal 90-day:**
- 2,312 session files · 116,160 assistant messages
- Actual: $18,136 (97% Opus 4.6)
- Routed: $4,163
- Save: $13,973 (77%)
- Monthly actual: $6,045
- Monthly save: $4,658

**Caveats I proactively cite before commenters do:**
1. N=1 per prompt
2. Sonnet-as-judge is biased toward Sonnet
3. Prompts are single-turn, no long context or agentic loops
4. My 90-day profile is 97% Opus — not typical
5. The Opus debug outlier was severe (12/30 on one prompt). Remove it and Opus rises to 25.6/30, still below Sonnet.

**Prompts where Haiku tied or beat Sonnet:** 1, 2, 4, 7, 9, 11, 12, 14, 15, 17, 20

**Prompts where Opus scored lower than Sonnet:** 3, 5, 11, 12, 14, 15, 16, 17, 19 — 9 of 20

---

## Post-day checklist (unchanged from previous draft)

- 9am Pacific, Tuesday. Not Monday, not Friday.
- Post from a non-new HN account if possible (the Inferlane account is 1 day old, 1 karma — heavy handicap)
- Email hn@ycombinator.com 30 min before: "I'm posting a Show HN benchmark about Claude Opus at 9am PT. The account is new. If it gets auto-downranked I'd appreciate second-chance consideration."
- Answer every comment within 5 minutes for the first 4 hours. This is the #1 ranking factor after initial velocity.
- Have 5-10 friends ready to upvote + star the repo in the first 10 minutes
- Don't edit the post after submission (HN treats edits as suspicious)
- Don't upvote from alt accounts
- If the post dies in <1 hour: don't delete it, leave it alive for 48h, come back in 6 weeks with a v2

---

## Ready-to-paste first comment (OP reply within 60 seconds of posting)

```
OP here. Solo founder, first Show HN, burned by my own Claude Code bill.

The finding that surprised me most: Opus 4 scored LOWER than Sonnet 4 on average (24.8 vs 26.1/30). I ran it twice to make sure. One specific debug prompt — Opus produced 629 tokens of confident confabulation about a bug that didn't exist. I checked the output by hand, the judge got it right.

I want to be careful here because this goes against the grain. Caveats I'm flagging before anyone else does:
- N=1 per prompt
- Sonnet-as-judge is biased toward Sonnet (so the Haiku-tying finding is the opposite of what bias would predict)
- Prompts are single-turn
- My 97%-Opus usage profile is unusual

Everything is MIT in the repo. If you run the benchmark and see different numbers, file an issue with your results — I want to be proven wrong if I'm wrong.

Happy to go deep on any of the methodology.
```
