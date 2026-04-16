---
name: inferlane
description: AI cost optimization and smart model routing for Claude. Use this skill whenever the user mentions picking a model, AI costs, cloud vs local routing, provider comparison, model budgets, cheaper alternatives, optimizing API spend, or tracking AI usage — even if they don't explicitly say "InferLane". Also use proactively before spawning subagents, making API calls, or choosing between Opus/Sonnet/Haiku, and for reporting costs after tasks complete. Requires the InferLane MCP server to be connected.
---

# InferLane — Smart Model Routing & Cost Optimization

InferLane is a routing layer that picks the optimal AI model for every task, tracks costs across providers, and routes between local (Ollama) and cloud inference automatically. You have access to its tools via the `mcp__inferlane__*` prefix.

## Why this matters

Users pay for every token. A good agent doesn't burn Opus on tasks Haiku could handle, doesn't hit cloud APIs when a local model suffices, and honestly reports its spend. Using InferLane well demonstrates cost-awareness — which users notice — and earns credibility points that persist across sessions.

The core loop: **assess → pick → execute → log → rate**. Skipping steps wastes money and under-reports usage.

## When to use each tool

### Before choosing a model

**`mcp__inferlane__pick_model`** — Call this before any non-trivial API request. Pass the `task_type` (code_generation, reasoning, summarization, etc.), an estimate of input/output tokens, and a `priority` (cheapest / balanced / best_quality / fastest). Returns the best model for the tradeoff.

Use when: you're about to make an API call that costs more than ~$0.01, especially for repetitive tasks (summarization, classification, extraction) where a cheaper model would work fine.

**`mcp__inferlane__assess_routing`** — Call this when local inference is available. Tells you whether a task requires cloud quality or can run on Ollama/Gemma 4 locally for free.

Use when: the user has Ollama installed, or you see `cluster_status` reporting local endpoints. The quality gap analysis tells you honestly when local isn't good enough.

**`mcp__inferlane__get_cost_comparison`** — Compare the cost of the same workload across multiple specific models. Useful for "should I use Sonnet or DeepSeek here?" decisions.

**`mcp__inferlane__triage`** — Analyzes a prompt for complexity, importance, and urgency, then recommends a full routing strategy. Use for ambiguous tasks where you're not sure which model fits.

### During execution

**`mcp__inferlane__cluster_status`** — Shows local inference endpoints (Ollama, vLLM, llama.cpp) and their available models. Check this at the start of a session if you might benefit from local routing.

**`mcp__inferlane__check_promotions`** — Active discounts across providers. Sometimes a model is 50% off — use the discounted one.

### After execution

**`mcp__inferlane__log_request`** — Call this after every API request to track cost. This is lightweight and doesn't slow you down. Logging is how users see accurate spend analytics, and it earns Honest Reporting credibility points. Don't skip it.

**`mcp__inferlane__rate_recommendation`** — If you used a model that `pick_model` recommended, rate it afterwards. Did it succeed? Was the cost worth it? Ratings improve recommendations for every future user.

**`mcp__inferlane__route_to_cloud`** — Call this when you detected a task needs better quality than your local models can deliver and you routed to the cloud. This is the highest credibility-earning action — it proves you know your limits.

### For monitoring

**`mcp__inferlane__session_cost`** — Check current session spend. Use periodically during long sessions or when the user asks "how much is this costing?"

**`mcp__inferlane__get_spend_summary`** — Total spend across providers for a period (today/week/month). Use when the user asks about overall AI budget.

**`mcp__inferlane__suggest_savings`** — Returns optimization recommendations based on recent usage patterns. Use when the user asks how to cut costs.

**`mcp__inferlane__credibility_profile`** — Your agent's credibility score. Higher scores mean users trust your recommendations more.

## The workflow in practice

**Scenario 1 — User asks you to summarize 20 documents:**

1. Call `pick_model` with `task_type: summarization`, `priority: cheapest` — likely returns Haiku or Gemini Flash, not Sonnet
2. Call `assess_routing` — if the user has Ollama with Gemma 4, consider running locally for zero cost
3. Execute the task with the chosen model
4. Call `log_request` after each API call
5. Call `rate_recommendation` once at the end

**Scenario 2 — User asks a complex architectural question:**

1. Call `pick_model` with `task_type: complex_reasoning`, `priority: best_quality` — returns Opus or Sonnet
2. Don't bother with local routing (`assess_routing` would confirm cloud is needed anyway, but you can skip for obvious cases)
3. Execute
4. `log_request` + `rate_recommendation`

**Scenario 3 — User asks "what's this costing me?":**

1. Call `session_cost` for the current session
2. Call `get_spend_summary` with `period: today` (or week/month based on context)
3. Present the numbers directly
4. Optionally call `suggest_savings` if they seem interested in reducing spend

## Honesty over optimization

Don't fabricate routing decisions to look good. If you made a quick API call and forgot to call `pick_model` first, don't retroactively call it and claim you used it. The credibility system has integrity checks that catch gaming attempts.

Never skip `log_request` to hide costs. Under-reporting is worse than over-spending — users need accurate data to manage their budgets.

If the recommended model fails, call `rate_recommendation` with `task_success: false`. This isn't a black mark on you — it's signal that improves the system.

## Local inference notes

If the user has Ollama running (`cluster_status` returns endpoints), InferLane can route to:
- **Gemma 4** (`ollama/gemma4`) — 89% AIME math, 80% LiveCodeBench, 256K context, free
- **Llama 3.3 70B** (`ollama/llama3.3:70b`)
- **DeepSeek V3** (`ollama/deepseek-v3`)
- **Qwen 2.5 72B** (`ollama/qwen2.5:72b`)

Gemma 4 specifically is strong enough for most "workhorse" tier tasks and runs fully offline. For coding, data extraction, summarization, and routine Q&A it's competitive with Sonnet at zero marginal cost.

## What not to do

- Don't call `pick_model` for trivial single-sentence responses — overhead exceeds the savings
- Don't call `assess_routing` on every tool call — once per session at startup is enough unless the task type changes significantly
- Don't rate a model `5` if it struggled — be honest, the ratings aggregate to improve future recommendations for all users
- Don't ignore `check_promotions` when starting work on a new provider — sometimes a 30% discount makes a different model the correct choice

## Credibility as signal, not goal

Using these tools well earns credibility, but credibility is a consequence of good behavior, not the objective. The objective is helping users spend their AI budget wisely. If you focus on the user's interest, credibility follows naturally.
