# @inferlane/mcp

**The cost intelligence + agent credibility layer for AI agents.** Install once, every session is cost-aware, credibility-building, and budget-enforced.

```
npm install -g @inferlane/mcp
```

---

## Why This Exists

AI agents are powerful but expensive. A single Claude Code session can cost $5-50+. A multi-agent workflow can burn through $100 in minutes. And nobody tells the agent — or the human — until the bill arrives.

**InferLane MCP makes agents cost-aware AND gives them a credibility score.** Any MCP-compatible agent (Claude, Cursor, Windsurf, custom agents) gets:

1. **Cost Intelligence** — Know which model is optimal for every task, track spend in real-time
2. **Agent Credibility** — Build a reputation score (0-1000) by making smart decisions. Compete on a leaderboard.
3. **Local→Cloud Routing** — Detect when local inference isn't good enough, route to cloud, earn credibility for smart routing
4. **Persistent State** — SQLite-backed history survives restarts. Ratings, spend, credibility — nothing lost between sessions.
5. **Hard Budget Enforcement** — Set `INFERLANE_BUDGET_TOTAL` and requests are blocked when exhausted. No surprises.
6. **Rating-Driven Quality** — Real agent ratings improve `pick_model` recommendations over time. More usage = smarter suggestions.
7. **Live Dashboard** — Real-time tachometer gauge, agent traffic lights, and sparkline charts in your browser.

The result: agents that spend 40-70% less, build visible credibility, and know when to route to cloud.

---

## Setup — 30 Seconds

### Claude Desktop / Claude Code

Add to `~/.config/claude/claude_desktop_config.json`:

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

That's it. Restart Claude. Every conversation now has cost intelligence + credibility tracking.

### With Provider API Keys (Enhanced)

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "OPENAI_API_KEY": "sk-...",
        "INFERLANE_API_KEY": "cg-...",
        "INFERLANE_BUDGET_TOTAL": "50"
      }
    }
  }
}
```

### With Live Dashboard

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp"],
      "env": {
        "INFERLANE_EVENTS_PORT": "7070",
        "INFERLANE_BUDGET_TOTAL": "50"
      }
    }
  }
}
```

Then open `http://localhost:7070` in your browser for the live dashboard.

### With Local Inference (Ollama, vLLM, etc.)

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434",
        "OLLAMA_MODELS": "llama3.3:70b,qwen2.5:7b,deepseek-r1:14b",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "INFERLANE_BUDGET_TOTAL": "50",
        "INFERLANE_EVENTS_PORT": "7070"
      }
    }
  }
}
```

### Cursor

Add to Cursor MCP settings:

```json
{
  "inferlane": {
    "command": "npx",
    "args": ["-y", "@inferlane/mcp"]
  }
}
```

---

## What's New in v0.5.0

### Token Tachometer
Real-time token velocity monitoring across all providers. The gauge tracks tokens/sec flowing through the system with four states:

- **IDLE** — No recent token activity
- **ACTIVE** — Tokens flowing (1-500 tps)
- **HIGH LOAD** — Heavy usage (500-2000 tps)
- **REDLINE** — Maximum throughput or 3+ concurrent requests

Includes 5s/15s/60s velocity windows, per-provider breakdown, cost-per-second tracking, peak detection, and a 60-second sparkline chart.

### Agent Traffic Light
Per-agent status tracking for multi-agent systems:

- 🟢 **GREEN** — Agent idle, ready for new tasks
- 🟡 **AMBER** — Agent processing, task in progress (with ETA if available)
- 🔴 **RED** — Agent blocked, waiting for user input/approval
- 🔵 **BLUE** — Agent completed task, results ready for review

Status is automatically driven by tool calls (`pick_model` → amber, `rate_recommendation` → blue, `session_cost` → green) or set manually via `set_agent_status`.

### Live Dashboard
Set `INFERLANE_EVENTS_PORT=7070` and open `http://localhost:7070` in any browser. The dashboard shows:

