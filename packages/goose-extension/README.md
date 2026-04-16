# InferLane Extension for Goose

Smart AI model routing for [Goose](https://github.com/block/goose) — pick the optimal model for every task, track costs, and route between local (Ollama) and cloud providers automatically.

## Install

Add to your `~/.config/goose/config.yaml` under `extensions:`:

```yaml
extensions:
  inferlane:
    name: InferLane
    type: stdio
    enabled: true
    cmd: npx
    args: [-y, "@inferlane/mcp-server"]
    description: "AI model routing, cost optimization, credibility tracking"
    timeout: 60
    bundled: false
    available_tools: []
```

Or use the recipe deeplink:

```
goose://recipe?extensions=inferlane&cmd=npx&args=-y,@inferlane/mcp-server
```

## Tools Available

| Tool | Description |
|------|-------------|
| `pick_model` | Choose optimal model for a task (code, reasoning, translation, etc.) |
| `assess_routing` | Determine if a task should run locally or in the cloud |
| `session_cost` | Track spend for the current session |
| `cluster_status` | View local inference endpoints (Ollama, vLLM, etc.) |
| `route_to_cloud` | Report when local models aren't sufficient |
| `log_request` | Track API costs for spend analytics |

## Local Inference (Ollama + Gemma 4)

Set these env vars to enable local routing:

```bash
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_MODELS=gemma4,llama3.3:70b,deepseek-v3
```

InferLane will automatically route simple tasks to your local models (zero cost) and escalate complex tasks to cloud providers.

## Multi-Model with InferLane

Combine Goose's lead/worker pattern with InferLane routing:

```bash
# Sonnet plans, Gemma 4 executes locally (minimal cost)
GOOSE_PROVIDER=ollama GOOSE_MODEL=gemma4 \
GOOSE_LEAD_PROVIDER=anthropic GOOSE_LEAD_MODEL=claude-sonnet-4-20250514 \
goose session
```

## License

MIT
