# @inferlane/agent-hooks

Drop-in lifecycle hooks that auto-log tokens, cost, active runtime, and web-search charges from Claude Agent SDK sessions (and Anthropic Managed Agents, Goose, SwarmClaw, or any runtime that exposes PreToolUse / PostToolUse / SessionStart / SessionEnd events) to [InferLane](https://inferlane.dev).

Zero tool calls from the agent. No `log_request` spam in the model's output. The hooks run transparently alongside your agent loop and post events to InferLane's fleet API in the background.

## Install

```bash
npm install @inferlane/agent-hooks
```

## Quick start — Claude Agent SDK

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { claudeAgentHooks } from '@inferlane/agent-hooks';

const hooks = claudeAgentHooks({
  apiKey: process.env.INFERLANE_API_KEY!,
  runtime: 'CLAUDE_AGENT_SDK',
  agentName: 'my-coding-assistant',
  fleetId: 'fleet_abc123', // optional — attach to a named fleet for rollups + budget alerts
});

for await (const msg of query({
  prompt: 'Refactor the auth module',
  options: { hooks },
})) {
  // handle agent messages
}
```

That's it. Every tool call, web search, and session completion is logged to InferLane. The dashboard shows token cost + runtime cost ($0.08/hr for Managed Agents) + web-search cost ($10/1000 for Managed Agents) in real time.

## What gets tracked

| Hook | Recorded data |
|---|---|
| `SessionStart` | Opens a fleet session (`POST /api/fleet/sessions`) |
| `PreToolUse` | Starts the active-runtime timer; posts `TOOL_USE` event |
| `PostToolUse` | Stops the timer; posts `TOOL_RESULT` event with token usage and active-runtime delta. Detects `web_search` / `WebSearch` calls and bumps the web-search counter. |
| `SessionEnd` | Marks the session `COMPLETED` |

Runtime cost is only charged for `ANTHROPIC_MANAGED` sessions (Anthropic bills $0.08 per active session-hour on Managed Agents; local Agent SDK runtime is free). Web-search cost is only charged when the runtime is `ANTHROPIC_MANAGED`.

## Advanced: granular control

If you'd rather manage hook registration yourself:

```typescript
import { createInferLaneHooks } from '@inferlane/agent-hooks';

const il = createInferLaneHooks({
  apiKey: process.env.INFERLANE_API_KEY!,
  runtime: 'CLAUDE_AGENT_SDK',
  debug: true,             // log hook activity to console
  swallowErrors: true,     // default — don't break the agent if telemetry fails
});

const options = {
  hooks: {
    SessionStart: [il.sessionStart],
    PreToolUse:   [il.preToolUse],
    PostToolUse:  [il.postToolUse],
    SessionEnd:   [il.sessionEnd],
  },
};

// On graceful shutdown:
process.on('SIGTERM', async () => {
  await il.flush(); // closes the active session cleanly
});
```

## Runtime field values

| Value | Use for |
|---|---|
| `ANTHROPIC_MANAGED` | Anthropic's cloud-hosted managed agent runtime |
| `CLAUDE_AGENT_SDK` | Self-hosted Claude Agent SDK |
| `CLAUDE_CODE` | Claude Code CLI / VS Code extension |
| `GOOSE` | Block's Goose agent |
| `SWARMCLAW` | SwarmClaw orchestrator |
| `CUSTOM` | Anything else — self-reported |

## Environment variables

| Variable | Purpose |
|---|---|
| `INFERLANE_API_KEY` | Bearer token for InferLane fleet API. Can also be passed via `apiKey` option. |
| `INFERLANE_BASE_URL` | Override base URL (default `https://inferlane.dev`). Useful for self-hosted InferLane. |

## Privacy

Hook options include `debug: true` which logs tool names and session IDs to `console.log`. **Do not enable `debug` in production** — tool names and payloads may contain user data.

The hooks never ship the contents of user prompts or tool inputs to InferLane by default. Only token counts, tool names, active-runtime durations, and web-search counts are recorded. To include tool payloads for debugging purposes, see the advanced configuration.

## License

MIT