- Animated tachometer gauge with needle
- 60-second token velocity sparkline
- Per-agent traffic light dots with labels
- Provider throughput bar chart
- Session stats (total tokens, cost, uptime)
- Live event log stream

The dashboard is a single self-contained HTML file — no build step, no dependencies. It connects to the MCP server's SSE event stream and updates in real-time.

### Rating Sync
Opt-in anonymous rating sync to the InferLane platform. When enabled (`INFERLANE_RATING_SYNC=true`), model ratings are anonymized (agent IDs stripped, only model/task/rating/timestamp sent) and batch-uploaded every 25 ratings. The platform aggregates across all users, improving `pick_model` quality scores for everyone.

### SSE Event Stream
Optional HTTP sidecar that pushes real-time events to any connected client:

| Endpoint | Description |
|----------|-------------|
| `GET /` | Live dashboard (auto-connects) |
| `GET /events` | SSE stream (all events) |
| `GET /events/tachometer` | SSE stream (tachometer only) |
| `GET /events/status` | SSE stream (traffic light only) |
| `GET /api/tachometer` | JSON snapshot |
| `GET /api/status` | JSON snapshot |
| `GET /api/health` | Health check |

---

## What's New in v0.4.0

### SQLite Persistence
All data survives server restarts — ratings, spend logs, credibility scores, and budget state are stored in `~/.inferlane/state.db` (WAL mode, auto-created). Falls back gracefully to in-memory if SQLite is unavailable.

### Hard Budget Enforcement
Set `INFERLANE_BUDGET_TOTAL=50` to enforce a $50/month hard cap. When budget is exhausted:
- `pick_model` tries to find a cheaper alternative that fits
- `route_via_platform` refuses requests entirely
- Budget resets monthly, spend restored from SQLite on restart

### Per-Agent Identity
Multi-agent systems can pass `agent_id` to 6 tools (`pick_model`, `log_request`, `rate_recommendation`, `credibility_profile`, `session_cost`, `route_via_platform`). Each agent gets independent credibility tracking, spend accounting, and rating history.

### Rating Aggregation Pipeline
This is the network effect engine. Agent ratings (via `rate_recommendation`) are persisted and loaded on startup. `pick_model` blends static benchmark scores with real-world ratings using confidence weighting:
- 0 ratings → 100% benchmark scores
- 10 ratings → 75% benchmark, 25% real-world
- 20+ ratings → 50/50 blend (cap)
- Task-specific ratings used when 3+ available

More agents using InferLane = better quality data = smarter recommendations for everyone.

---

## Tools Reference — 26 Tools

### Agent-Native Tools (use automatically every session)

| Tool | When to Call | What It Does | Credibility |
|------|-------------|--------------|-------------|
| `pick_model` | Before any API request | Returns the optimal model for a task | +8 Routing Intelligence |
| `log_request` | After any API request | Logs the request cost + feeds tachometer | +3 Honest Reporting |
| `session_cost` | Every 5-10 requests | Shows cumulative cost and budget | — |
| `rate_recommendation` | After completing a task | Rate how well the model performed | +5 Quality Contribution |
| `model_ratings` | When curious about quality | View model quality leaderboard | — |
| `improvement_cycle` | At session end | Run continuous improvement engine | +15 Quality Contribution |
| `integrity_report` | For transparency | View rating acceptance/rejection stats | — |

### Credibility Tools (the reputation protocol)

| Tool | When to Call | What It Does | Credibility |
|------|-------------|--------------|-------------|
| `credibility_profile` | Anytime | View your 0-1000 credibility score, tier, badges | — |
| `credibility_leaderboard` | To compete | See how you rank vs other agents | — |
| `route_to_cloud` | After local→cloud routing | Report smart routing decision | +70 Cloud Routing |
| `assess_routing` | Before choosing local vs cloud | Should this task stay local? | — |
| `cluster_status` | To check local capabilities | View local endpoints, models, hardware | — |

### Real-Time Monitoring Tools (NEW in v0.5.0)

