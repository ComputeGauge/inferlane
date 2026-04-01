# @inferlane/sdk

Multi-provider LLM gateway SDK. One API key, any model, smart routing.

## Install

```bash
npm install @inferlane/sdk
```

## Quick Start

### OpenAI Drop-in Replacement

The fastest way to start -- swap your `baseURL` and API key:

```typescript
import OpenAI from 'openai';
import { createOpenAIClient } from '@inferlane/sdk/openai';

const openai = new OpenAI(createOpenAIClient('il_xxx'));

// Use any model from any provider through the same client
const res = await openai.chat.completions.create({
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Native SDK

```typescript
import { InferLane } from '@inferlane/sdk';

const cg = new InferLane({ apiKey: 'il_xxx' });

// Non-streaming
const response = await cg.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Streaming
const stream = await cg.chat({
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Features

| Feature | Description |
|---|---|
| Multi-provider | Anthropic, OpenAI, Google, DeepSeek, Groq, Together, Fireworks, and more |
| Smart routing | `cheapest`, `fastest`, `quality`, `budget`, `fallback`, `direct` strategies |
| OpenAI-compatible | Works with any OpenAI SDK client -- just change `baseURL` |
| Streaming | SSE-based streaming with async iterables |
| Cost estimation | Pre-request cost estimates with phase-aware breakdown (prefill vs decode) |
| Framework adapters | Vercel AI SDK and LangChain integrations with zero extra dependencies |
| Partner ingest | Usage data ingestion for integration partners |

## Export Paths

### `@inferlane/sdk` -- Core Client

```typescript
import { InferLane, InferLaneError } from '@inferlane/sdk';

const cg = new InferLane({
  apiKey: 'il_xxx',
  routing: 'cheapest',  // default routing strategy
  timeout: 30000,       // ms
});

// Smart routing -- find the cheapest provider for this model
const res = await cg.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Summarize this' }],
  routing: 'cheapest',
});

// Budget-constrained routing
const res2 = await cg.chat({
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }],
  routing: 'budget',
  budget: 0.002, // max cost in USD
});

// Automatic fallback across providers
const res3 = await cg.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  fallback: true,
});
```

### `@inferlane/sdk/openai` -- OpenAI Compatibility

```typescript
import OpenAI from 'openai';
import { createOpenAIClient } from '@inferlane/sdk/openai';

const openai = new OpenAI(createOpenAIClient('il_xxx'));
// Use openai.chat.completions.create() with any model name
```

### `@inferlane/sdk/estimate` -- Cost Estimation

```typescript
import { estimateCost } from '@inferlane/sdk/estimate';

const estimate = await estimateCost('il_xxx', {
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
});

console.log(estimate.estimatedCost);             // total USD
console.log(estimate.breakdown);                 // { prefill, decode }
console.log(estimate.cheapestAlternative);       // cheapest model for this task
console.log(estimate.alternatives);              // ranked alternatives with savings %
```

### `@inferlane/sdk/vercel-ai` -- Vercel AI SDK Provider

Implements `LanguageModelV1` with zero runtime dependency on `ai`.

```typescript
import { createInferLane } from '@inferlane/sdk/vercel-ai';
import { generateText, streamText } from 'ai';

const cg = createInferLane({ apiKey: 'il_xxx', routing: 'cheapest' });

const result = await generateText({
  model: cg('claude-sonnet-4'),
  prompt: 'Hello',
});

const stream = await streamText({
  model: cg('gpt-4o'),
  prompt: 'Hello',
});
```

### `@inferlane/sdk/langchain` -- LangChain Integration

Supports `invoke`, `stream`, `batch`, and `pipe` with zero runtime dependency on `@langchain/core`.

```typescript
import { InferLaneLLM } from '@inferlane/sdk/langchain';

const model = new InferLaneLLM({
  apiKey: 'il_xxx',
  model: 'claude-sonnet-4',
  routing: 'cheapest',
  temperature: 0.7,
  maxTokens: 1024,
});

// Simple call
const result = await model.invoke('Hello');

// Streaming
for await (const chunk of model.stream('Hello')) {
  process.stdout.write(chunk);
}

// Batch
const results = await model.batch(['Hello', 'World']);

// Chain with pipe()
const chain = prompt.pipe(model).pipe(outputParser);
```

### `@inferlane/sdk/ingest` -- Partner Usage Ingestion

For integration partners sending LLM usage data to InferLane.

```typescript
import { InferLaneIngest } from '@inferlane/sdk/ingest';

const ingest = new InferLaneIngest({ apiKey: 'ilp_xxx' });

await ingest.ingest([{
  userRef: 'user@example.com',
  provider: 'OPENAI',
  model: 'gpt-4o',
  inputTokens: 500,
  outputTokens: 200,
}]);

// Auto-chunked for large batches (1000 records per request)
await ingest.ingestAll(largeRecordArray);

// Partner stats
const stats = await ingest.stats();
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | *required* | API key (`il_` prefix for users, `ilp_` for partners) |
| `baseUrl` | `string` | `https://inferlane.com` | API base URL |
| `routing` | `RoutingStrategy` | `'direct'` | Default routing: `direct`, `cheapest`, `fastest`, `quality`, `budget`, `fallback` |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |

## Routing Strategies

| Strategy | Behavior |
|---|---|
| `direct` | Send to the exact model/provider specified |
| `cheapest` | Route to the lowest-cost provider for the requested model |
| `fastest` | Route to the lowest-latency provider |
| `quality` | Route to the highest-quality provider |
| `budget` | Stay under a USD budget cap (set via `budget` param) |
| `fallback` | Auto-failover across providers if the primary is down |

## Error Handling

```typescript
import { InferLane, InferLaneError } from '@inferlane/sdk';

try {
  const res = await cg.chat({ model: 'gpt-4o', messages });
} catch (err) {
  if (err instanceof InferLaneError) {
    console.error(err.status);  // HTTP status code
    console.error(err.body);    // Raw error response body
  }
}
```

## License

MIT
