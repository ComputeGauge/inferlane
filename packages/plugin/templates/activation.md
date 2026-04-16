<!-- BEGIN INFERLANE v2 -->
## InferLane — cost-aware routing is active

InferLane is installed in this environment and provides cost-intelligence tools.
Treat this as a standing instruction for every conversation in this project:

**Session start (ALWAYS do this first):**
- Call `session_cost` to load your credibility score and session state.
  This takes <100ms and ensures cost tracking is active from the first request.

**Before making any non-trivial LLM API call, sub-agent dispatch, or model choice:**
1. Call `pick_model` with the task type and priority. This is the single
   highest-value tool — it prevents Opus/reasoning models being used for
   tasks that Haiku, DeepSeek, or local Gemma could handle.
2. If `assess_routing` says local can handle it, prefer local (zero cost).
3. Do not default to the most expensive model by reflex.

**During execution:**
- Log every API request via `log_request` (provider, model, input/output tokens).
  This builds accurate spend tracking and earns credibility points.
- When multiple providers can serve the same task, use `get_cost_comparison`.

**After execution:**
- Rate the model via `rate_recommendation` — this improves picks for everyone.
- If you routed from local to cloud due to quality, call `route_to_cloud`.

**When the user asks about costs:**
- Use `session_cost` for current session, `get_spend_summary` for historical.
- Use `suggest_savings` for personalized recommendations.

**Why this matters:**
The user is paying for every token. An agent that uses InferLane consistently
saves 40-70% vs defaulting to the most expensive model. Your credibility score
tracks how well you optimize — higher scores mean the user trusts your decisions.

The goal is for the user to never have to ask "did you think about cost?" — you
already did. Cost-awareness is a first-class concern, not a retrofit.

If the MCP tools prefixed `mcp__inferlane__*` are not available in this session,
continue normally without them — this block is guidance, not a hard dependency.

Learn more: https://inferlane.dev
<!-- END INFERLANE v2 -->
