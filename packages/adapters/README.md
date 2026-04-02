# @inferlane/adapters

Provider SDK adapters for InferLane. Wraps Anthropic, OpenAI, Google, and other SDKs with automatic cost tracking and routing.

## Install

```bash
npm install @inferlane/adapters
```

## Usage

```typescript
import { createTrackedClient } from '@inferlane/adapters';

// Wraps Anthropic SDK with automatic cost logging
const anthropic = createTrackedClient('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  inferlaneKey: process.env.INFERLANE_API_KEY,
});

// Use as normal — costs are tracked automatically
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## Subpath Imports

```typescript
import { ... } from '@inferlane/adapters';            // All adapters
import { ... } from '@inferlane/adapters/anthropic';   // Anthropic only
import { ... } from '@inferlane/adapters/openai';      // OpenAI only
```

## Supported Providers

- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- AWS Bedrock
- Azure OpenAI
- Together AI
- Groq
- More coming

## License

Apache-2.0
