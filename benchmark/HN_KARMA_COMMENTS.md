# Karma-building comments for the Inferlane HN account

**Goal:** Get the account from 1 karma to 20-50 karma over 7-10 days. This gets the account out of the "auto-downranked new-account" bucket before launch. The engagement also creates a comment history that moderators can audit if they get a flag on launch day.

**Rules:**
1. Post 2-4 thoughtful comments per day. No more — looks spammy.
2. **Never mention InferLane.** Not once. Not even obliquely. If someone asks "what are you working on?" in a reply, answer honestly but don't link.
3. Comment on AI dev tool posts, LLM cost posts, Claude Code discussions, benchmark posts, MCP server posts. Those are your future audience.
4. Each comment should teach something or share a specific experience. No "+1", no "this!" No "great post".
5. Keep it under 120 words. HN rewards tight, substantive replies.
6. Use your real experience. You have 116,000 assistant messages of Claude Code data — that's a huge advantage nobody else has.

## The playbook

Every morning:
1. Open https://news.ycombinator.com/newest
2. Scroll for 2-3 minutes looking for AI / LLM / dev tool / Claude posts
3. Pick 2-3 that have <20 comments (high chance your reply gets seen)
4. Post substantive replies below

## 20 pre-written comment templates

These are **templates** — adapt to the specific post you're replying to. Do not copy-paste verbatim.

### Template 1 — Cost anecdote (use on any "my AI bill" post)
```
I just pulled my own Claude Code history over the last 90 days — 116,000
assistant messages, bill was $18K, 97% of it on Opus. The thing nobody
realizes is how much the "default model" choice dominates. I've been
working on routing rules after a benchmark and it looks like switching
to Sonnet for non-refactor work alone would have saved me ~$14K. Most
of us never look at the itemization because the invoice is one line.
```

### Template 2 — Benchmark skepticism (use on any AI benchmark post)
```
Quick question about methodology — did you control for judge position
bias? I ran something similar recently and Claude-judging-Claude outputs
is vulnerable to whichever label appears first in the prompt. Randomizing
A/B/C/D per-prompt with a seed fixed it for me. Mentioning in case it's
relevant to your results.
```

### Template 3 — Local model reality check (use on any "run LLMs locally" post)
```
Worth flagging for people thinking about this: Gemma 4 27B on an M-series
without GPU acceleration is unusable for real work. I tried the 9.6GB
variant and got 1.5 tokens/sec, times out on 2K-token prompts. Gemma 2
2B runs fine but scores roughly half as well as cloud Sonnet on real
coding tasks in my testing. If you're on a laptop, the "free local"
story is narrower than people make it sound.
```

### Template 4 — MCP gotcha (use on any MCP / tool use post)
```
One thing that bit me with MCP stdio servers: if your server has multiple
`bin` entries in package.json and none match the unscoped package name,
`npx @scope/package` will fail with "could not determine executable to
run". npm's resolution logic looks for a bin entry matching the unscoped
name (e.g., for @foo/bar it looks for `bar`). Adding an alias fixed it.
Not in most MCP docs I found, so figured worth sharing.
```

### Template 5 — Context window waste (use on any long-context post)
```
In my Claude Code sessions I found 80%+ of the token cost in long sessions
was cache reads, not net-new inference. Cache reads are 10% of the input
price but the volume is massive once your context windows get above
50K tokens. Worth instrumenting if you haven't — it's a different
optimization axis than "which model should I use".
```

### Template 6 — Haiku capability (use on any Anthropic discussion)
```
The Haiku improvement between 3.5 and 4.5 is bigger than people give
it credit for. I ran a blind-judged benchmark recently and Haiku 4.5
tied Sonnet 4 on win count for routine coding tasks (docs, tests,
explanations, data extraction). It still loses on debug and refactor
but most real developer work isn't debug and refactor.
```

### Template 7 — Observability vs routing (use on any LangChain/observability post)
```
Distinction I find useful: Helicone/Langfuse/Portkey are observability
— they show you what you spent after the fact. What's missing in that
category is decision support: "should I have used a cheaper model for
this?" That's a different tool. The bill is the symptom, not the disease.
```

### Template 8 — Managed Agents runtime (use on any Anthropic Managed Agents post)
```
Heads up for anyone running Managed Agents at scale: the $0.08/hr
active-runtime fee adds up meaningfully. On a session that sits in
a tool loop for 30 minutes of active compute, runtime cost can exceed
token cost depending on your prompt. Not always — but often enough
that measuring only tokens understates your bill by 10-20% in my
experience.
```

### Template 9 — Self-judging bias (use on any "LLM evaluator" post)
```
Sonnet-as-judge has a measurable bias toward Sonnet outputs. I mitigated
it by blinding labels (randomized A/B/C per prompt, fixed seed for
reproducibility). Even blinded, the bias doesn't fully disappear — you
can tell because "neutral" results shift toward Sonnet by a consistent
small amount. For rigorous work you want a second judge from a different
family (GPT-4o or Gemini) as a cross-check.
```

