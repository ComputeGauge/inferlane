# @computegauge/mcp

**The cost intelligence + agent credibility layer for AI agents.** Install once, every session is cost-aware and credibility-building.

```
npm install -g @computegauge/mcp
```

---

## Why This Exists

AI agents are powerful but expensive. A single Claude Code session can cost $5-50+. A multi-agent workflow can burn through $100 in minutes. And nobody tells the agent — or the human — until the bill arrives.

**ComputeGauge MCP makes agents cost-aware AND gives them a credibility score.** Any MCP-compatible agent (Claude, Cursor, Windsurf, custom agents) gets:

1. **Cost Intelligence** — Know which model is optimal for every task, track spend in real-time
2. **Agent Credibility** — Build a reputation score (0-1000) by making smart decisions. Compete on a leaderboard.
3. **Local→Cloud Routing** — Detect when local inference isn't good enough, route to cloud, earn credibility for smart routing

The result: agents that spend 40-70% less, build visible credibility, and know when to route to cloud.

---

## Setup — 30 Seconds

### Claude Desktop / Claude Code

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "computegauge": {
      "command": "npx",
      "args": ["-y", "@computegauge/mcp"]
    }
  }
}
```

That's it. Restart Claude. Every conversation now has cost intelligence + credibility tracking.

### With Provider API Keys (Enhanced)

```json
{
  "mcpServers": {
    "computegauge": {
      "command": "npx",
      "args": ["-y", "@computegauge/mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "OPENAI_API_KEY": "sk-...",
        "COMPUTEGAUGE_BUDGET_TOTAL": "50"
      }
    }
  }
}
```

### With Local Inference (Ollama, vLLM, etc.)

```json
{
  "mcpServers": {
    "computegauge": {
      "command": "npx",
      "args": ["-y", "@computegauge/mcp"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434",
        "OLLAMA_MODELS": "llama3.3:70b,qwen2.5:7b,deepseek-r1:14b",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "COMPUTEGAUGE_BUDGET_TOTAL": "50"
      }
    }
  }
}
```

### Cursor

Add to Cursor MCP settings:

```json
{
  "computegauge": {
    "command": "npx",
    "args": ["-y", "@computegauge/mcp"]
  }
}
```

---

## Tools Reference

### Agent-Native Tools (use automatically every session)

| Tool | When to Call | What It Does | Credibility |
|------|-------------|--------------|-------------|
| `pick_model` | Before any API request | Returns the optimal model for a task | +8 Routing Intelligence |
| `log_request` | After any API request | Logs the request cost | +3 Honest Reporting |
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

### Intelligence Tools (for user questions)

| Tool | Description |
|------|-------------|
| `get_spend_summary` | User's total AI spend across all providers |
| `get_budget_status` | Budget utilization and alerts |
| `get_model_pricing` | Current pricing for any model |
| `get_cost_comparison` | Compare costs for specific workloads |
| `suggest_savings` | Actionable cost optimization recommendations |
| `get_usage_trend` | Spend trends and anomaly detection |

### Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Config | `computegauge://config` | Current server configuration |
| Session | `computegauge://session` | Real-time session cost data |
| Ratings | `computegauge://ratings` | Model quality leaderboard |
| Credibility | `computegauge://credibility` | Agent credibility profile + leaderboard |
| Cluster | `computegauge://cluster` | Local inference cluster status |
| Quickstart | `computegauge://quickstart` | Agent onboarding guide |

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
| ☁️ Cloud Routing | Smart local→cloud routing via ComputeGauge | +25 to +70 per event |
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

ComputeGauge auto-detects local inference endpoints:

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
2. ComputeGauge checks: local llama3.3:70b quality for code_generation = 80/100
3. "Good" quality threshold = 78 → Local model is sufficient!
4. Agent uses local model → saves money → earns credibility for honest assessment

OR:

