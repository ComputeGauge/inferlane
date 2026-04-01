// ---------------------------------------------------------------------------
// Decode-Aware Pricing Engine (Stream W2)
// ---------------------------------------------------------------------------
// LLM inference has two distinct phases with fundamentally different costs:
//
//   PREFILL (prompt ingestion):
//     - Compute-bound: parallelisable across GPU SMs
//     - Cost driver: FLOPs
//     - ~3-10x cheaper than decode in hardware terms
//
//   DECODE (token generation):
//     - Memory-bound: sequential, reads entire KV cache per token
//     - Cost driver: memory bandwidth (GB/s)
//     - The actual bottleneck — Ma & Patterson (2026)
//
//   KV CACHE (context retention):
//     - Memory-capacity-bound: VRAM consumed by cached contexts
//     - Cost driver: GB of HBM occupied × time
//     - Enables session persistence and P2P sharing
//
// This module replaces flat per-token pricing with phase-aware pricing
// that reflects the actual cost structure of inference hardware.
// ---------------------------------------------------------------------------

// Memory technology types — mirrors MemoryTechnology enum from Prisma schema
type MemoryTechnology = 'HBM3E' | 'HBM3' | 'HBM2E' | 'GDDR6X' | 'GDDR6' | 'DDR5' | 'UNKNOWN';

// ── Memory Technology Cost Multipliers ──────────────────────────────────

/** Cost multiplier by memory technology — reflects actual hardware cost/performance */
export const MEMORY_TECH_MULTIPLIERS: Record<string, number> = {
  HBM3E:   1.0,    // Baseline: highest bandwidth (4.8 TB/s), most expensive
  HBM3:    0.85,   // 3.35 TB/s — slightly cheaper
  HBM2E:   0.65,   // 2.0 TB/s — significantly cheaper
  GDDR6X:  0.35,   // 1.0 TB/s — consumer tier
  GDDR6:   0.25,   // 0.768 TB/s — budget consumer
  DDR5:    0.10,   // 0.064 TB/s — CPU inference only
  UNKNOWN: 0.50,   // Conservative default
};

// ── Phase-Aware Pricing ─────────────────────────────────────────────────

/** Base pricing per 1M tokens by phase (USD) */
export const PHASE_BASE_PRICING = {
  prefill: {
    perMillionTokens: 0.10,  // $0.10 / 1M input tokens
    description: 'Compute-bound prompt ingestion',
  },
  decode: {
    perMillionTokens: 0.30,  // $0.30 / 1M output tokens (3x prefill)
    description: 'Memory-bandwidth-bound token generation',
  },
  kvCache: {
    perGBHour: 0.01,         // $0.01 / GB / hour of retained context
    description: 'VRAM-capacity-bound context retention',
  },
} as const;

// ── Interfaces ──────────────────────────────────────────────────────────

export interface PhaseAwareCostInput {
  inputTokens: number;
  outputTokens: number;
  memoryTechnology?: MemoryTechnology | string;
  memoryBandwidthGBs?: number;
  kvCacheGB?: number;
  kvCacheHours?: number;
}

export interface PhaseAwareCostResult {
  prefillCost: number;
  decodeCost: number;
  kvCacheCost: number;
  totalCost: number;
  decodeMultiplier: number;    // How many × more decode costs than prefill
  memoryEfficiencyScore: number; // 0-100, how well node utilises bandwidth
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    prefillRate: number;  // $/1M tokens
    decodeRate: number;   // $/1M tokens
    kvRate: number;       // $/GB/hour
  };
}

/**
 * Calculate phase-aware inference cost.
 *
 * This replaces flat per-token pricing with a model that charges
 * differently for prefill (cheap, parallelisable) vs decode (expensive,
 * memory-bound). Optional KV cache retention adds a storage component.
 */
export function calculatePhaseAwareCost(input: PhaseAwareCostInput): PhaseAwareCostResult {
  const memTech = input.memoryTechnology || 'UNKNOWN';
  const memMultiplier = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;

  // Bandwidth-adjusted decode multiplier:
  // Nodes with higher bandwidth can decode faster → charge premium
  // Nodes with lower bandwidth are slower → slightly cheaper per token
  // but take more wall-clock time
  let bandwidthFactor = 1.0;
  if (input.memoryBandwidthGBs) {
    // Normalise against HBM3E baseline of 4800 GB/s
    bandwidthFactor = Math.min(2.0, Math.max(0.3, input.memoryBandwidthGBs / 3350));
  }

  // Final rates
  const prefillRate = PHASE_BASE_PRICING.prefill.perMillionTokens * memMultiplier;
  const decodeRate = PHASE_BASE_PRICING.decode.perMillionTokens * memMultiplier * bandwidthFactor;
  const kvRate = PHASE_BASE_PRICING.kvCache.perGBHour;

  // Calculate costs
  const prefillCost = (input.inputTokens / 1_000_000) * prefillRate;
  const decodeCost = (input.outputTokens / 1_000_000) * decodeRate;
  const kvCacheCost = (input.kvCacheGB ?? 0) * (input.kvCacheHours ?? 0) * kvRate;

  const totalCost = Math.max(0.0001, prefillCost + decodeCost + kvCacheCost);

  // Memory efficiency: how well the node utilises its bandwidth for decode
  // Higher bandwidth → higher throughput → higher efficiency
  const memoryEfficiencyScore = Math.min(100, Math.round(
    (input.memoryBandwidthGBs ?? 1000) / 48 // 4800 GB/s = 100
  ));

  return {
    prefillCost,
    decodeCost,
    kvCacheCost,
    totalCost,
    decodeMultiplier: decodeRate / prefillRate,
    memoryEfficiencyScore,
    breakdown: {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      prefillRate,
      decodeRate,
      kvRate,
    },
  };
}

