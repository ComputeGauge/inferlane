import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth-api-key';
import { findEquivalents, findCheapest, detectProvider, getModelTier } from '@/lib/proxy/model-equivalence';
import { calculatePhaseAwareCost } from '@/lib/pricing/decode-pricing';
import { getProviderHardware } from '@/lib/pricing/provider-hardware';
import { calculateCost } from '@/lib/pricing/model-prices';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/estimate — estimate LLM API call cost without executing it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the estimated cost for a model + token count using phase-aware
 * pricing with flat pricing as a floor.
 */
function estimateCostForModel(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  const hw = getProviderHardware(provider, model);
  const phaseResult = calculatePhaseAwareCost({
    inputTokens,
    outputTokens,
    memoryTechnology: hw.memoryTechnology,
    memoryBandwidthGBs: hw.memoryBandwidthGBs,
  });

  const flatCost = calculateCost(model, inputTokens, outputTokens);
  const totalCost = Math.max(phaseResult.totalCost, flatCost);

  return { totalCost, phaseResult };
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 },
    );
  }

  // Use apiKeyId for rate limiting when available, fall back to userId for session auth
  const rateLimitKey = auth.apiKeyId ?? auth.userId;

  // 2. Rate limit — 200/min (higher than proxy since this is read-only)
  const rl = await rateLimit(`estimate:${rateLimitKey}`, 200, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  // 3. Parse request body
  let body: { model?: string; messages?: any[]; max_tokens?: number; estimated_input_tokens?: number; estimated_output_tokens?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { model, messages, max_tokens } = body;

  if (!model) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }

  // 4. Estimate token counts
  // Accept direct token counts (from MCP server) or estimate from messages content
  const estimatedInputTokens = body.estimated_input_tokens
    ?? (Math.ceil(JSON.stringify(messages ?? []).length / 4) || 1000);
  const estimatedOutputTokens = body.estimated_output_tokens ?? max_tokens ?? 500;

  // 5. Detect provider and tier
  const provider = detectProvider(model);
  const tier = getModelTier(model);

  // 6. Calculate primary model cost (phase-aware with flat floor)
  const { totalCost: primaryCost, phaseResult: primaryPhase } = estimateCostForModel(
    provider,
    model,
    estimatedInputTokens,
    estimatedOutputTokens,
  );

  // 7. Get equivalents and calculate alternative costs
  const equivalents = findEquivalents(model);
  const alternatives = equivalents
    .filter((eq) => eq.model !== model) // exclude the primary model
    .map((eq) => {
      const { totalCost: altCost } = estimateCostForModel(
        eq.provider,
        eq.model,
        estimatedInputTokens,
        estimatedOutputTokens,
      );

      const savings = primaryCost > 0
        ? ((primaryCost - altCost) / primaryCost * 100).toFixed(1) + '%'
        : '0.0%';

      return {
        model: eq.model,
        provider: eq.provider,
        estimatedCost: Math.round(altCost * 1_000_000) / 1_000_000,
        savings,
        qualityScore: eq.qualityScore,
        latencyClass: eq.latencyClass,
      };
    })
    .sort((a, b) => a.estimatedCost - b.estimatedCost);

  // 8. Find cheapest alternative
  const cheapestEquiv = findCheapest(model);
  let cheapestAlternative: {
    model: string;
    provider: string;
    estimatedCost: number;
    savings: string;
  } | null = null;

  if (cheapestEquiv && cheapestEquiv.model !== model) {
    const { totalCost: cheapestCost } = estimateCostForModel(
      cheapestEquiv.provider,
      cheapestEquiv.model,
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    cheapestAlternative = {
      model: cheapestEquiv.model,
      provider: cheapestEquiv.provider,
      estimatedCost: Math.round(cheapestCost * 1_000_000) / 1_000_000,
      savings: primaryCost > 0
        ? ((primaryCost - cheapestCost) / primaryCost * 100).toFixed(1) + '%'
        : '0.0%',
    };
  }

  // 9. Check for active promotions
  const now = new Date();
  let activePromotion: {
    id: string;
    provider: string;
    title: string;
    rawDescription: string;
    multiplier: number;
  } | null = null;

  try {
    const promo = await prisma.providerPromotion.findFirst({
      where: {
        provider: provider as any,
        status: 'ACTIVE' as any,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    if (promo) {
      activePromotion = {
        id: promo.id,
        provider: promo.provider as string,
        title: promo.title,
        rawDescription: promo.rawDescription,
        multiplier: promo.multiplier,
      };
    }
  } catch {
    // Promotion lookup is best-effort — never fail the estimate over it
  }

  // 10. Return structured response
  return NextResponse.json({
    model,
    provider,
    tier: tier ?? 'unknown',
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost: Math.round(primaryCost * 1_000_000) / 1_000_000,
    breakdown: {
      prefill: Math.round(primaryPhase.prefillCost * 1_000_000) / 1_000_000,
      decode: Math.round(primaryPhase.decodeCost * 1_000_000) / 1_000_000,
    },
    alternatives,
    cheapestAlternative,
    activePromotion,
  });
}
