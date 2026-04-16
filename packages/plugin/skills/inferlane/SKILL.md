---
name: inferlane
description: AI cost optimization and smart model routing for Claude. Use this skill whenever the user mentions picking a model, AI costs, cloud vs local routing, provider comparison, model budgets, cheaper alternatives, optimizing API spend, or tracking AI usage — even if they don't explicitly say "InferLane". Also use proactively before making non-trivial API calls, before choosing between Opus/Sonnet/Haiku, and when the user asks about AI costs. Requires the InferLane MCP server to be connected.
---

# InferLane — Smart Model Routing & Cost Optimization

InferLane is a routing layer that picks the optimal AI model for every task and tracks costs across providers (centralized and decentralized: Anthropic, OpenAI, Google, DeepSeek, Bittensor, Akash, Hyperbolic, and more). You have access to its tools via the `mcp__inferlane__il_*` prefix.

## Why this matters

Users pay for every token. A good agent doesn't burn Opus on tasks Haiku could handle, doesn't hit cloud APIs when a cheaper model suffices, and honestly reports its spend. Use these tools before committing to a model and when the user asks about costs.

## The six tools

All tools are prefixed `mcp__inferlane__il_*`. Three work offline (no API key); three require an InferLane API key (users can get one at https://inferlane.dev/dashboard/settings).

### Offline tools (always available)

**`mcp__inferlane__il_estimate_cost`** — Estimate the cost of a specific workload across providers before you run it.

Use when: you're about to make a non-trivial API call and want to know the cost tradeoffs. Pass the model, estimated input/output tokens, and the tool returns per-provider pricing with savings vs the default choice.

**`mcp__inferlane__il_compare_models`** — Compare all equivalent models in a capability tier (budget / workhorse / frontier) side by side, including local Ollama options and decentralized compute (Bittensor, Akash, Hyperbolic).

Use when: the user asks "which model should I use?" or when you're choosing between models of similar capability. Returns a table of pricing, quality scores, latency classes, and context windows.

**`mcp__inferlane__il_suggest_model`** — Get a model recommendation for a described task. Pass the task type (code_generation, reasoning, summarization, extraction, etc.) and a priority (cheapest / balanced / best_quality / fastest). Returns the single best model with reasoning.

Use when: the user describes what they want to build and needs to pick a model, or when you're about to spawn a subagent and want to route it to the right model tier. This is the most common entry point.

### Online tools (need INFERLANE_API_KEY)

**`mcp__inferlane__il_check_promotions`** — Check active LLM provider promotions, bonus multipliers, and off-peak discounts. Some models get 30-50% off during promotional windows.

Use when: starting work on a new provider, scheduling batch work, or when the user asks "is there a cheaper way right now?"

**`mcp__inferlane__il_get_spend`** — Get the user's real AI/LLM API spend summary broken down by provider, model, and time period.

Use when: the user asks "how much is this costing me?" or "what did I spend on Claude last month?" Returns totals, request counts, and token usage.

**`mcp__inferlane__il_route_request`** — Send an actual LLM API request through the multi-provider smart router. The router picks the cheapest viable provider automatically — centralized or decentralized.

Use when: the user explicitly wants a request routed through the cost-optimized proxy rather than calling a provider directly. This is the "execution" tool — most of the time you'll use `il_suggest_model` to pick the model and then call the provider normally through your existing tools, but `il_route_request` is there for when you want InferLane to handle the routing end-to-end.

## The core loop

For any non-trivial API call:

1. **Suggest** — call `il_suggest_model` with the task type and priority
2. **Verify cost** — optionally call `il_estimate_cost` to see the concrete number
3. **Check deals** — optionally call `il_check_promotions` if cost is tight
4. **Execute** — call the provider directly with the suggested model (or use `il_route_request` if you want InferLane to route)
5. **Report** — if the user asks about spend, call `il_get_spend` for real numbers

Steps 1-3 are fast and cheap. Step 4 is where the money is spent. Step 5 is on-demand.

## Workflow examples

**Scenario 1 — User asks you to summarize 20 documents:**

1. Call `il_suggest_model` with `task_type: summarization`, `priority: cheapest` — likely returns Haiku, Gemini Flash, or a local Ollama option
2. Optionally call `il_estimate_cost` to see the cost breakdown across the suggested options
3. Execute the summarization task with the chosen model
4. Don't need to follow up — the task speaks for itself

**Scenario 2 — User asks a complex architectural question:**

1. Call `il_suggest_model` with `task_type: complex_reasoning`, `priority: best_quality` — returns Opus or Sonnet
2. Execute with the suggested model
3. Move on — the quality tier justifies the cost

**Scenario 3 — User asks "what's this costing me?":**

1. Call `il_get_spend` with `period: today` (or week/month based on context)
2. Present the numbers directly — no interpretation needed, the tool returns structured spend data

**Scenario 4 — User is choosing between two models for a new project:**

1. Call `il_compare_models` with the capability tier they're considering — returns a side-by-side table
2. If they want cost-specific numbers, also call `il_estimate_cost` with their expected workload
3. Let them decide; don't force a choice unless they ask for your opinion

## What NOT to do

- **Don't call `il_suggest_model` for trivial single-sentence responses** — the overhead exceeds the savings
- **Don't call all six tools on every request** — pick the one that matches the question
- **Don't fabricate responses** — if a tool returns an error or the user doesn't have an API key, say so honestly rather than guessing
- **Don't use `il_route_request` as a default substitute for direct API calls** — only use it when the user explicitly wants InferLane in the path

## Decentralized compute notes

InferLane includes decentralized providers (Bittensor, Akash, Hyperbolic) in its comparisons — these are often the cheapest tier and useful for cost-sensitive or latency-tolerant workloads. They appear in `il_compare_models` results under the "decentralized" category and in `il_suggest_model` recommendations when `priority: cheapest`.

Decentralized compute is an option, not a default. Don't recommend it for latency-critical paths, but do recommend it for batch processing, overnight jobs, or cost-sensitive experimentation.

## The goal

Help users spend their AI budget wisely. The tools are a means; the end is better cost decisions on behalf of the user. Use them when they help and skip them when they don't.
