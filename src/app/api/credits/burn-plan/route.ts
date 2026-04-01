import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { planBatchConsumption } from '@/lib/credits/source-resolver';

// ---------------------------------------------------------------------------
// GET /api/credits/burn-plan?cost=25.00
// ---------------------------------------------------------------------------
// Returns a pre-calculated credit consumption plan for a given workload cost.
// Shows which credit sources will be consumed and in what order, switch points
// between sources, coverage percentage, and estimated savings.
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Rate limit: 20 req/min (read-only but queries multiple tables)
  const rl = await rateLimit(`burn-plan:${userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  // Parse cost parameter
  const costParam = req.nextUrl.searchParams.get('cost');
  if (!costParam) {
    return NextResponse.json({ error: 'cost query parameter is required' }, { status: 400 });
  }

  const cost = parseFloat(costParam);
  if (isNaN(cost) || cost <= 0) {
    return NextResponse.json({ error: 'cost must be a positive number' }, { status: 400 });
  }

  if (cost > 100_000) {
    return NextResponse.json({ error: 'cost exceeds maximum ($100,000)' }, { status: 400 });
  }

  try {
    const plan = await planBatchConsumption(userId, cost);

    // Serialise sources for JSON (strip internal fields, format dates)
    const serialisedSources = plan.sources.map((s) => ({
      type: s.type,
      available: s.available,
      expiresAt: s.expiresAt.toISOString(),
      decayFactor: s.decayFactor,
      effectiveCostPerCredit: s.effectiveCostPerCredit,
      priority: s.priority,
      offerId: s.offerId ?? null,
    }));

    return NextResponse.json({
      totalEstimatedCost: plan.totalEstimatedCost,
      sources: serialisedSources,
      switchPoints: plan.switchPoints,
      totalAvailable: plan.totalAvailable,
      coveragePercent: plan.coveragePercent,
      estimatedSavings: plan.estimatedSavings,
    });
  } catch (err) {
    console.error('[BurnPlan] Error calculating plan:', err);
    return NextResponse.json({ error: 'Failed to calculate burn plan' }, { status: 500 });
  }
}

export const GET = withTiming(handleGET);