// ── Decode Throughput Valuation ──────────────────────────────────────────

export interface DecodeThroughputValue {
  tokensPerSecond: number;
  memoryBandwidthGBs: number;
  bandwidthUtilisation: number;  // 0-1, how much of theoretical BW is used
  costPerDecodedToken: number;
  hourlyValue: number;           // $/hour of decode capacity
  annualValue: number;
}

/**
 * Value a node's decode throughput as a tradeable commodity.
 *
 * Decode throughput = f(memory bandwidth, model size, batch size).
 * This calculates the economic value of a node's decode capacity
 * for the trading protocol (IL-DECODE index).
 */
export function valuateDecodeCapacity(
  tokensPerSecond: number,
  memoryBandwidthGBs: number,
  memTech: MemoryTechnology | string = 'UNKNOWN',
): DecodeThroughputValue {
  const multiplier = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;

  // Theoretical max decode: ~bandwidth / (2 * bytes_per_param)
  // For 7B model in fp16: ~bandwidth / 14 GB per forward pass
  // Rough approximation: max_tps ≈ bandwidth_GBs * 2
  const theoreticalMaxTps = memoryBandwidthGBs * 2;
  const bandwidthUtilisation = theoreticalMaxTps > 0
    ? Math.min(1.0, tokensPerSecond / theoreticalMaxTps)
    : 0;

  // Cost per decoded token based on hardware amortisation
  // Assume $2/hr GPU cost amortised across tokens generated
  const baseCostPerHour = 2.0 * multiplier;
  const tokensPerHour = tokensPerSecond * 3600;
  const costPerDecodedToken = tokensPerHour > 0 ? baseCostPerHour / tokensPerHour : 0;

  // Hourly value = what this decode capacity is worth on the market
  const hourlyValue = tokensPerSecond * 3600 * PHASE_BASE_PRICING.decode.perMillionTokens / 1_000_000;

  return {
    tokensPerSecond,
    memoryBandwidthGBs,
    bandwidthUtilisation,
    costPerDecodedToken,
    hourlyValue,
    annualValue: hourlyValue * 8760, // 24/7 operation
  };
}

// ── KV Cache Pricing ────────────────────────────────────────────────────

/**
 * Calculate the cost of retaining a KV cache entry.
 * Used for the P2P cache marketplace (Stream W4).
 */
export function calculateKvCacheCost(
  cacheSizeGB: number,
  retentionHours: number,
  memTech: MemoryTechnology | string = 'UNKNOWN',
): { costUsd: number; platformFee: number; nodeEarnings: number } {
  const multiplier = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;

  // KV cache in HBM is premium storage — adjust by memory technology
  const adjustedRate = PHASE_BASE_PRICING.kvCache.perGBHour * multiplier;
  const costUsd = cacheSizeGB * retentionHours * adjustedRate;

  const KV_CACHE_PLATFORM_TAKE = 0.15; // 15% on cache transactions
  const platformFee = costUsd * KV_CACHE_PLATFORM_TAKE;
  const nodeEarnings = costUsd - platformFee;

  return { costUsd, platformFee, nodeEarnings };
}

// ── Memory Bandwidth Valuation ──────────────────────────────────────────

/**
 * Value a node's memory bandwidth as a tradeable resource.
 * Used for the IL-MEMORY index.
 */
export function valuateMemoryBandwidth(
  bandwidthGBs: number,
  memTech: MemoryTechnology | string = 'UNKNOWN',
): { hourlyValue: number; annualValue: number; perGBsValue: number } {
  const multiplier = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;

  // Each GB/s of bandwidth enables ~2 tokens/sec of decode
  // So bandwidth value = derived from decode revenue potential
  const estimatedTps = bandwidthGBs * 2;
  const hourlyDecodeRevenue = estimatedTps * 3600 * PHASE_BASE_PRICING.decode.perMillionTokens / 1_000_000;

  return {
    hourlyValue: hourlyDecodeRevenue * multiplier,
    annualValue: hourlyDecodeRevenue * multiplier * 8760,
    perGBsValue: hourlyDecodeRevenue / bandwidthGBs,
  };
}
