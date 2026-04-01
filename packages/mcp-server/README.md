# @inferlane/mcp-server

MCP server for LLM cost estimation, model comparison, and multi-provider smart routing. 3 tools work offline with zero config. 3 more unlock spend tracking, promotions, and request routing with an API key.

**Providers covered**: OpenAI, Anthropic, Google, DeepSeek, Groq, Together, Fireworks, Cerebras, SambaNova, Mistral, Cohere, XAI, Perplexity

## Quick Start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add inferlane -- npx -y @inferlane/mcp-server
```

### VS Code / Cursor / Any MCP Client

```json
{
  "command": "npx",
  "args": ["-y", "@inferlane/mcp-server"]
}
```

No API key needed for offline tools. Add one later to unlock all 6.

## Tools

| Tool | Description | API Key |
|---|---|---|
| `il_estimate_cost` | Estimate cost of an LLM API call. Returns per-provider pricing comparison, cheapest option, and savings. | No |
| `il_compare_models` | Compare all equivalent models in a tier. Side-by-side pricing, quality scores, latency, context windows. | No |
| `il_suggest_model` | Recommend a model for a described task. Analyzes speed/quality/cost tradeoffs. | No |
| `il_check_promotions` | List active provider promotions, discounts, and free-tier offers. | Yes |
| `il_get_spend` | Spend summary by provider, model, and time period (today/week/month/quarter). | Yes |
| `il_route_request` | Send an LLM request through the multi-provider smart router. Auto-selects cheapest or fastest provider. | Yes |

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `INFERLANE_API_KEY` | No | Unlocks `il_check_promotions`, `il_get_spend`, `il_route_request`. Get one at [inferlane.com](https://inferlane.com). |
| `INFERLANE_BASE_URL` | No | Custom API endpoint (self-hosted deployments). |

To pass an API key in Claude Desktop config:

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp-server"],
      "env": {
        "INFERLANE_API_KEY": "il_your_key_here"
      }
    }
  }
}
```

## Example Output

### `il_estimate_cost`

Input: `{ "model": "claude-sonnet-4", "estimated_input_tokens": 1000, "estimated_output_tokens": 500 }`

```
## Cost Estimate: claude-sonnet-4 (workhorse tier)

| Model            | Provider  | Input $/M | Output $/M | Est. Cost | Quality |
|------------------|-----------|-----------|------------|-----------|---------|
| claude-sonnet-4  | ANTHROPIC | $3        | $15        | $0.010500 | 92/100  |
| gpt-4o-mini      | OPENAI    | $0.15     | $0.6       | $0.000450 | 80/100  |
| gemini-2.0-flash | GOOGLE    | $0.1      | $0.4       | $0.000300 | 78/100  |
| deepseek-chat    | DEEPSEEK  | $0.27     | $1.1       | $0.000820 | 82/100  |
```

### `il_compare_models`

Input: `{ "model": "claude-sonnet-4" }`

```
## Workhorse Tier — Model Comparison

| Model            | Provider  | Input $/M | Output $/M | Quality | Latency | Context |
|------------------|-----------|-----------|------------|---------|---------|---------|
| claude-sonnet-4  | ANTHROPIC | $3        | $15        | 92/100  | medium  | 200K    |
| gpt-4o-mini      | OPENAI    | $0.15     | $0.6       | 80/100  | fast    | 128K    |
| gemini-2.0-flash | GOOGLE    | $0.1      | $0.4       | 78/100  | fast    | 1049K   |
| deepseek-chat    | DEEPSEEK  | $0.27     | $1.1       | 82/100  | medium  | 64K     |

**Cheapest**: gemini-2.0-flash (GOOGLE)
**Highest quality**: claude-sonnet-4 (ANTHROPIC)
```

### `il_suggest_model`

Input: `{ "task_description": "real-time chat application", "priority": "speed" }`

```
## Model Recommendation

**Recommended**: gemini-2.0-flash (GOOGLE)

Fast inference with low cost. Gemini 2.0 Flash offers the best speed/cost
ratio for real-time applications at $0.10/$0.40 per million tokens.

### Alternatives
- gpt-4o-mini ($0.15/$0.60)
- groq/llama-3.3-70b ($0.59/$0.79)
- claude-haiku-3.5 ($0.80/$4.00)
```

### `il_check_promotions`

```
## Active LLM Provider Promotions

### GOOGLE — Free Tier
- **Multiplier**: 1x
- **Details**: Gemini 2.0 Flash free tier up to 1500 requests/day
- **Expires**: 2026-06-30
```

### `il_get_spend`

Input: `{ "period": "month" }`

Returns spend breakdown by provider and model with total cost, request counts, and token usage.

### `il_route_request`

Input: `{ "model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}], "routing": "cheapest" }`

Routes the request through the cheapest available provider for that model. Returns the completion plus routing metadata (cost, provider selected, routing reason).

## License

MIT