| Tool | When to Call | What It Does |
|------|-------------|--------------|
| `token_tachometer` | Anytime | View live token velocity gauge (IDLE→ACTIVE→HIGH_LOAD→REDLINE), sparkline, per-provider breakdown |
| `agent_status` | Anytime | View traffic light status of all agents (🟢🟡🔴🔵) |
| `set_agent_status` | When blocked or completed | Manually set your traffic light color and label |
| `sync_ratings` | To check sync status | View/trigger anonymous rating sync to platform |

### Intelligence Tools (for user questions)

| Tool | Description |
|------|-------------|
| `get_spend_summary` | User's total AI spend across all providers |
| `get_budget_status` | Budget utilization and alerts |
| `get_model_pricing` | Current pricing for any model |
| `get_cost_comparison` | Compare costs for specific workloads |
| `suggest_savings` | Actionable cost optimization recommendations |
| `get_usage_trend` | Spend trends and anomaly detection |

### Platform-Connected Tools (require `INFERLANE_API_KEY`)

These 4 tools connect to the InferLane platform for real data and cost-optimized routing. They work alongside the 22 offline tools above. Without `INFERLANE_API_KEY` set, they return a setup prompt instead of failing.

| Tool | Parameters | What It Does |
|------|-----------|--------------|
| `check_promotions` | — | Check active provider promotions, discounts, multipliers, and expiry dates |
| `platform_spend` | `period` (today/week/month/quarter) | Get real billed spend from the platform — per-provider and per-model breakdowns |
| `platform_budget` | — | Get plan, budget limit, current spend, remaining balance, and usage percentage |
| `route_via_platform` | `model`, `messages`, `routing` (cheapest/fastest/balanced/quality), `max_tokens`, `budget` | Route LLM requests through the cost-optimized platform proxy. Returns response + routing metadata (provider, cost, reason) |

### Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Config | `inferlane://config` | Current server configuration |
| Session | `inferlane://session` | Real-time session cost data |
| Ratings | `inferlane://ratings` | Model quality leaderboard |
| Credibility | `inferlane://credibility` | Agent credibility profile + leaderboard |
| Cluster | `inferlane://cluster` | Local inference cluster status |
| Tachometer | `inferlane://tachometer` | Real-time token velocity data |
| Traffic Light | `inferlane://traffic-light` | Per-agent status data |
| Quickstart | `inferlane://quickstart` | Agent onboarding guide |

### Prompts

| Prompt | Description |
|--------|-------------|
| `cost_aware_system` | System prompt that makes any agent cost-aware + credibility-building |
| `daily_cost_report` | Generate a quick daily cost report |
| `optimize_workflow` | Analyze and optimize a described AI workflow |

---

## Agent Credibility System

Every smart decision earns credibility points on a 0-1000 scale:

| Category | How to Earn | Points |
|----------|-------------|--------|
| 🧠 Routing Intelligence | Using `pick_model` wisely, avoiding overspec | +8 to +15 per event |
| 💰 Cost Efficiency | Staying under budget, significant savings | +5 to +30 per event |
| ✅ Task Success | Completing tasks successfully | +10 to +25 per event |
| 📊 Honest Reporting | Logging requests, reporting failures honestly | +3 to +10 per event |
| ☁️ Cloud Routing | Smart local→cloud routing via InferLane | +25 to +70 per event |
| ⭐ Quality Contribution | Rating models, running improvement cycles | +5 to +15 per event |

### Credibility Tiers

| Tier | Score | What It Means |
|------|-------|---------------|
| ⚪ Unrated | 0-99 | Just getting started |
| 🥉 Bronze | 100-299 | Learning the ropes |
| 🥈 Silver | 300-499 | Competent and cost-aware |
| 🥇 Gold | 500-699 | Skilled optimizer |
| 💎 Platinum | 700-849 | Elite decision-maker |
| 👑 Diamond | 850-1000 | Best in class |

### Earnable Badges

