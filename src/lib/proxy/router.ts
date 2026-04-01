import {
  findEquivalents,
  findCheapest,
  findFastest,
  findBestQuality,
  getModelTier,
  detectProvider,
  EQUIVALENCE_TIERS,
} from '@/lib/proxy/model-equivalence';
import { getCurrentCostMultiplier } from '@/lib/scheduler/optimizer';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { healthTracker } from '@/lib/proxy/health-tracker';
import { capacityOrchestrator } from '@/lib/nodes/orchestrator';
import { subnetManager } from '@/lib/nodes/subnets';
import { requestClassifier, type Tier } from '@/lib/proxy/request-classifier';
import { requestCache } from '@/lib/proxy/request-cache';
import { prefixCache } from '@/lib/proxy/prefix-cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoutingStrategy =
  | 'direct'
  | 'cheapest'
  | 'fastest'
  | 'quality'
  | 'budget'
  | 'fallback'
  | 'auto';

export interface RoutingRequest {
  userId: string;
  model: string;
  provider?: string;
  routing: RoutingStrategy;
  budget?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  messages?: Array<{ role: string; content: string }>;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  reason: string;
  reasonCode:
    | 'direct'
    | 'cheapest_equivalent'
    | 'promotion_active'
    | 'fastest_in_tier'
    | 'best_quality'
    | 'budget_optimized'
    | 'fallback_primary'
    | 'auto_optimal'
    | 'auto_cheapest_fallback';
  estimatedCost: number;
  alternativeProvider?: string;
  alternativeModel?: string;
  alternativeCost?: number;
  savings?: number;
  promotionActive?: boolean;
  budgetExceeded?: boolean;
  fallbackProvider?: string;
  fallbackModel?: string;
  tier?: Tier;
  confidence?: number;
  agenticScore?: number;
  /** Set when validation overrode the original routing decision */
  validationOverride?: string;
}

// ---------------------------------------------------------------------------
// Validation: correctness-first checks before committing to a routing decision
// ---------------------------------------------------------------------------

