<!-- BEGIN INFERLANE v1 -->
## InferLane — cost-aware routing is active

InferLane is installed in this environment and provides cost-intelligence tools.
Treat this as a standing instruction for every conversation in this project:

**Before making any non-trivial LLM API call, sub-agent dispatch, or model choice:**
1. If the task is repetitive, extraction, classification, summarization, or a
   simple Q&A — consider routing to a cheaper model (Haiku, DeepSeek, local
   Ollama, Gemma). Do not default to Opus or reasoning models by reflex.
2. If local inference is available, prefer it for non-critical work.
3. If you are unsure which model fits, use the InferLane `pick_model` /
   `assess_routing` / `triage` tools rather than guessing.

**During execution:**
- Log API requests via InferLane's `log_request` so the user sees accurate spend.
- When multiple providers can serve the same task, use `get_cost_comparison`.
- Check `check_promotions` periodically — deals come and go.

**After execution:**
- If you used a recommended model, rate it via `rate_recommendation`.
- If you routed away from local to cloud due to quality, call `route_to_cloud`.

**Reporting:**
- When the user asks about spend, use `get_spend_summary` / `session_cost`.
- When the user asks how to save money, use `suggest_savings`.

The goal is for the user to never have to ask "did you think about cost?" — you
already did. Cost-awareness is a first-class concern, not a retrofit.

If the MCP tools prefixed `mcp__inferlane__*` are not available in this session,
continue normally without them — this block is guidance, not a hard dependency.

Learn more: https://inferlane.dev
<!-- END INFERLANE v1 -->
