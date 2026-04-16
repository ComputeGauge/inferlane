---
name: inferlane
description: AI cost optimization and smart model routing for Claude. Use this skill whenever the user mentions picking a model, AI costs, cloud vs local routing, provider comparison, model budgets, cheaper alternatives, optimizing API spend, or tracking AI usage — even if they don't explicitly say "InferLane". Also use proactively before making non-trivial API calls, before choosing between Opus/Sonnet/Haiku, and when the user asks about AI costs. Requires the InferLane MCP server to be connected.
---

# InferLane — Smart Model Routing & Cost Optimization

InferLane is a routing layer that picks the optimal AI model for every task and tracks costs across 23 providers. You have access to its tools via the `mcp__inferlane__` prefix.

## Why this matters

Users pay for every token. A good agent doesn't burn Opus on tasks Haiku could handle, doesn't hit cloud APIs when a cheaper model suffices, and honestly reports its spend.

## Key tools (25 offline, 41 total with API key)

### Before every non-trivial API call

**`mcp__inferlane__pick_model`** — The most important tool. Returns the optimal model for a task type (code_generation, code_review, summarization, extraction, classification, translation, creative_writing, data_analysis, math, conversation, general). Pass priority: cheapest / balanced / best_quality / fastest.

Use when: about to spawn a sub-agent, choose between Opus/Sonnet/Haiku, or make any non-trivial API call.

**`mcp__inferlane__assess_routing`** — Check if local inference (Ollama, vLLM) can handle the task. Returns recommendation: local vs cloud with quality gap analysis.

Use when: the task might be simple enough for a free local model.

### After every API call

**`mcp__inferlane__log_request`** — Log the API request you just made (provider, model, input/output tokens, latency). Builds accurate spend tracking.

**`mcp__inferlane__rate_recommendation`** — Rate whether the model pick_model recommended actually worked. Improves future recommendations for everyone.

### Cost tracking

**`mcp__inferlane__session_cost`** — Real-time spend for the current session. Shows total cost, request count, per-model breakdown.

**`mcp__inferlane__get_spend_summary`** — Historical spend by provider/model/period (today, week, month, quarter).

**`mcp__inferlane__get_budget_status`** — Check remaining budget and alerts.

### Price intelligence

**`mcp__inferlane__get_model_pricing`** — Look up current pricing for any model across all providers.

**`mcp__inferlane__get_cost_comparison`** — Compare the cost of a specific workload across different models.

**`mcp__inferlane__check_promotions`** — Active discounts and deals across providers.

**`mcp__inferlane__suggest_savings`** — Personalized recommendations to reduce spend.

### Routing & dispatch

**`mcp__inferlane__triage`** — Analyze a prompt and see how it would be routed (provider, model, cost estimate) without executing.

**`mcp__inferlane__dispatch`** — Send a prompt through the multi-provider router for execution. Returns the response.

**`mcp__inferlane__dispatch_chain`** — Execute a multi-step chain across different providers (e.g., Claude for reasoning → DeepSeek for code).

### Agent intelligence

**`mcp__inferlane__agent_status`** — View traffic light status of agents (green/amber/red/blue).

**`mcp__inferlane__set_agent_status`** — Set your status (useful for multi-agent coordination).

**`mcp__inferlane__credibility_profile`** — View your agent's credibility score (0-1000). Higher = more trust.

**`mcp__inferlane__token_tachometer`** — Real-time token velocity gauge.

**`mcp__inferlane__cluster_status`** — View local inference cluster (Ollama, vLLM endpoints).

### Scheduling

**`mcp__inferlane__schedule_prompt`** — Schedule a prompt for later (time-based, recurring, price-triggered).

**`mcp__inferlane__create_chain`** — Create a multi-step prompt chain that runs sequentially.

## The core loop

For any non-trivial API call:

1. **Pick** — call `pick_model` with the task type and priority
2. **Execute** — use the recommended model
3. **Log** — call `log_request` with the actual tokens used
4. **Rate** — call `rate_recommendation` if the result was notably good or bad

For cost questions: call `session_cost` or `get_spend_summary`.

## What NOT to do

- **Don't call `pick_model` for trivial single-sentence responses** — the overhead exceeds the savings
- **Don't call every tool on every request** — pick the one that matches
- **Don't fabricate responses** — if a tool returns an error, say so honestly
- **Don't use `dispatch` as default** — only when the user wants InferLane to handle routing end-to-end

## The goal

Help users spend their AI budget wisely. The tools are a means; the end is better cost decisions. Use them when they help and skip them when they don't.
