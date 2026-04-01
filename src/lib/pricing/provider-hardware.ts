// ---------------------------------------------------------------------------
// Provider Hardware Map (Stream AA1)
// ---------------------------------------------------------------------------
// Maps cloud provider + model combinations to inferred hardware specs so
// calculatePhaseAwareCost() can price non-NODE requests accurately.
//
// Hardware specs are inferred from publicly available information:
// - Anthropic: Custom TPU/H100 clusters (HBM3E-class bandwidth)
// - OpenAI: H100 SXM clusters
// - Google: TPUv5e/v5p (highest bandwidth, custom memory)
// - Groq: LPU custom ASICs (optimised for inference, ultra-high bandwidth)
// - Cerebras: WSE-3 wafer-scale (extreme bandwidth)
// - Together/Fireworks: H100/A100 mix (inference clouds)
// - DeepSeek: H100/H800 clusters
// - Others: A100 assumed as conservative default
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProviderHardwareSpec {
  memoryTechnology: string;       // matches MemoryTechnology type in decode-pricing.ts
  memoryBandwidthGBs: number;     // estimated GB/s
  description: string;
}

// ── Provider-Level Defaults ────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<string, ProviderHardwareSpec> = {
  ANTHROPIC:  { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 3350, description: 'Custom TPU/H100 clusters' },
  OPENAI:     { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 3350, description: 'H100 SXM clusters' },
  GOOGLE:     { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'TPUv5e/v5p' },
  GROQ:       { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'LPU custom ASICs' },
  CEREBRAS:   { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'WSE-3 wafer-scale' },
  DEEPSEEK:   { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 3350, description: 'H100/H800 clusters' },
  TOGETHER:   { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 2000, description: 'H100/A100 inference cloud' },
  FIREWORKS:  { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 2000, description: 'H100/A100 inference cloud' },
  MISTRAL:    { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 2000, description: 'A100/H100 clusters' },
  COHERE:     { memoryTechnology: 'HBM2E', memoryBandwidthGBs: 2000, description: 'A100 clusters' },
  XAI:        { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 3350, description: 'H100 Memphis cluster' },
  PERPLEXITY: { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 2000, description: 'Cloud GPU mix' },
  SAMBANOVA:  { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 3350, description: 'SN40L RDU' },
  REPLICATE:  { memoryTechnology: 'HBM2E', memoryBandwidthGBs: 2000, description: 'A100/A10G mix' },
  LEPTON:     { memoryTechnology: 'HBM2E', memoryBandwidthGBs: 2000, description: 'A100 inference' },
  LAMBDA:     { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 3350, description: 'H100 cloud' },
};

// ── Model-Specific Overrides ───────────────────────────────────────────────
// Only needed when a specific model runs on different hardware than the
// provider's default (e.g. smaller models on A100 vs larger on H100).

const MODEL_OVERRIDES: Record<string, ProviderHardwareSpec> = {
  // OpenAI reasoning models likely on dedicated H100 clusters
  'OPENAI:o1':            { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 3350, description: 'H100 SXM dedicated reasoning' },
  'OPENAI:o3-mini':       { memoryTechnology: 'HBM3',  memoryBandwidthGBs: 3350, description: 'H100 SXM' },
  // Google 1M context models use TPUv5p with higher bandwidth
  'GOOGLE:gemini-2.5-pro': { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'TPUv5p long-context' },
  // Groq's LPU has extreme decode throughput
  'GROQ:llama-3.3-70b':  { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'LPU — ultra-fast decode' },
  'GROQ:mixtral-8x7b':   { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 4800, description: 'LPU — ultra-fast decode' },
  // SambaNova large models on RDU
  'SAMBANOVA:llama-3.1-405b': { memoryTechnology: 'HBM3E', memoryBandwidthGBs: 3350, description: 'SN40L RDU 405B' },
};

// ── Fallback ───────────────────────────────────────────────────────────────

const FALLBACK_HARDWARE: ProviderHardwareSpec = {
  memoryTechnology: 'UNKNOWN',
  memoryBandwidthGBs: 2000,
  description: 'Unknown hardware — conservative estimate',
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the inferred hardware spec for a provider + model combination.
 *
 * Lookup order:
 *   1. Model-specific override (PROVIDER:model key)
 *   2. Provider-level default
 *   3. Global fallback (UNKNOWN, 2000 GB/s)
 */
export function getProviderHardware(
  provider: string,
  model: string,
): ProviderHardwareSpec {
  const key = `${provider.toUpperCase()}:${model}`;

  // 1. Model-specific override
  if (MODEL_OVERRIDES[key]) {
    return MODEL_OVERRIDES[key];
  }

  // 2. Provider-level default
  const providerUpper = provider.toUpperCase();
  if (PROVIDER_DEFAULTS[providerUpper]) {
    return PROVIDER_DEFAULTS[providerUpper];
  }

  // 3. Global fallback
  return FALLBACK_HARDWARE;
}

/**
 * Get all known provider hardware specs (for admin/debug views).
 */
export function getAllProviderHardware(): Record<string, ProviderHardwareSpec> {
  return { ...PROVIDER_DEFAULTS };
}
