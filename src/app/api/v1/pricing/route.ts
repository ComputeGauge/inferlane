import { NextResponse } from 'next/server';
import { MODEL_PRICES } from '@/lib/pricing/model-prices';

// GET /api/v1/pricing — Public pricing endpoint
// No auth required. Returns all model prices in a clean JSON format.
// Cached at edge for 1 hour (prices don't change frequently).
// Designed to be as simple as Darkbloom's /v1/pricing endpoint.

export async function GET() {
  const prices = MODEL_PRICES.map((m) => ({
    model: m.model,
    provider: m.provider,
    input_per_mtok: m.inputPerMToken,
    output_per_mtok: m.outputPerMToken,
    input_usd: `$${m.inputPerMToken.toFixed(4)}`,
    output_usd: `$${m.outputPerMToken.toFixed(4)}`,
    context_window: m.context,
    category: m.category,
  }));

  // Group by provider for convenience
  const byProvider: Record<string, typeof prices> = {};
  for (const p of prices) {
    if (!byProvider[p.provider]) byProvider[p.provider] = [];
    byProvider[p.provider].push(p);
  }

  return NextResponse.json(
    {
      models: prices,
      by_provider: byProvider,
      total_models: prices.length,
      total_providers: Object.keys(byProvider).length,
      currency: 'USD',
      unit: 'per 1M tokens',
      updated: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    },
  );
}