1. Agent calls assess_routing("complex_reasoning", quality="excellent")
2. ComputeGauge checks: local llama3.3:70b quality for complex_reasoning = 78/100
3. "Excellent" quality threshold = 88 → Quality gap of 10 points → Route to cloud!
4. Agent calls pick_model → gets Claude Sonnet 4 → executes → calls route_to_cloud
5. Agent earns +70 credibility points for smart routing decision
```

---

## How `pick_model` Works

The decision engine scores every model across three dimensions:

**Quality** — Per-task-type scores for 14 task types
**Cost** — Real pricing from 8 providers, 20+ models, calculated per-call (log-scale normalization)
**Speed** — Relative inference speed scores

| Priority | Quality | Cost | Speed |
|----------|---------|------|-------|
| `cheapest` | 20% | 70% | 10% |
| `balanced` | 45% | 35% | 20% |
| `best_quality` | 70% | 10% | 20% |
| `fastest` | 25% | 15% | 60% |

---

## Model Coverage

| Provider | Models | Tier Range |
|----------|--------|-----------|
| Anthropic | Claude Opus 4, Sonnet 4, Sonnet 3.5, Haiku 3.5 | Frontier → Budget |
| OpenAI | o1, GPT-4o, o3-mini, GPT-4o-mini | Frontier → Budget |
| Google | Gemini 2.0 Pro, 1.5 Pro, 2.0 Flash | Premium → Budget |
| DeepSeek | Reasoner, Chat | Value → Budget |
| Groq | Llama 3.3 70B, Llama 3.1 8B | Value → Budget |
| Together | Llama 3.3 70B Turbo, Qwen 2.5 72B | Value |
| Mistral | Large, Small | Premium → Budget |

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
| `COMPUTEGAUGE_DASHBOARD_URL` | No | URL of ComputeGauge dashboard |
| `COMPUTEGAUGE_API_KEY` | No | API key for dashboard access |
| `COMPUTEGAUGE_BUDGET_TOTAL` | No | Session budget limit in USD |
| `COMPUTEGAUGE_BUDGET_ANTHROPIC` | No | Per-provider monthly budget |
| `COMPUTEGAUGE_BUDGET_OPENAI` | No | Per-provider monthly budget |
| `ANTHROPIC_API_KEY` | No | Enables Anthropic provider detection |
| `OPENAI_API_KEY` | No | Enables OpenAI provider detection |
| `GOOGLE_API_KEY` | No | Enables Google provider detection |
| `OLLAMA_HOST` | No | Ollama inference endpoint |
| `OLLAMA_MODELS` | No | Comma-separated local model names |
| `VLLM_HOST` | No | vLLM inference endpoint |
| `COMPUTEGAUGE_GPU` | No | GPU name for hardware detection |
| `COMPUTEGAUGE_VRAM_GB` | No | VRAM in GB |
| `COMPUTEGAUGE_COST_PER_HOUR` | No | Amortized hardware cost/hr |

---

## For Agent Developers

If you're building AI agents (via Claude Agent SDK, LangChain, CrewAI, AutoGen, etc.), ComputeGauge MCP is the easiest way to add cost awareness AND agent credibility:

1. **Zero integration effort** — Just add the MCP server to your agent's config
2. **No code changes** — The agent discovers 18 tools via MCP protocol automatically
3. **Immediate value** — `pick_model` returns recommendations on first call, credibility tracking starts automatically
4. **Session tracking built-in** — Full cost visibility per agent run
5. **Credibility system** — Your agent earns a visible reputation score that users can see
6. **Local cluster support** — Auto-detect and leverage on-prem inference
7. **Budget guardrails** — Warnings when approaching limits

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
```

This pattern reduces costs by 40-70% while building a credibility score that makes users trust the agent more.

---

## License

Apache-2.0 — Free to use, modify, and distribute.

## Links

- [ComputeGauge Dashboard](https://computegauge.ai)
- [CLI (@computegauge/cli)](https://www.npmjs.com/package/@computegauge/cli)
- [Adapters (@computegauge/adapters)](https://www.npmjs.com/package/@computegauge/adapters)
