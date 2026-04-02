# InferLane

The intelligent inference platform. Route, schedule, and optimize AI workloads across every provider.

## Packages

| Package | Description |
|---------|-------------|
| [@inferlane/mcp](packages/mcp) | 41 MCP tools for cost intelligence and routing |
| [@inferlane/sdk](packages/sdk) | TypeScript SDK for the InferLane API |
| [@inferlane/cli](packages/cli) | Command-line interface |
| [@inferlane/adapters](packages/adapters) | Provider SDK wrappers with auto cost tracking |
| [@inferlane/openclaw-skill](packages/openclaw-skill) | OpenClaw decentralized compute MCP server |
| [@inferlane/mcp-server](packages/mcp-server) | MCP server integration utilities |

## Quick Start

Add InferLane to any MCP-compatible agent:

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

## Features

- **Smart Routing** — Auto-select the best provider based on cost, latency, and quality
- **AI Triage** — 14-dimension prompt classification with confidence scoring
- **Cross-Provider Sessions** — Start on Claude, continue on GPT-4, overflow to decentralized
- **Decode Economics** — Phase-aware pricing (prefill vs decode vs KV cache)
- **Prompt Scheduling** — Schedule, queue, and batch prompts with price-triggered execution
- **OpenClaw Network** — Decentralized compute with subnet specialization and proof of execution
- **Cost Savings** — Real-time savings tracking by category
- **Agent Credibility** — Score and leaderboard that follows agents across sessions
- **Policy Engine** — User-defined routing rules with PII protection
- **12-Layer Compression** — 40-70% token reduction

## License

Apache-2.0