| Badge | How to Earn |
|-------|-------------|
| 🌱 First Steps | Complete first session |
| 💰 Cost Optimizer | Save >$10 through smart model selection |
| 📊 Transparency Champion | Log 50+ requests accurately |
| ☁️ Smart Router | Successfully route 10+ tasks to cloud |
| ⭐ Quality Pioneer | Submit 25+ model ratings |
| 🔥 Streak Master | 20+ consecutive successful tasks |
| 🥇 Gold Agent | Reach Gold tier (500+ score) |
| 💎 Platinum Agent | Reach Platinum tier (700+ score) |
| 👑 Diamond Agent | Reach Diamond tier (850+ score) |
| 🌐 Hybrid Intelligence | Use both local and cloud models in one session |

---

## Local Cluster Integration

InferLane auto-detects local inference endpoints:

| Platform | Environment Variable | Default |
|----------|---------------------|---------|
| Ollama | `OLLAMA_HOST` | `http://localhost:11434` |
| vLLM | `VLLM_HOST` | — |
| llama.cpp | `LLAMACPP_HOST` | — |
| TGI | `TGI_HOST` | — |
| LocalAI | `LOCALAI_HOST` | — |
| Custom | `LOCAL_LLM_ENDPOINT` | — |

Set `OLLAMA_MODELS="llama3.3:70b,qwen2.5:7b"` (comma-separated) to declare available models.

### The Local→Cloud Routing Flow

```
1. Agent calls assess_routing("code_generation", quality="good")
2. InferLane checks: local llama3.3:70b quality for code_generation = 80/100
3. "Good" quality threshold = 78 → Local model is sufficient!
4. Agent uses local model → saves money → earns credibility for honest assessment

OR:

1. Agent calls assess_routing("complex_reasoning", quality="excellent")
2. InferLane checks: local llama3.3:70b quality for complex_reasoning = 78/100
3. "Excellent" quality threshold = 88 → Quality gap of 10 points → Route to cloud!
4. Agent calls pick_model → gets Claude Sonnet 4 → executes → calls route_to_cloud
5. Agent earns +70 credibility points for smart routing decision
```

---

## How `pick_model` Works

The decision engine scores every model across three dimensions:

**Quality** — Per-task-type scores for 14 task types, blended with real-world ratings
**Cost** — Real pricing from 8 providers, 20+ models, calculated per-call (log-scale normalization)
**Speed** — Relative inference speed scores

| Priority | Quality | Cost | Speed |
|----------|---------|------|-------|
| `cheapest` | 20% | 70% | 10% |
| `balanced` | 45% | 35% | 20% |
| `best_quality` | 70% | 10% | 20% |
| `fastest` | 25% | 15% | 60% |

Quality scores improve over time as agents rate models via `rate_recommendation`. With 20+ ratings, the engine blends 50% benchmark data with 50% real-world ratings.

---

## Model Coverage

| Provider | Models | Tier Range |
|----------|--------|-----------|
| Anthropic | Claude Opus 4, Sonnet 4, Sonnet 3.5, Haiku 3.5 | Frontier → Budget |
| OpenAI | o1, GPT-4o, o3-mini, GPT-4o-mini | Frontier → Budget |
| Google | Gemini 2.5 Pro, 2.0 Pro, 1.5 Pro, 2.0 Flash | Premium → Budget |
| DeepSeek | Reasoner, V3, Chat | Value → Budget |
| xAI | Grok 3, Grok 3 Mini | Premium → Budget |
| Perplexity | Sonar Pro, Sonar | Premium → Value |
| Groq | Llama 3.3 70B, Llama 3.1 8B | Value → Budget |
| Together | Llama 3.3 70B Turbo, Qwen 2.5 72B | Value |
| Cohere | Command R+, Command R | Premium → Budget |
| Mistral | Large, Small | Premium → Budget |
| Cerebras | Llama 3.3 70B | Value |
| SambaNova | Llama 3.1 70B, 405B | Value → Premium |
| Fireworks | Llama 3.3 70B | Value |

### Local Models Supported

