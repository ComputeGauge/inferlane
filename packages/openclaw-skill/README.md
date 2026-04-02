# @inferlane/openclaw-skill

MCP server for OpenClaw decentralized compute network operators. Monitor nodes, track earnings, manage KV cache, and register new nodes.

## Install

```bash
npx -y @inferlane/openclaw-skill
```

Or add to MCP config:

```json
{
  "mcpServers": {
    "openclaw": {
      "command": "npx",
      "args": ["-y", "@inferlane/openclaw-skill"]
    }
  }
}
```

## Tools

- `node_status` — View online nodes and their health
- `node_earnings` — Track pending balance and payouts
- `kv_cache_status` — Monitor cached contexts and earnings
- `register_node` — Register a new compute node
- `network_health` — Network-wide stats and region distribution

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFERLANE_API_URL` | No | API base URL (default: http://localhost:3000) |
| `INFERLANE_API_KEY` | No | API key for authenticated operations |

## License

Apache-2.0