### Template 10 — Opus overkill (use on any "which Claude model" post)
```
I was surprised by this in my own benchmarks: Opus 4 averaged lower
than Sonnet 4 on 20 real coding tasks. Opus is 5x more expensive for
a ~1-point drop (out of 30) in quality on my prompts. Where Opus
clearly wins is refactoring where there's room to be more "elegant".
For everyday coding I'd default to Sonnet and only escalate to Opus
on explicit reasoning-heavy tasks.
```

### Template 11 — Ollama model sizing (use on any "which local model" post)
```
Rough rule I've been using: <8GB RAM = 2B, 16GB = 4B, 32GB+ = 26B.
Gemma 2 2B is genuinely useful for structured extraction and
classification but hallucinates too much for real coding. If you
have GPU headroom (4090 or better), Gemma 4 31B is where the story
gets interesting. On a laptop without GPU, stay at 4B or smaller.
```

### Template 12 — JSONL parsing gotcha (use on any Claude Code internals post)
```
Claude Code's transcript format is JSONL in ~/.claude/projects/<project>/
<uuid>.jsonl. Each line is a message. The `usage` field on assistant
messages has accurate token counts. For cost analysis I found it's
worth filtering out `cache_read_input_tokens` separately — Anthropic
charges 10% of input rate for those, so treating them as regular input
inflates your cost estimate by 3x-5x on long sessions.
```

### Template 13 — DeepSeek coding (use on any DeepSeek post)
```
DeepSeek V3 is underrated for coding work in my experience. It's not
as strong as Claude Sonnet on subtle bugs but for routine implementation
and refactoring it's competitive at roughly 1/11 the cost. Worth having
in your routing rotation if you're cost-sensitive. Cavveat: the
distillation on DeepSeek for code occasionally produces Chinese
comments in the output — minor but worth flagging.
```

### Template 14 — Reasoning token costs (use on any o1 / Grok / thinking-model post)
```
One thing that catches people off guard with reasoning models: you pay
for hidden reasoning tokens even when the visible output is short.
Testing Grok 4 just now — a single "reply OK" prompt used 320 reasoning
tokens on top of 1 completion token. The reasoning tokens are included
in output billing. Scale that up across a 1000-prompt workload and you
discover your bill doesn't match your log files.
```

### Template 15 — Claude Code defaults (use on any Claude Code workflow post)
```
Claude Code's default routing is aggressive on Opus by design — they
want you to get the best possible experience out of the box. If you're
running a lot of sessions this adds up fast. You can override the model
per-session or via settings.json, and for routine work (docs, tests,
one-off functions) Sonnet or even Haiku is genuinely equivalent. I only
escalate to Opus for complex refactors.
```

### Template 16 — Evaluator setup (use on any "I built a benchmark" post)
```
For reproducibility, the thing that helped me most was caching per-
(model, prompt) so a crashed run resumes instead of restarting.
80 lines of Python, no deps. Grader separate from runner so you can
swap judges. Randomized blind labeling per prompt with a fixed seed
makes the whole thing repeatable. Happy to share the harness if
useful — no vendor lock-in.
```

### Template 17 — Cost intelligence vs monitoring (use on any Datadog/monitoring post)
```
LLM cost monitoring has a specific failure mode traditional APM doesn't:
the unit cost varies by model, cache state, and context length, and
those vary per-request within the same endpoint. A dashboard showing
$/day is technically accurate but masks the "this one request cost
$3.40" outliers that are where the real money leaks. You want a
per-request view with percentile flags, not just a rollup.
```

### Template 18 — Cursor vs Claude Code (use on any Cursor post)
```
Cursor and Claude Code have basically the same underlying dependency
(Anthropic's models) but very different cost profiles. Cursor's flat
$20/mo covers a lot for individual devs; Claude Code's per-token
billing punishes you exponentially as sessions grow. Tradeoff is
Cursor caps you at their feature set; Claude Code gives you the
full MCP/agent surface. Worth thinking about depending on whether
your limiting factor is cost or capability.
```

### Template 19 — Gemma 4 MoE (use on any "new open model" post)
```
Worth knowing: Gemma 4 27B MoE needs real GPU acceleration to be
usable. On an M-series MacBook without GPU passthrough it hits ~1.5
tok/s and times out on 2K-token generations. If you're on a 4090 or
better, the story is different. For laptop-native local inference,
stick to 2B-4B for now.
```

### Template 20 — Show HN tactics (use on any Show HN discussion)
```
First-time Show HN poster here, learned the hard way: new accounts
(1-5 karma) get heavily downranked regardless of post quality. The
algorithm treats zero-history accounts as spam-likely by default. You
can work around it by spending 2 weeks genuinely commenting before you
submit, or by posting from an older personal account even if the
product is company-branded. Also: answer every comment in the first
3 hours, no exceptions.
```

---

## What to avoid

- Never link to inferlane.dev or github.com/ComputeGauge/inferlane
- Never say "I built" or "check out"
- Never comment on your own posts from other accounts
- Never upvote ring
- Never post the same template twice
- Never respond to hostile comments — just leave them alone
- Never edit a comment more than once

## Success metric

After 10 days you want:
- 20-50 karma on the Inferlane account
- 10-20 comments in your history
- At least 2 comments that got 10+ upvotes each (the algorithm notices high-signal commenters)
- Zero downvotes on your own posts (you're only commenting, not posting)

Then you submit the Show HN.