interface ValidationContext {
  tier: Tier;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

/**
 * Validate a routing decision won't degrade quality. Checks:
 * 1. Model capability — target model supports the task tier
 * 2. Context window  — request fits in the model's context window
 * 3. Provider status — provider is actually online
 * 4. Cost sanity     — cost is within 5x of the cheapest option
 *
 * Returns null if validation passes, or a reason string if it fails.
 */
function validateRoutingDecision(
  decision: { provider: string; model: string; effectiveCost: number },
  ctx: ValidationContext,
  allHealth: Record<string, { isHealthy: boolean; totalSamples: number }>,
  cheapestCost: number,
): string | null {
  // 1. Model capability check — don't route REASONING tier to a model that
  //    only appears in budget/speed tiers (no reasoning capability)
  if (ctx.tier === 'REASONING') {
    const reasoningTier = EQUIVALENCE_TIERS.find((t) => t.name === 'reasoning');
    const isReasoningCapable = reasoningTier?.models.some(
      (m) => m.model === decision.model || m.provider === decision.provider,
    ) ?? false;

    // Also allow frontier tier models for reasoning tasks
    const frontierTier = EQUIVALENCE_TIERS.find((t) => t.name === 'frontier');
    const isFrontierCapable = frontierTier?.models.some(
      (m) => m.model === decision.model,
    ) ?? false;

    if (!isReasoningCapable && !isFrontierCapable) {
      return `Model ${decision.model} lacks reasoning capability for REASONING tier task`;
    }
  }

  // 2. Context window check — does the request fit?
  const estimatedTokens = ctx.estimatedInputTokens + ctx.estimatedOutputTokens;
  let modelContextWindow: number | null = null;

  for (const tier of EQUIVALENCE_TIERS) {
    const match = tier.models.find((m) => m.model === decision.model);
    if (match) {
      modelContextWindow = match.contextWindow;
      break;
    }
  }

  if (modelContextWindow !== null && estimatedTokens > modelContextWindow * 0.9) {
    return `Estimated ${estimatedTokens} tokens exceeds 90% of ${decision.model}'s ${modelContextWindow} context window`;
  }

  // 3. Provider status check — double-check health
  const health = allHealth[decision.provider];
  if (health && !health.isHealthy && health.totalSamples >= 5) {
    return `Provider ${decision.provider} is in cooldown (unhealthy)`;
  }

  // 4. Cost sanity check — within 5x of cheapest option
  if (cheapestCost > 0 && decision.effectiveCost > cheapestCost * 5) {
    return `Cost $${decision.effectiveCost.toFixed(6)} exceeds 5x cheapest option $${cheapestCost.toFixed(6)}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateCost(
  inputPerMToken: number,
  outputPerMToken: number,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * inputPerMToken) / 1_000_000 +
    (outputTokens * outputPerMToken) / 1_000_000
  );
}

export async function getUserProviders(
  userId: string,
): Promise<Array<{ provider: string; hasKey: boolean }>> {
  const connections = await prisma.providerConnection.findMany({
    where: { userId, isActive: true },
  });

  return connections.map((c: any) => ({
    provider: c.provider as string,
    hasKey: !!c.encryptedApiKey,
  }));
}

// ---------------------------------------------------------------------------
// Internal: fetch active promotions for a set of providers
// ---------------------------------------------------------------------------

async function getActivePromotions(
  providers: string[],
): Promise<
  Array<{
    provider: string;
    multiplier: number;
    promotionType: string;
  }>
> {
  if (providers.length === 0) return [];

  const now = new Date();

  const promos = await prisma.providerPromotion.findMany({
    where: {
      provider: { in: providers as any },
      status: 'ACTIVE' as any,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });

  return promos.map((p: any) => ({
    provider: p.provider as string,
    multiplier: p.multiplier as number,
    promotionType: p.promotionType as string,
  }));
}

// ---------------------------------------------------------------------------
// Internal: filter equivalents to only user-connected providers
// ---------------------------------------------------------------------------

function filterToConnected(
  equivalents: Array<{ provider: string; model: string; [key: string]: any }>,
  connectedProviders: string[],
) {
  return equivalents.filter((eq) => connectedProviders.includes(eq.provider));
}

// ---------------------------------------------------------------------------
// Core routing
// ---------------------------------------------------------------------------

export async function routeRequest(
  req: RoutingRequest,
): Promise<RoutingDecision> {
  const inputTokens = req.estimatedInputTokens ?? 1000;
  const outputTokens = req.estimatedOutputTokens ?? 500;

  switch (req.routing) {
    case 'direct':
      return routeDirect(req, inputTokens, outputTokens);
    case 'cheapest':
      return routeCheapest(req, inputTokens, outputTokens);
    case 'fastest':
      return routeFastest(req, inputTokens, outputTokens);
    case 'quality':
      return routeQuality(req, inputTokens, outputTokens);
    case 'budget':
      return routeBudget(req, inputTokens, outputTokens);
    case 'fallback':
      return routeFallback(req, inputTokens, outputTokens);
    case 'auto':
      return routeAuto(req, inputTokens, outputTokens);
    default:
      return routeDirect(req, inputTokens, outputTokens);
  }
}

// ---------------------------------------------------------------------------
// Pinned routing: honour session-pinned provider/model with health check
// ---------------------------------------------------------------------------

export async function routePinned(
  pinnedProvider: string,
  pinnedModel: string,
  req: RoutingRequest,
): Promise<{ decision: RoutingDecision; pinOverridden: boolean }> {
  const inputTokens = req.estimatedInputTokens ?? 1000;
  const outputTokens = req.estimatedOutputTokens ?? 500;

  // Check if the pinned provider is healthy
  const allHealth = healthTracker.getAllHealth();
  const providerHealth = allHealth[pinnedProvider];
  const isHealthy = !providerHealth || providerHealth.isHealthy;

  if (isHealthy) {
    // Pinned provider is healthy — use it directly
    const equivalents = findEquivalents(pinnedModel);
    const match = equivalents.find(
      (e: any) => e.provider === pinnedProvider && e.model === pinnedModel,
    ) ?? equivalents[0];

    const cost = match
      ? estimateCost(match.inputPerMToken, match.outputPerMToken, inputTokens, outputTokens)
      : 0;

    return {
      decision: {
        provider: pinnedProvider,
        model: pinnedModel,
        reason: `Pinned to ${pinnedProvider}/${pinnedModel} for session continuity`,
        reasonCode: 'direct',
        estimatedCost: cost,
      },
      pinOverridden: false,
    };
  }

  // Pinned provider is in cooldown — fall through to auto routing with warning
  const autoDecision = await routeAuto(req, inputTokens, outputTokens);
  return {
    decision: {
      ...autoDecision,
      reason: `Pin override: ${pinnedProvider} in cooldown, auto-routed to ${autoDecision.provider}/${autoDecision.model}`,
    },
    pinOverridden: true,
  };
}

// ---------------------------------------------------------------------------
// Strategy: direct
// ---------------------------------------------------------------------------

async function routeDirect(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const provider = req.provider ?? detectProvider(req.model);
  const equivalents = findEquivalents(req.model);
  const cheapest = findCheapest(req.model);

  const directMatch = equivalents.find(
    (e: any) => e.provider === provider && e.model === req.model,
  ) ?? equivalents[0];

  const directCost = directMatch
    ? estimateCost(
        directMatch.inputPerMToken,
        directMatch.outputPerMToken,
        inputTokens,
        outputTokens,
      )
    : 0;

  const decision: RoutingDecision = {
    provider,
    model: req.model,
    reason: `Direct routing to ${provider}/${req.model}`,
    reasonCode: 'direct',
    estimatedCost: directCost,
  };

  if (cheapest && (cheapest.provider !== provider || cheapest.model !== req.model)) {
    const cheapestCost = estimateCost(
      cheapest.inputPerMToken,
      cheapest.outputPerMToken,
      inputTokens,
      outputTokens,
    );
    decision.alternativeProvider = cheapest.provider;
    decision.alternativeModel = cheapest.model;
    decision.alternativeCost = cheapestCost;
    decision.savings = directCost - cheapestCost;
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: cheapest
// ---------------------------------------------------------------------------

async function routeCheapest(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  if (available.length === 0) {
    return routeDirect(req, inputTokens, outputTokens);
  }

  // Check for active promotions
  const promos = await getActivePromotions(connectedNames);
  const promoMap = new Map(promos.map((p) => [p.provider, p.multiplier]));

  const scored = available.map((eq: any) => {
    const promoMultiplier = promoMap.get(eq.provider) ?? 1;
    const effectiveCost =
      estimateCost(eq.inputPerMToken, eq.outputPerMToken, inputTokens, outputTokens) *
      promoMultiplier;
    return { ...eq, effectiveCost, hasPromo: promoMultiplier < 1 };
  });

  scored.sort((a, b) => a.effectiveCost - b.effectiveCost);

  const best = scored[0];
  const directCost = estimateCost(
    equivalents[0]?.inputPerMToken ?? 0,
    equivalents[0]?.outputPerMToken ?? 0,
    inputTokens,
    outputTokens,
  );

  const decision: RoutingDecision = {
    provider: best.provider,
    model: best.model,
    reason: best.hasPromo
      ? `Cheapest equivalent with active promotion on ${best.provider}`
      : `Cheapest equivalent across connected providers`,
    reasonCode: best.hasPromo ? 'promotion_active' : 'cheapest_equivalent',
    estimatedCost: best.effectiveCost,
    promotionActive: best.hasPromo || undefined,
  };

  if (scored.length > 1) {
    const alt = scored[1];
    decision.alternativeProvider = alt.provider;
    decision.alternativeModel = alt.model;
    decision.alternativeCost = alt.effectiveCost;
  }

  decision.savings = directCost - best.effectiveCost;

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: fastest
// ---------------------------------------------------------------------------

async function routeFastest(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  if (available.length === 0) {
    return routeDirect(req, inputTokens, outputTokens);
  }

  const latencyOrder: Record<string, number> = { fast: 0, medium: 1, slow: 2 };

  const sorted = [...available].sort((a: any, b: any) => {
    const aLatency = latencyOrder[a.latencyClass ?? 'medium'] ?? 1;
    const bLatency = latencyOrder[b.latencyClass ?? 'medium'] ?? 1;

    if (aLatency !== bLatency) return aLatency - bLatency;

    // Same latency class — pick cheapest
    const aCost = estimateCost(a.inputPerMToken, a.outputPerMToken, inputTokens, outputTokens);
    const bCost = estimateCost(b.inputPerMToken, b.outputPerMToken, inputTokens, outputTokens);
    return aCost - bCost;
  });

  const best = sorted[0] as any;
  const cost = estimateCost(
    best.inputPerMToken,
    best.outputPerMToken,
    inputTokens,
    outputTokens,
  );

  const decision: RoutingDecision = {
    provider: best.provider,
    model: best.model,
    reason: `Fastest equivalent (${best.latencyClass ?? 'medium'} latency) among connected providers`,
    reasonCode: 'fastest_in_tier',
    estimatedCost: cost,
  };

  if (sorted.length > 1) {
    const alt = sorted[1] as any;
    decision.alternativeProvider = alt.provider;
    decision.alternativeModel = alt.model;
    decision.alternativeCost = estimateCost(
      alt.inputPerMToken,
      alt.outputPerMToken,
      inputTokens,
      outputTokens,
    );
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: quality
// ---------------------------------------------------------------------------

async function routeQuality(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  if (available.length === 0) {
    return routeDirect(req, inputTokens, outputTokens);
  }

  const sorted = [...available].sort(
    (a: any, b: any) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0),
  );

  const best = sorted[0] as any;
  const cost = estimateCost(
    best.inputPerMToken,
    best.outputPerMToken,
    inputTokens,
    outputTokens,
  );

  const decision: RoutingDecision = {
    provider: best.provider,
    model: best.model,
    reason: `Highest quality equivalent (score ${best.qualityScore ?? 'N/A'}) among connected providers`,
    reasonCode: 'best_quality',
    estimatedCost: cost,
  };

  if (sorted.length > 1) {
    const alt = sorted[1] as any;
    decision.alternativeProvider = alt.provider;
    decision.alternativeModel = alt.model;
    decision.alternativeCost = estimateCost(
      alt.inputPerMToken,
      alt.outputPerMToken,
      inputTokens,
      outputTokens,
    );
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: budget
// ---------------------------------------------------------------------------

async function routeBudget(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  if (available.length === 0) {
    return routeDirect(req, inputTokens, outputTokens);
  }

  // Fetch promotions and off-peak multiplier
  // Get cost multiplier for the primary provider (or first connected)
  const primaryProvider = req.provider ?? detectProvider(req.model);
  const [promos, costMultiplierResult] = await Promise.all([
    getActivePromotions(connectedNames),
    getCurrentCostMultiplier(primaryProvider),
  ]);
  const costMultiplier = costMultiplierResult.multiplier;

  const promoMap = new Map(promos.map((p) => [p.provider, p.multiplier]));

  const scored = available.map((eq: any) => {
    const promoMultiplier = promoMap.get(eq.provider) ?? 1;
    const baseCost = estimateCost(
      eq.inputPerMToken,
      eq.outputPerMToken,
      inputTokens,
      outputTokens,
    );
    const effectiveCost = baseCost * promoMultiplier * costMultiplier;
    return { ...eq, effectiveCost, hasPromo: promoMultiplier < 1 };
  });

  scored.sort((a, b) => a.effectiveCost - b.effectiveCost);

  const best = scored[0];
  const budgetExceeded =
    req.budget !== undefined && best.effectiveCost > req.budget;

  const decision: RoutingDecision = {
    provider: best.provider,
    model: best.model,
    reason: budgetExceeded
      ? `Budget-optimized: cheapest option ($${best.effectiveCost.toFixed(6)}) still exceeds budget ($${req.budget!.toFixed(6)})`
      : `Budget-optimized routing${best.hasPromo ? ' with active promotion' : ''}${costMultiplier < 1 ? ' (off-peak pricing)' : ''}`,
    reasonCode: 'budget_optimized',
    estimatedCost: best.effectiveCost,
    promotionActive: best.hasPromo || undefined,
    budgetExceeded: budgetExceeded || undefined,
  };

  if (scored.length > 1) {
    const alt = scored[1];
    decision.alternativeProvider = alt.provider;
    decision.alternativeModel = alt.model;
    decision.alternativeCost = alt.effectiveCost;
  }

  // Savings vs direct (unoptimized) cost
  const directEquiv = equivalents.find(
    (e: any) => e.provider === (req.provider ?? detectProvider(req.model)),
  ) ?? equivalents[0];

  if (directEquiv) {
    const directCost = estimateCost(
      directEquiv.inputPerMToken,
      directEquiv.outputPerMToken,
      inputTokens,
      outputTokens,
    );
    decision.savings = directCost - best.effectiveCost;
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: fallback
// ---------------------------------------------------------------------------

async function routeFallback(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const provider = req.provider ?? detectProvider(req.model);
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  // Primary match
  const primaryMatch = equivalents.find(
    (e: any) => e.provider === provider && e.model === req.model,
  ) ?? equivalents[0];

  const primaryCost = primaryMatch
    ? estimateCost(
        primaryMatch.inputPerMToken,
        primaryMatch.outputPerMToken,
        inputTokens,
        outputTokens,
      )
    : 0;

  // Fallback: next cheapest equivalent that is NOT the primary provider
  const fallbackCandidates = available
    .filter((eq: any) => eq.provider !== provider)
    .map((eq: any) => ({
      ...eq,
      cost: estimateCost(
        eq.inputPerMToken,
        eq.outputPerMToken,
        inputTokens,
        outputTokens,
      ),
    }))
    .sort((a, b) => a.cost - b.cost);

  const fallback = fallbackCandidates[0];

  const decision: RoutingDecision = {
    provider,
    model: req.model,
    reason: fallback
      ? `Primary: ${provider}/${req.model}, fallback: ${fallback.provider}/${fallback.model}`
      : `Primary: ${provider}/${req.model}, no fallback available`,
    reasonCode: 'fallback_primary',
    estimatedCost: primaryCost,
  };

  if (fallback) {
    decision.fallbackProvider = fallback.provider;
    decision.fallbackModel = fallback.model;
    decision.alternativeProvider = fallback.provider;
    decision.alternativeModel = fallback.model;
    decision.alternativeCost = fallback.cost;
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Strategy: auto — health-aware optimal routing
// ---------------------------------------------------------------------------

async function routeAuto(
  req: RoutingRequest,
  inputTokens: number,
  outputTokens: number,
): Promise<RoutingDecision> {
  const equivalents = findEquivalents(req.model);
  const userProviders = await getUserProviders(req.userId);
  const connectedNames = userProviders.map((p) => p.provider);

  const available = filterToConnected(equivalents, connectedNames);

  if (available.length === 0) {
    return routeDirect(req, inputTokens, outputTokens);
  }

  // ── Classify the prompt to determine tier ──
  // Extract prompt text from the routing request context
  const classification = requestClassifier.classify(
    req.model, // Prompt text is not on RoutingRequest; model name gives a signal
    inputTokens,
  );

  // Check if we have sufficient health data (>= 10 total samples across all)
  const allHealth = healthTracker.getAllHealth();
  const totalSamples = available.reduce(
    (sum, eq: any) => sum + (allHealth[eq.provider]?.totalSamples ?? 0),
    0,
  );

  if (totalSamples < 10) {
    // Fall back to cheapest strategy when health data is insufficient
    const cheapestDecision = await routeCheapest(req, inputTokens, outputTokens);
    return {
      ...cheapestDecision,
      reasonCode: 'auto_cheapest_fallback',
      reason: `Auto routing (cheapest fallback — insufficient health data: ${totalSamples} samples)`,
    };
  }

  // Filter out providers in cooldown
  const healthy = available.filter((eq: any) => {
    const health = allHealth[eq.provider];
    return !health || health.isHealthy;
  });

  // If some providers are in cooldown, check if decentralised nodes can
  // absorb overflow cheaper than remaining centralised providers
  const unhealthyProviders = available.filter((eq: any) => {
    const health = allHealth[eq.provider];
    return health && !health.isHealthy;
  });

  if (unhealthyProviders.length > 0) {
    try {
      // Classify request to pick the right subnet
      const requestSubnet = subnetManager.classifyRequest(req.model);

      // Try subnet-specific routing first
      const subnetNodeId = await subnetManager.routeToSubnet(requestSubnet);

      const overflowNodes = await capacityOrchestrator.absorbOverflow(
        unhealthyProviders[0]?.provider ?? '',
        req.model,
      );
      if (overflowNodes.length > 0 && healthy.length === 0) {
        // All centralised providers are down — route to decentralised node
        // Prefer the subnet-selected node if it's in the overflow list
        const bestNode = (subnetNodeId && overflowNodes.find((n) => n.id === subnetNodeId))
          ? overflowNodes.find((n) => n.id === subnetNodeId)!
          : overflowNodes[0];
        return {
          provider: 'openclaw',
          model: req.model,
          reason: `Auto-overflow to decentralised node ${bestNode.id} via ${requestSubnet} subnet (all centralised providers in cooldown)`,
          reasonCode: 'auto_optimal',
          estimatedCost: 0, // node pricing calculated at dispatch time
        };
      }
    } catch {
      // Overflow check failed — continue with centralised routing
    }
  }

  // If all providers are in cooldown, use all of them anyway
  const candidates = healthy.length > 0 ? healthy : available;

  // ── Prefix cache: prefer nodes that already have the conversation cached ──
  let prefixCacheHit = false;
  let prefixCacheNodeId: string | undefined;
  if (req.messages && req.messages.length > 1) {
    const cacheResult = prefixCache.findCachedNode(req.messages, req.model);
    if (cacheResult.hasCachedPrefix && cacheResult.cacheNodeId) {
      prefixCacheHit = true;
      prefixCacheNodeId = cacheResult.cacheNodeId;
    }
  }

  // Fetch active promotions
  const promos = await getActivePromotions(connectedNames);
  const promoMap = new Map(promos.map((p) => [p.provider, p.multiplier]));

  // ── Amdahl's law: traffic share weighting ──
  // A 2x improvement on a provider handling 60% of traffic = 1.6x end-to-end.
  // A 3x improvement on a provider handling 5% of traffic = 1.05x end-to-end.
  // Weight routing scores by each provider's share of total traffic so we
  // prioritise optimising high-traffic providers over niche ones.
  const trafficShares = healthTracker.getTrafficShares();

  // Compute normalization ranges for cost and latency
  const costs = candidates.map((eq: any) => {
    const promoMultiplier = promoMap.get(eq.provider) ?? 1;
    return (
      estimateCost(eq.inputPerMToken, eq.outputPerMToken, inputTokens, outputTokens) *
      promoMultiplier
    );
  });
  const latencies = candidates.map((eq: any) => {
    const health = allHealth[eq.provider];
    return health && health.latencyP50 > 0 ? health.latencyP50 : 500; // default 500ms
  });

  const maxCost = Math.max(...costs, 0.000001);
  const maxLatency = Math.max(...latencies, 1);

  // Tier-aware weight adjustment: TRIVIAL/STANDARD favour cost,
  // COMPLEX/REASONING favour quality and accept higher cost.
  let wQuality = 0.4;
  let wCost = 0.3;
  let wLatency = 0.2;
  const wError = 0.1;

  if (classification.tier === 'TRIVIAL') {
    wQuality = 0.2; wCost = 0.5; wLatency = 0.2;
  } else if (classification.tier === 'STANDARD') {
    wQuality = 0.3; wCost = 0.4; wLatency = 0.2;
  } else if (classification.tier === 'REASONING') {
    wQuality = 0.55; wCost = 0.15; wLatency = 0.2;
  }

  // Score each candidate
  const scored = candidates.map((eq: any, i: number) => {
    const quality = (eq.qualityScore ?? 50) / 100; // normalize to 0-1
    const normalizedCost = costs[i] / maxCost; // 0-1, lower is better
    const normalizedLatency = latencies[i] / maxLatency; // 0-1, lower is better
    const health = allHealth[eq.provider];
    const errorRate = health?.errorRate ?? 0;

    const costScore = normalizedCost > 0 ? (1 / normalizedCost) : 1;
    const latencyScore = normalizedLatency > 0 ? (1 / normalizedLatency) : 1;

    // Base score from weighted dimensions
    const baseScore =
      quality * wQuality +
      Math.min(costScore, 10) / 10 * wCost +
      Math.min(latencyScore, 10) / 10 * wLatency +
      (1 - errorRate) * wError;

    // Amdahl's law weighting: boost score for high-traffic providers.
    // A provider handling N% of traffic gets its improvement weighted by N%.
    // Formula: effective_improvement = 1 + trafficShare * (baseScore - 1)
    // We use this as a multiplier on the base score. Providers with no
    // traffic history get a neutral weight of 1.0 (no boost or penalty).
    const providerShare = trafficShares[eq.provider] ?? 0;
    const amdahlMultiplier = totalSamples >= 10
      ? 1.0 + providerShare * 0.5  // up to 1.5x boost for 100% traffic share
      : 1.0; // not enough data — equal weighting

    // Normalize reciprocal scores to 0-1 range (cap at 10x advantage)
    let score = baseScore * amdahlMultiplier;

    // Prefix cache bonus: strong preference for nodes that already have
    // the conversation prefix cached (avoids re-prefill)
    if (prefixCacheHit && prefixCacheNodeId === eq.provider) {
      score += 0.5;
    }

    const promoMultiplier = promoMap.get(eq.provider) ?? 1;
    return {
      ...eq,
      score,
      effectiveCost: costs[i],
      hasPromo: promoMultiplier < 1,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // ── Correctness-first validation ──
  // Walk through scored candidates and pick the first one that passes
  // all validation checks. If the top candidate fails, fall back to the
  // next one and flag the override.
  const validationCtx: ValidationContext = {
    tier: classification.tier,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
  };

  // Find cheapest cost among all candidates for the cost sanity check
  const cheapestCandidateCost = Math.min(...scored.map((s) => s.effectiveCost));

  let validatedIdx = 0;
  let validationOverrideReason: string | null = null;

  for (let vi = 0; vi < scored.length; vi++) {
    const candidate = scored[vi];
    const failReason = validateRoutingDecision(
      candidate,
      validationCtx,
      allHealth,
      cheapestCandidateCost,
    );

    if (!failReason) {
      validatedIdx = vi;
      if (vi > 0) {
        validationOverrideReason = `Original choice ${scored[0].provider}/${scored[0].model} failed validation: ${failReason ?? 'unknown'}. Fell back to candidate #${vi + 1}.`;
      }
      break;
    }