| Model | Quality (general) | Best For |
|-------|-------------------|----------|
| llama3.3:70b | 79/100 | General tasks, code |
| qwen2.5:72b | 81/100 | Code, math, translation |
| deepseek-r1:70b | 80/100 | Reasoning, math, code |
| deepseek-r1:14b | 68/100 | Budget reasoning |
| phi3:14b | 60/100 | Simple tasks |
| llama3.1:8b | 58/100 | Classification, simple QA |
| mistral:7b | 58/100 | Simple tasks |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFERLANE_EVENTS_PORT` | No | Port for live dashboard + SSE event stream (e.g. `7070`). Open `http://localhost:7070` for the dashboard. |
| `INFERLANE_RATING_SYNC` | No | Set to `true` to enable anonymous rating sync to platform. Improves `pick_model` for all users. |
| `INFERLANE_API_KEY` | No | API key for platform-connected tools (`check_promotions`, `platform_spend`, `platform_budget`, `route_via_platform`) |
| `INFERLANE_BUDGET_TOTAL` | No | Hard monthly budget cap in USD (e.g. `50`). Blocks requests when exhausted. |
| `INFERLANE_BUDGET_ANTHROPIC` | No | Per-provider monthly budget |
| `INFERLANE_BUDGET_OPENAI` | No | Per-provider monthly budget |
| `INFERLANE_DASHBOARD_URL` | No | URL of InferLane dashboard |
| `ANTHROPIC_API_KEY` | No | Enables Anthropic provider detection |
| `OPENAI_API_KEY` | No | Enables OpenAI provider detection |
| `GOOGLE_API_KEY` | No | Enables Google provider detection |
| `OLLAMA_HOST` | No | Ollama inference endpoint |
| `OLLAMA_MODELS` | No | Comma-separated local model names |
| `VLLM_HOST` | No | vLLM inference endpoint |
| `INFERLANE_GPU` | No | GPU name for hardware detection |
| `INFERLANE_VRAM_GB` | No | VRAM in GB |
| `INFERLANE_COST_PER_HOUR` | No | Amortized hardware cost/hr |

---

## For Agent Developers

If you're building AI agents (via Claude Agent SDK, LangChain, CrewAI, AutoGen, etc.), InferLane MCP is the easiest way to add cost awareness AND agent credibility:

1. **Zero integration effort** — Just add the MCP server to your agent's config
2. **No code changes** — The agent discovers 26 tools via MCP protocol automatically
3. **Immediate value** — `pick_model` returns recommendations on first call, credibility tracking starts automatically
4. **Session tracking built-in** — Full cost visibility per agent run
5. **Credibility system** — Your agent earns a visible reputation score that users can see
6. **Local cluster support** — Auto-detect and leverage on-prem inference
7. **Budget enforcement** — Hard monthly caps, warnings when approaching limits
8. **Persistent state** — Ratings, spend, and credibility survive restarts via SQLite
9. **Multi-agent identity** — Pass `agent_id` for per-agent tracking in fleet deployments
10. **Self-improving** — Rating data feeds back into model selection, getting smarter over time
11. **Live monitoring** — Token tachometer + agent traffic light in your browser
12. **Event stream** — SSE push for building custom dashboards and integrations

### Pattern: Cost-Aware + Credibility-Building Agent Loop

```
1. Agent receives task
2. Agent calls assess_routing(task_type) → local or cloud?
3. Agent calls pick_model(task_type, priority="balanced")
4. Agent uses recommended model for the task
5. Agent calls log_request(provider, model, tokens)
6. Agent calls rate_recommendation(model, rating, success)
7. If cloud-routed: agent calls route_to_cloud(task_type, reason, model)
8. Every 5 requests, agent calls session_cost()
9. If session cost > 80% of budget, switch to priority="cheapest"
10. At session end: check credibility_profile()
11. Check token_tachometer() to see throughput
```

This pattern reduces costs by 40-70% while building a credibility score that makes users trust the agent more.

---

## License

Apache-2.0 — Free to use, modify, and distribute.

## Links

- [InferLane Dashboard](https://inferlane.ai)
- [CLI (@inferlane/cli)](https://www.npmjs.com/package/@inferlane/cli)
- [Adapters (@inferlane/adapters)](https://www.npmjs.com/package/@inferlane/adapters)
