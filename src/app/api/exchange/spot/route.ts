import { NextRequest, NextResponse } from 'next/server';
import { findBestOffers } from '@/lib/exchange/spot-engine';
import { type SpotQuery, ProviderType } from '@/lib/exchange/types';

// ---------------------------------------------------------------------------
// GET /api/exchange/spot — real-time best-available prices
// ---------------------------------------------------------------------------
// Query params:
//   model           (required) — e.g. "claude-sonnet-4-5"
//   inputTokens     (required) — estimated input token count
//   outputTokens    (required) — estimated output token count
//   maxLatencyMs    (optional) — exclude providers with p95 above this
//   requireAttestation (optional) — "true" to filter TEE-only
//   providerType    (optional) — CENTRALIZED | DECENTRALIZED | HYBRID
//   limit           (optional) — max results, default 5
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    const model = params.get('model');
    const inputTokens = params.get('inputTokens');
    const outputTokens = params.get('outputTokens');

    if (!model) {
      return NextResponse.json(
        { error: 'model query parameter is required' },
        { status: 400 },
      );
    }
    if (!inputTokens || isNaN(Number(inputTokens))) {
      return NextResponse.json(
        { error: 'inputTokens query parameter is required and must be a number' },
        { status: 400 },
      );
    }
    if (!outputTokens || isNaN(Number(outputTokens))) {
      return NextResponse.json(
        { error: 'outputTokens query parameter is required and must be a number' },
        { status: 400 },
      );
    }

    const query: SpotQuery = {
      model,
      estimatedInputTokens: Number(inputTokens),
      estimatedOutputTokens: Number(outputTokens),
    };

    // Optional filters
    if (params.has('maxLatencyMs')) {
      query.maxLatencyMs = Number(params.get('maxLatencyMs'));
    }
    if (params.get('requireAttestation') === 'true') {
      query.requireAttestation = true;
    }
    if (params.has('providerType')) {
      const pt = params.get('providerType')!.toUpperCase();
      if (Object.values(ProviderType).includes(pt as ProviderType)) {
        query.providerType = pt as ProviderType;
      }
    }
    if (params.has('limit')) {
      query.limit = Math.min(Number(params.get('limit')) || 5, 20);
    }

    const results = await findBestOffers(query);

    return NextResponse.json({
      model: query.model,
      estimated_input_tokens: query.estimatedInputTokens,
      estimated_output_tokens: query.estimatedOutputTokens,
      candidates: results.map((r) => ({
        offer_id: r.offerId,
        provider_id: r.providerId,
        provider_type: r.providerType,
        model: r.model,
        input_price_per_mtok: r.inputPricePerMtok,
        output_price_per_mtok: r.outputPricePerMtok,
        estimated_cost_usd: r.estimatedCostUsd,
        reliability_score: r.reliabilityScore,
        latency_p95_ms: r.latencyP95Ms,
        composite_score: r.compositeScore,
        gpu_type: r.gpuType,
        attestation_type: r.attestationType,
        utilization_pct: r.utilizationPct,
        available_until: r.availableUntil.toISOString(),
      })),
      total_candidates: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