    // If this was the top candidate that failed, record the reason
    if (vi === 0) {
      validationOverrideReason = failReason;
    }

    // If we've exhausted all candidates, use the top scorer anyway
    if (vi === scored.length - 1) {
      validatedIdx = 0;
      validationOverrideReason = null; // all failed — use best score as-is
    }
  }

  const best = scored[validatedIdx];
  const directCost = estimateCost(
    equivalents[0]?.inputPerMToken ?? 0,
    equivalents[0]?.outputPerMToken ?? 0,
    inputTokens,
    outputTokens,
  );

  const prefixHitSuffix = prefixCacheHit && prefixCacheNodeId === best.provider
    ? ' [prefix-cache-hit]'
    : '';

  const decision: RoutingDecision = {
    provider: best.provider,
    model: best.model,
    reason: `Auto-optimal routing to ${best.provider}/${best.model} (score ${best.score.toFixed(3)}, tier ${classification.tier})${best.hasPromo ? ' with active promotion' : ''}${prefixHitSuffix}`,
    reasonCode: 'auto_optimal',
    estimatedCost: best.effectiveCost,
    promotionActive: best.hasPromo || undefined,
    savings: directCost - best.effectiveCost,
    tier: classification.tier,
    confidence: classification.confidence,
    agenticScore: classification.agenticScore,
  };

  // Flag if validation overrode the original choice
  if (validatedIdx > 0 && validationOverrideReason) {
    decision.validationOverride = validationOverrideReason;
  }

  if (scored.length > 1) {
    // Use the next candidate after the validated one as the alternative
    const altIdx = validatedIdx === 0 ? 1 : 0;
    const alt = scored[altIdx];
    decision.alternativeProvider = alt.provider;
    decision.alternativeModel = alt.model;
    decision.alternativeCost = alt.effectiveCost;
  }

  // Set fallback to second-best for retry support
  if (scored.length > 1) {
    const fallbackIdx = validatedIdx === 0 ? 1 : 0;
    decision.fallbackProvider = scored[fallbackIdx].provider;
    decision.fallbackModel = scored[fallbackIdx].model;
  }

  return decision;
}
