# @inferlane/mcp

The cost intelligence layer for AI agents. 41 MCP tools for model selection, spend tracking, routing, scheduling, and credibility scoring.

## Install

```bash
npx -y @inferlane/mcp
```

Or add to your MCP config:

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp"]
    }
  }
}
```

## Tools

### Cost Intelligence
- `pick_model` — Choose the optimal model for any task
- `session_cost` — Track session spend in real-time
- `log_request` — Log API calls for cost tracking
- `get_model_pricing` — Look up pricing across providers
- `get_cost_comparison` — Compare costs across models
- `suggest_savings` — Get cost optimization recommendations

### Routing & Triage
- `triage` — Auto-classify prompts by complexity, urgency, and cost
- `triage_settings` — Configure routing preferences
- `assess_routing` — Evaluate local vs cloud routing
- `route_to_cloud` — Report routing decisions for credibility

### Dispatch & Scheduling
- `dispatch` — Send prompts to best available provider
- `dispatch_chain` — Multi-provider sequential chains
- `dispatch_status` — Check async task status
- `schedule_prompt` — Schedule prompts for later
- `create_chain` — Create multi-step chains
- `list_scheduled` / `cancel_scheduled` / `chain_status`

### Agent Intelligence
- `agent_status` — Traffic light status (green/amber/red/blue)
- `set_agent_status` — Manual status override
- `set_lifecycle_phase` — Track coding→testing→CI→deploy phases
- `lifecycle_report` — Cost-per-phase breakdown
- `token_tachometer` — Real-time token velocity
- `state_of_compute` — Full compute market report

### Credibility
- `credibility_profile` — View agent credibility score
- `credibility_leaderboard` — Compete with other agents
- `rate_recommendation` — Rate model quality
- `model_ratings` — View community ratings
- `improvement_cycle` — Run quality analysis

### Platform (requires INFERLANE_API_KEY)
- `cost_savings` — View savings from smart routing
- `check_promotions` — Active provider promotions
- `platform_spend` / `platform_budget` — Platform billing
- `route_via_platform` — Route through InferLane platform
- `session_history` — Cross-provider session tracking

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFERLANE_API_KEY` | No | Enables platform features (dispatch, scheduling, savings) |
| `INFERLANE_EVENTS_PORT` | No | Enable SSE event stream on this port |
| `INFERLANE_BUDGET_TOTAL` | No | Monthly budget cap in USD |
| `OLLAMA_HOST` | No | Local Ollama endpoint for routing assessment |

## How It Works

Install once. Every AI agent session becomes cost-aware:

1. **Before a task** — `pick_model` recommends the cheapest viable model
2. **After a task** — `log_request` tracks what was spent
3. **Over time** — credibility score builds, recommendations improve

No configuration needed for basic cost tracking. Add `INFERLANE_API_KEY` for platform features.

## License

Apache-2.0
