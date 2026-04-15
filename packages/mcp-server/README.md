# @inferlane/mcp-server

MCP server for [InferLane](https://inferlane.dev) — smart model routing and cost optimization tools for AI agents. Works with Claude Code, Claude Desktop, Goose, Cursor, and any MCP-compatible client.

## What you get

The server exposes tools that let agents:

- **`il_suggest_model`** — pick the optimal model for a task (task type, quality tier, budget)
- **`il_compare_models`** — side-by-side comparison of models in the same capability tier
- **`il_estimate_cost`** — estimate the cost of a workload on specific models
- **`il_check_promotions`** — active discounts across providers (requires API key)
- **`il_get_spend`** — session/today/week/month spend summaries (requires API key)
- **`il_route_request`** — dispatch a prompt through the smart router (requires API key)

Offline tools (`il_estimate_cost`, `il_compare_models`, `il_suggest_model`) work without an InferLane account.

## Install — Claude Code

```bash
claude mcp add inferlane -- npx -y @inferlane/mcp-server
```

Or add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp-server"],
      "env": {
        "INFERLANE_API_KEY": "il_..."
      }
    }
  }
}
```

## Install — Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp-server"],
      "env": { "INFERLANE_API_KEY": "il_..." }
    }
  }
}
```

## Install — Goose

Add to `~/.config/goose/config.yaml` under `extensions:`:

```yaml
extensions:
  inferlane:
    name: InferLane
    type: stdio
    enabled: true
    cmd: npx
    args: ["-y", "@inferlane/mcp-server"]
    envs:
      INFERLANE_API_KEY: "il_..."
    timeout: 60
    bundled: false
    available_tools: []
```

## Environment variables

| Variable | Purpose |
|---|---|
| `INFERLANE_API_KEY` | Your InferLane API key. Get one at https://inferlane.dev/dashboard/settings. Optional — the server runs in offline mode without it and exposes the three offline tools. |
| `INFERLANE_BASE_URL` | Override the InferLane API base URL (default: `https://inferlane.dev`). Useful for self-hosted deployments. |

## HTTP transport (for Managed Agents / remote clients)

For cloud-hosted agent runtimes (Anthropic Managed Agents, hosted Claude Code, remote IDEs) that can't connect via stdio, run the HTTP server:

```bash
npx @inferlane/mcp-server inferlane-mcp-http
# or after install:
inferlane-mcp-http
```

The server listens on `http://127.0.0.1:3030/mcp` by default. Every session must authenticate with `Authorization: Bearer <INFERLANE_API_KEY>`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3030` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address. Set to `0.0.0.0` to expose on all interfaces (production containers). |
| `MCP_PATH` | `/mcp` | MCP endpoint path |
| `INFERLANE_ALLOW_ENV_FALLBACK` | *(unset)* | Set to `1` to let requests without a Bearer token fall back to the process-level `INFERLANE_API_KEY`. **Only safe in trusted single-tenant deployments** — leaves the server's configured key accessible to any reachable client. |

Health check at `GET /health`.

## Programmatic use (embed in your own server)

```typescript
import { createInferLaneServer } from '@inferlane/mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createInferLaneServer({
  apiKey: process.env.INFERLANE_API_KEY,
  // baseUrl: 'https://your-selfhost.example.com', // optional
});

await server.connect(new StdioServerTransport());
```

## License

MIT
