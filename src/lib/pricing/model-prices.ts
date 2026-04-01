// Model pricing database — shared across MCP server, proxy, ingest, and recommendations
// Update these when providers change pricing

export interface ModelPrice {
  provider: string;
  model: string;
  inputPerMToken: number;   // $ per 1M input tokens
  outputPerMToken: number;  // $ per 1M output tokens
  context: number;          // max context window
  category: 'chat' | 'embedding' | 'image';
}

export const MODEL_PRICES: ModelPrice[] = [
  // Anthropic
  { provider: 'ANTHROPIC', model: 'claude-opus-4', inputPerMToken: 15.0, outputPerMToken: 75.0, context: 200000, category: 'chat' },
  { provider: 'ANTHROPIC', model: 'claude-sonnet-4', inputPerMToken: 3.0, outputPerMToken: 15.0, context: 200000, category: 'chat' },
  { provider: 'ANTHROPIC', model: 'claude-haiku-3.5', inputPerMToken: 0.25, outputPerMToken: 1.25, context: 200000, category: 'chat' },
  // OpenAI
  { provider: 'OPENAI', model: 'gpt-4o', inputPerMToken: 2.50, outputPerMToken: 10.0, context: 128000, category: 'chat' },
  { provider: 'OPENAI', model: 'gpt-4o-mini', inputPerMToken: 0.15, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  { provider: 'OPENAI', model: 'o1', inputPerMToken: 15.0, outputPerMToken: 60.0, context: 200000, category: 'chat' },
  { provider: 'OPENAI', model: 'o3-mini', inputPerMToken: 1.10, outputPerMToken: 4.40, context: 200000, category: 'chat' },
  // Google
  { provider: 'GOOGLE', model: 'gemini-2.5-pro', inputPerMToken: 1.25, outputPerMToken: 10.0, context: 1000000, category: 'chat' },
  { provider: 'GOOGLE', model: 'gemini-2.0-flash', inputPerMToken: 0.10, outputPerMToken: 0.40, context: 1000000, category: 'chat' },
  // DeepSeek
  { provider: 'DEEPSEEK', model: 'deepseek-v3', inputPerMToken: 0.27, outputPerMToken: 1.10, context: 128000, category: 'chat' },
  { provider: 'DEEPSEEK', model: 'deepseek-reasoner', inputPerMToken: 0.55, outputPerMToken: 2.19, context: 128000, category: 'chat' },
  // Together AI
  { provider: 'TOGETHER', model: 'llama-3.3-70b-turbo', inputPerMToken: 0.88, outputPerMToken: 0.88, context: 128000, category: 'chat' },
  { provider: 'TOGETHER', model: 'mixtral-8x22b', inputPerMToken: 1.20, outputPerMToken: 1.20, context: 65536, category: 'chat' },
  // Groq
  { provider: 'GROQ', model: 'llama-3.3-70b', inputPerMToken: 0.59, outputPerMToken: 0.79, context: 128000, category: 'chat' },
  { provider: 'GROQ', model: 'mixtral-8x7b', inputPerMToken: 0.24, outputPerMToken: 0.24, context: 32768, category: 'chat' },
  // Mistral
  { provider: 'MISTRAL', model: 'mistral-large', inputPerMToken: 2.0, outputPerMToken: 6.0, context: 128000, category: 'chat' },
  { provider: 'MISTRAL', model: 'mistral-small', inputPerMToken: 0.20, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  // Cohere
  { provider: 'COHERE', model: 'command-r-plus', inputPerMToken: 2.50, outputPerMToken: 10.0, context: 128000, category: 'chat' },
  { provider: 'COHERE', model: 'command-r', inputPerMToken: 0.15, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  // Fireworks
  { provider: 'FIREWORKS', model: 'llama-3.3-70b', inputPerMToken: 0.90, outputPerMToken: 0.90, context: 128000, category: 'chat' },
  // xAI (Grok) — NEW
  { provider: 'XAI', model: 'grok-3', inputPerMToken: 3.0, outputPerMToken: 15.0, context: 131072, category: 'chat' },
  { provider: 'XAI', model: 'grok-3-mini', inputPerMToken: 0.30, outputPerMToken: 0.50, context: 131072, category: 'chat' },
  // Perplexity — NEW
  { provider: 'PERPLEXITY', model: 'sonar-pro', inputPerMToken: 3.0, outputPerMToken: 15.0, context: 200000, category: 'chat' },
  { provider: 'PERPLEXITY', model: 'sonar', inputPerMToken: 1.0, outputPerMToken: 1.0, context: 128000, category: 'chat' },
  // Cerebras — NEW
  { provider: 'CEREBRAS', model: 'llama-3.3-70b', inputPerMToken: 0.60, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  // SambaNova — NEW
  { provider: 'SAMBANOVA', model: 'llama-3.1-70b', inputPerMToken: 0.60, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  { provider: 'SAMBANOVA', model: 'llama-3.1-405b', inputPerMToken: 5.0, outputPerMToken: 15.0, context: 128000, category: 'chat' },
  // Decentralized AI Compute — Bittensor (subsidized pricing via TAO emissions)
  { provider: 'BITTENSOR', model: 'bittensor/llama-3.3-70b', inputPerMToken: 0.18, outputPerMToken: 0.18, context: 128000, category: 'chat' },
  { provider: 'BITTENSOR', model: 'bittensor/llama-3.1-405b', inputPerMToken: 1.20, outputPerMToken: 1.20, context: 128000, category: 'chat' },
  { provider: 'BITTENSOR', model: 'bittensor/mixtral-8x22b', inputPerMToken: 0.30, outputPerMToken: 0.30, context: 65536, category: 'chat' },
  { provider: 'BITTENSOR', model: 'bittensor/qwen-2.5-72b', inputPerMToken: 0.20, outputPerMToken: 0.20, context: 128000, category: 'chat' },
  { provider: 'BITTENSOR', model: 'bittensor/covenant-72b', inputPerMToken: 0.20, outputPerMToken: 0.20, context: 32768, category: 'chat' },
  // Decentralized AI Compute — Akash Network (reverse auction GPU marketplace)
  { provider: 'AKASH', model: 'akash/llama-3.3-70b', inputPerMToken: 0.30, outputPerMToken: 0.30, context: 128000, category: 'chat' },
  { provider: 'AKASH', model: 'akash/llama-3.1-405b', inputPerMToken: 2.00, outputPerMToken: 2.00, context: 128000, category: 'chat' },
  { provider: 'AKASH', model: 'akash/mixtral-8x22b', inputPerMToken: 0.40, outputPerMToken: 0.40, context: 65536, category: 'chat' },
  // Decentralized AI Compute — Hyperbolic (distributed GPU network)
  { provider: 'HYPERBOLIC', model: 'hyperbolic/llama-3.3-70b', inputPerMToken: 0.20, outputPerMToken: 0.20, context: 128000, category: 'chat' },
  { provider: 'HYPERBOLIC', model: 'hyperbolic/llama-3.1-405b', inputPerMToken: 1.50, outputPerMToken: 1.50, context: 128000, category: 'chat' },
  { provider: 'HYPERBOLIC', model: 'hyperbolic/deepseek-v3', inputPerMToken: 0.15, outputPerMToken: 0.15, context: 128000, category: 'chat' },
];

/** Calculate cost for a request given model, input tokens, and output tokens */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES.find(p => p.model === model);
  if (!price) return 0;
  return (inputTokens / 1_000_000) * price.inputPerMToken + (outputTokens / 1_000_000) * price.outputPerMToken;
}

/** Find price entry by model name (case-insensitive, partial match) */
export function findModelPrice(model: string): ModelPrice | undefined {
  const normalized = model.toLowerCase();
  return MODEL_PRICES.find(p => p.model.toLowerCase() === normalized)
    || MODEL_PRICES.find(p => normalized.includes(p.model.toLowerCase()));
}

/** Get all models for a provider */
export function getProviderModels(provider: string): ModelPrice[] {
  return MODEL_PRICES.filter(p => p.provider === provider.toUpperCase());
}
