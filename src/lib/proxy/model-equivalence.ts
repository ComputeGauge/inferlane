// Model equivalence mapping for smart routing and fallback across providers.
// No external dependencies — all data is statically defined.

export interface ModelEquivalent {
  provider: string;
  model: string;
  inputPerMToken: number;
  outputPerMToken: number;
  contextWindow: number;
  qualityScore: number;
  latencyClass: 'fast' | 'medium' | 'slow';
}

export interface EquivalenceTier {
  name: string;
  description: string;
  models: ModelEquivalent[];
}

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

export const EQUIVALENCE_TIERS: EquivalenceTier[] = [
  {
    name: 'frontier',
    description: 'Best quality, highest cost',
    models: [
      {
        provider: 'ANTHROPIC',
        model: 'claude-opus-4-20250514',
        inputPerMToken: 15,
        outputPerMToken: 75,
        contextWindow: 200_000,
        qualityScore: 95,
        latencyClass: 'slow',
      },
      {
        provider: 'OPENAI',
        model: 'gpt-4o',
        inputPerMToken: 2.5,
        outputPerMToken: 10,
        contextWindow: 128_000,
        qualityScore: 88,
        latencyClass: 'medium',
      },
      {
        provider: 'GOOGLE',
        model: 'gemini-2.5-pro',
        inputPerMToken: 1.25,
        outputPerMToken: 10,
        contextWindow: 1_048_576,
        qualityScore: 90,
        latencyClass: 'medium',
      },
    ],
  },
  {
    name: 'workhorse',
    description: 'Best price/performance',
    models: [
      {
        provider: 'ANTHROPIC',
        // Current: claude-sonnet-4-5 (claude-sonnet-4-20250514 is
        // deprecated; normalized at request time via
        // @/lib/providers/anthropic-models).
        model: 'claude-sonnet-4-5',
        inputPerMToken: 3,
        outputPerMToken: 15,
        contextWindow: 200_000,
        qualityScore: 92,
        latencyClass: 'medium',
      },
      {
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        inputPerMToken: 0.15,
        outputPerMToken: 0.6,
        contextWindow: 128_000,
        qualityScore: 80,
        latencyClass: 'fast',
      },
      {
        provider: 'GOOGLE',
        model: 'gemini-2.0-flash',
        inputPerMToken: 0.1,
        outputPerMToken: 0.4,
        contextWindow: 1_048_576,
        qualityScore: 78,
        latencyClass: 'fast',
      },
      {
        provider: 'DEEPSEEK',
        model: 'deepseek-chat',
        inputPerMToken: 0.27,
        outputPerMToken: 1.1,
        contextWindow: 64_000,
        qualityScore: 82,
        latencyClass: 'medium',
      },
      {
        provider: 'GOOGLE',
        model: 'gemma-4-31b',
        inputPerMToken: 0.15,
        outputPerMToken: 0.6,
        contextWindow: 256_000,
        qualityScore: 84,
        latencyClass: 'medium',
      },
      {
        provider: 'OLLAMA',
        model: 'ollama/gemma4',
        inputPerMToken: 0,
        outputPerMToken: 0,
        contextWindow: 256_000,
        qualityScore: 84,
        latencyClass: 'medium',
      },
      {
        provider: 'DARKBLOOM',
        model: 'gemma-4-27b',
        inputPerMToken: 0.06,
        outputPerMToken: 0.20,
        contextWindow: 128_000,
        qualityScore: 72,
        latencyClass: 'medium',
      },
    ],
  },
  {
    name: 'speed',
    description: 'Lowest latency',
    models: [
      {
        provider: 'ANTHROPIC',
        model: 'claude-haiku-3.5-20241022',
        inputPerMToken: 0.8,
        outputPerMToken: 4,
        contextWindow: 200_000,
        qualityScore: 85,
        latencyClass: 'fast',
      },
      {
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        inputPerMToken: 0.15,
        outputPerMToken: 0.6,
        contextWindow: 128_000,
        qualityScore: 80,
        latencyClass: 'fast',
      },
      {
        provider: 'GOOGLE',
        model: 'gemini-2.0-flash-lite',
        inputPerMToken: 0.075,
        outputPerMToken: 0.3,
        contextWindow: 1_048_576,
        qualityScore: 70,
        latencyClass: 'fast',
      },
      {
        provider: 'GROQ',
        model: 'groq/llama-3.3-70b',
        inputPerMToken: 0.59,
        outputPerMToken: 0.79,
        contextWindow: 128_000,
        qualityScore: 75,
        latencyClass: 'fast',
      },
      {
        provider: 'GOOGLE',
        model: 'gemma-4-4b',
        inputPerMToken: 0.04,
        outputPerMToken: 0.15,
        contextWindow: 256_000,
        qualityScore: 72,
        latencyClass: 'fast',
      },
      {
        provider: 'OLLAMA',
        model: 'ollama/gemma4:2b',
        inputPerMToken: 0,
        outputPerMToken: 0,
        contextWindow: 256_000,
        qualityScore: 65,
        latencyClass: 'fast',
      },
    ],
  },
  {
    name: 'reasoning',
    description: 'Extended thinking',
    models: [
      {
        provider: 'ANTHROPIC',
        model: 'claude-opus-4-20250514',
        inputPerMToken: 15,
        outputPerMToken: 75,
        contextWindow: 200_000,
        qualityScore: 95,
        latencyClass: 'slow',
      },
      {
        provider: 'OPENAI',
        model: 'o1',
        inputPerMToken: 15,
        outputPerMToken: 60,
        contextWindow: 200_000,
        qualityScore: 93,
        latencyClass: 'slow',
      },
      {
        provider: 'OPENAI',
        model: 'o3-mini',
        inputPerMToken: 1.1,
        outputPerMToken: 4.4,
        contextWindow: 200_000,
        qualityScore: 82,
        latencyClass: 'medium',
      },
      {
        provider: 'DEEPSEEK',
        model: 'deepseek-reasoner',
        inputPerMToken: 0.55,
        outputPerMToken: 2.19,
        contextWindow: 64_000,
        qualityScore: 85,
        latencyClass: 'medium',
      },
      {
        provider: 'GOOGLE',
        model: 'gemini-2.5-pro',
        inputPerMToken: 1.25,
        outputPerMToken: 10,
        contextWindow: 1_048_576,
        qualityScore: 90,
        latencyClass: 'medium',
      },
    ],
  },
  {
    name: 'budget',
    description: 'Cheapest possible',
    models: [
      {
        provider: 'TOGETHER',
        model: 'together/llama-3.3-70b',
        inputPerMToken: 0.88,
        outputPerMToken: 0.88,
        contextWindow: 128_000,
        qualityScore: 72,
        latencyClass: 'medium',
      },
      {
        provider: 'FIREWORKS',
        model: 'fireworks/llama-3.3-70b',
        inputPerMToken: 0.9,
        outputPerMToken: 0.9,
        contextWindow: 128_000,
        qualityScore: 72,
        latencyClass: 'medium',
      },
      {
        provider: 'GROQ',
        model: 'groq/llama-3.3-70b',
        inputPerMToken: 0.59,
        outputPerMToken: 0.79,
        contextWindow: 128_000,
        qualityScore: 75,
        latencyClass: 'fast',
      },
      {
        provider: 'CEREBRAS',
        model: 'cerebras/llama-3.3-70b',
        inputPerMToken: 0.85,
        outputPerMToken: 0.85,
        contextWindow: 128_000,
        qualityScore: 71,
        latencyClass: 'fast',
      },
      {
        provider: 'SAMBANOVA',
        model: 'sambanova/llama-3.3-70b',
        inputPerMToken: 0.6,
        outputPerMToken: 0.6,
        contextWindow: 128_000,
        qualityScore: 70,
        latencyClass: 'fast',
      },
      // Decentralized AI compute — subsidized/marketplace pricing
      {
        provider: 'BITTENSOR',
        model: 'bittensor/llama-3.3-70b',
        inputPerMToken: 0.18,
        outputPerMToken: 0.18,
        contextWindow: 128_000,
        qualityScore: 68,
        latencyClass: 'slow',
      },
      {
        provider: 'HYPERBOLIC',
        model: 'hyperbolic/llama-3.3-70b',
        inputPerMToken: 0.20,
        outputPerMToken: 0.20,
        contextWindow: 128_000,
        qualityScore: 68,
        latencyClass: 'medium',
      },
      {
        provider: 'AKASH',
        model: 'akash/llama-3.3-70b',
        inputPerMToken: 0.30,
        outputPerMToken: 0.30,
        contextWindow: 128_000,
        qualityScore: 68,
        latencyClass: 'slow',
      },
      {
        provider: 'HYPERBOLIC',
        model: 'hyperbolic/deepseek-v3',
        inputPerMToken: 0.15,
        outputPerMToken: 0.15,
        contextWindow: 128_000,
        qualityScore: 72,
        latencyClass: 'medium',
      },
    ],
  },
  {
    name: 'embedding',
    description: 'Text embeddings',
    models: [
      {
        provider: 'OPENAI',
        model: 'text-embedding-3-small',
        inputPerMToken: 0.02,
        outputPerMToken: 0,
        contextWindow: 8_191,
        qualityScore: 78,
        latencyClass: 'fast',
      },
      {
        provider: 'OPENAI',
        model: 'text-embedding-3-large',
        inputPerMToken: 0.13,
        outputPerMToken: 0,
        contextWindow: 8_191,
        qualityScore: 90,
        latencyClass: 'fast',
      },
      {
        provider: 'VOYAGEAI',
        model: 'voyage-3',
        inputPerMToken: 0.06,
        outputPerMToken: 0,
        contextWindow: 32_000,
        qualityScore: 85,
        latencyClass: 'fast',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a flat index of model-name → tier for fast lookups. */
const modelTierIndex = new Map<string, string>();
for (const tier of EQUIVALENCE_TIERS) {
  for (const m of tier.models) {
    modelTierIndex.set(m.model.toLowerCase(), tier.name);
  }
}

/**
 * Case-insensitive partial match: returns the tier whose model list contains
 * a model whose name includes the query (or vice-versa).
 */
function resolveTier(model: string): EquivalenceTier | null {
  const q = model.toLowerCase();

  // Exact match first
  for (const tier of EQUIVALENCE_TIERS) {
    for (const m of tier.models) {
      if (m.model.toLowerCase() === q) return tier;
    }
  }

  // Partial match (query is substring of model name, or model name is substring of query)
  for (const tier of EQUIVALENCE_TIERS) {
    for (const m of tier.models) {
      const mLower = m.model.toLowerCase();
      if (mLower.includes(q) || q.includes(mLower)) return tier;
    }
  }

  return null;
}

/**
 * Weighted cost combining input and output prices.
 * Output is weighted 3x because it typically costs more and dominates real spend.
 */
function weightedCost(m: ModelEquivalent): number {
  return m.inputPerMToken + 3 * m.outputPerMToken;
}

const LATENCY_RANK: Record<string, number> = { fast: 0, medium: 1, slow: 2 };

// ---------------------------------------------------------------------------
// Provider detection patterns
// ---------------------------------------------------------------------------

const PROVIDER_PREFIXES: [RegExp, string][] = [
  [/^claude-/i, 'ANTHROPIC'],
  [/^gpt-/i, 'OPENAI'],
  [/^o[0-9]/i, 'OPENAI'],
  [/^text-embedding-/i, 'OPENAI'],
  [/^gemini-/i, 'GOOGLE'],
  [/^deepseek-/i, 'DEEPSEEK'],
  [/^groq\//i, 'GROQ'],
  [/^together\//i, 'TOGETHER'],
  [/^fireworks\//i, 'FIREWORKS'],
  [/^cerebras\//i, 'CEREBRAS'],
  [/^sambanova\//i, 'SAMBANOVA'],
  [/^voyage-/i, 'VOYAGEAI'],
  [/^gemma-/i, 'GOOGLE'],
  [/^llama-/i, 'META'],
  [/^mistral-/i, 'MISTRAL'],
  // Local inference
  [/^ollama\//i, 'OLLAMA'],
  // Decentralized AI compute providers
  [/^bittensor\//i, 'BITTENSOR'],
  [/^akash\//i, 'AKASH'],
  [/^hyperbolic\//i, 'HYPERBOLIC'],
  [/^darkbloom\//i, 'DARKBLOOM'],
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all models in the same equivalence tier as the given model. */
export function findEquivalents(model: string): ModelEquivalent[] {
  const tier = resolveTier(model);
  return tier ? tier.models : [];
}

/** Return the cheapest equivalent by weighted cost (input + 3*output). */
export function findCheapest(model: string): ModelEquivalent | null {
  const equivalents = findEquivalents(model);
  if (equivalents.length === 0) return null;

  return equivalents.reduce((best, cur) =>
    weightedCost(cur) < weightedCost(best) ? cur : best,
  );
}

/** Return the fastest equivalent (lowest latencyClass, then cheapest among ties). */
export function findFastest(model: string): ModelEquivalent | null {
  const equivalents = findEquivalents(model);
  if (equivalents.length === 0) return null;

  return equivalents.reduce((best, cur) => {
    const bestRank = LATENCY_RANK[best.latencyClass];
    const curRank = LATENCY_RANK[cur.latencyClass];
    if (curRank < bestRank) return cur;
    if (curRank === bestRank && weightedCost(cur) < weightedCost(best)) return cur;
    return best;
  });
}

/** Return the highest quality equivalent in the same tier. */
export function findBestQuality(model: string): ModelEquivalent | null {
  const equivalents = findEquivalents(model);
  if (equivalents.length === 0) return null;

  return equivalents.reduce((best, cur) =>
    cur.qualityScore > best.qualityScore ? cur : best,
  );
}

/** Return the tier name a model belongs to, or null if unknown. */
export function getModelTier(model: string): string | null {
  const tier = resolveTier(model);
  return tier ? tier.name : null;
}

/**
 * Given a model name and a target provider, return the equivalent model name
 * for that provider within the same tier, or null if none exists.
 */
export function mapModelToProvider(
  model: string,
  targetProvider: string,
): string | null {
  const tier = resolveTier(model);
  if (!tier) return null;

  const target = targetProvider.toUpperCase();
  const match = tier.models.find((m) => m.provider === target);
  return match ? match.model : null;
}

/** Infer the provider from a model name string. */
export function detectProvider(model: string): string {
  for (const [pattern, provider] of PROVIDER_PREFIXES) {
    if (pattern.test(model)) return provider;
  }
  return 'UNKNOWN';
}
