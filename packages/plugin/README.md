# InferLane for Claude Code

**The only cost-intelligence layer that tracks the true price of Claude Managed Agents** — including the $0.08/hr active-runtime charge and $10/1000 web-search fees that every other tool ignores.

Routes routine tasks to local Gemma 4 for free. Tracks spend across Anthropic, OpenAI, Google, DeepSeek, Groq, and 10+ other providers. Teaches Claude to pick the cheapest sufficient model before every non-trivial API call.

Works with Claude Code, Claude Desktop, Goose, Cursor, and any MCP-compatible agent.

```
/plugin marketplace add ComputeGauge/inferlane
/plugin install inferlane@inferlane
```

---

## Why this exists

In 90 days of tracking real Claude Code usage, we found:

- **73% of Opus requests** could have been handled by Haiku or a local model at 60× lower cost
- **Managed Agent runtime fees** ($0.08 per active session-hour + web searches) are invisible to every existing monitoring tool
- **Multi-agent fleets** run up surprise bills because there's no per-fleet budget tracking

InferLane fixes all three.

## What makes it different

Most cost trackers (Helicone, Langfuse, Portkey) show you what you *already* spent. InferLane does three things they don't:

### 1. Fleet-session cost aggregation — not per-request

Every other tool treats each API call in isolation. InferLane groups calls into **fleet sessions** — a real agent run with a start, end, tool calls, web searches, and active runtime. That's the unit Anthropic actually bills you on for Managed Agents. Per session we aggregate:

- Token cost (standard)
- **Runtime cost** — active session-hours × $0.08 (idle time excluded)
- **Web search cost** — searches × $0.01
- Total cost of ownership — the number that actually matches your invoice

Works for Anthropic Managed Agents, Claude Agent SDK, Claude Code, Goose, SwarmClaw, and anything else via `@inferlane/agent-hooks`.

### 2. Pre-flight model picking, not post-hoc logging

Most cost tools tell you what you already spent. InferLane tells you **what to spend** — `il_suggest_model` is called *before* the expensive API call, not after. The skill teaches Claude to call it whenever the user mentions cost, whenever a task is repetitive enough that a cheaper model would work, or whenever a subagent is about to be spawned. Three of the six tools work completely offline (no API key needed); see the full list in the [Tools](#tools) section below.

### 3. Local-to-cloud routing you can actually run

InferLane ships with a one-command setup that installs Ollama, pulls Gemma 4 (auto-sized to your hardware), and configures routing. After install, simple tasks like extraction, classification, and routine code comments run on your laptop for free; only reasoning-heavy work hits the cloud.

```bash
curl -fsSL https://inferlane.dev/install.sh | bash
```

No VPN, no account, no credit card. Done in 5 minutes.

---

## Install

From this repo directly:

```
/plugin marketplace add ComputeGauge/inferlane
/plugin install inferlane@inferlane
```

The plugin will prompt you for an optional InferLane API key. You can skip it — offline tools work without one. Grab a free key at [inferlane.dev](https://inferlane.dev) when you want spend tracking, promotions, and fleet dashboards.

## What gets installed

The plugin bundles:

- **InferLane skill** — teaches Claude when to use the tools (before picking a model, after API calls, when asked about cost)
- **`@inferlane/mcp-server`** — the MCP server with 6 tools, spawned via `npx` when Claude Code starts

### Tools

| Tool | What it does | Offline? |
|---|---|---|
| `il_estimate_cost` | Per-provider cost breakdown for a given workload | Yes |
| `il_compare_models` | Side-by-side comparison of equivalent models (including Gemma 4 local) | Yes |
| `il_suggest_model` | Pick the cheapest-sufficient model for a task | Yes |
| `il_check_promotions` | Active discounts across providers | Needs key |
| `il_get_spend` | Your real spend broken down by provider | Needs key |
| `il_route_request` | Dispatch a prompt through the smart router | Needs key |

## Privacy

- The MCP server runs **locally as a stdio subprocess** spawned by Claude Code. It's not a hosted service for the offline tools.
- Offline tools never make network requests. Your prompts and token counts stay on your machine.
- Online tools only send what's strictly needed: model names, token estimates, task type. **Never prompt content.**
- Your API key is stored via Claude Code's `userConfig` with `sensitive: true` — it goes into your system keychain, not a config file.

## Related packages

- [`@inferlane/mcp-server`](https://www.npmjs.com/package/@inferlane/mcp-server) — the MCP server (use directly with Goose, Cursor, Claude Desktop)
- [`@inferlane/agent-hooks`](https://www.npmjs.com/package/@inferlane/agent-hooks) — lifecycle hooks for the Claude Agent SDK that auto-log tokens, cost, and runtime

## License

MIT. Code is on GitHub at [ComputeGauge/inferlane](https://github.com/ComputeGauge/inferlane).
