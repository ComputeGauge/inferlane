# @inferlane/sdk

TypeScript SDK for the InferLane API. Route, schedule, and optimize AI inference across providers.

## Install

```bash
npm install @inferlane/sdk
```

## Quick Start

```typescript
import { InferLane } from '@inferlane/sdk';

const il = new InferLane({ apiKey: 'il_...' });

// Route to cheapest provider
const response = await il.dispatch({
  prompt: 'Explain quantum computing',
  routing: 'cheapest',
});

// Schedule for later
await il.schedule({
  prompt: 'Generate weekly report',
  model: 'claude-sonnet-4',
  scheduleType: 'RECURRING',
  cronExpression: '0 9 * * 1',
});

// Check savings
const savings = await il.savings({ period: '30d' });
console.log(`Saved $${savings.totalSaved}`);
```

## Subpath Exports

```typescript
import { ... } from '@inferlane/sdk';           // Core SDK
import { ... } from '@inferlane/sdk/openai';     // OpenAI-compatible client
import { ... } from '@inferlane/sdk/ingest';     // Usage ingestion
import { ... } from '@inferlane/sdk/estimate';   // Cost estimation
import { ... } from '@inferlane/sdk/vercel-ai';  // Vercel AI SDK integration
import { ... } from '@inferlane/sdk/langchain';  // LangChain integration
```

## API Reference

### `dispatch(options)` — Send a prompt
### `schedule(options)` — Schedule a prompt
### `triage(options)` — Classify a prompt
### `savings(options)` — View cost savings
### `models()` — List available models
### `health()` — Provider health status

## License

MIT
