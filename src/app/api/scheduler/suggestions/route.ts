import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  generateSuggestions,
  estimateSavings,
  type SuggestionCategory,
  type ActivePromotion,
} from '@/lib/scheduler/advisor';
import { prisma } from '@/lib/db';

const VALID_CATEGORIES: SuggestionCategory[] = [
  'CODEBASE_ANALYSIS',
  'DOCUMENT_PROCESSING',
  'MODEL_COMPARISON',
  'KNOWLEDGE_EXTRACTION',
  'CREATIVE_GENERATION',
  'DATA_PIPELINE',
];

/**
 * GET /api/scheduler/suggestions
 *
 * Returns AI-generated prompt suggestions for the authenticated user.
 * Query params:
 *   - category (optional): filter by suggestion category
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Rate limit: 10 requests per minute
  const rl = await rateLimit(`suggestions:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a moment.' },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get('category')?.toUpperCase();

  let categoryFilter: SuggestionCategory | undefined;
  if (categoryParam) {
    if (!VALID_CATEGORIES.includes(categoryParam as SuggestionCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }
    categoryFilter = categoryParam as SuggestionCategory;
  }

  try {
    const suggestions = await generateSuggestions(userId, categoryFilter);

    // Fetch active promotions to calculate savings
    let activePromotion: ActivePromotion | null = null;
    try {
      const now = new Date();
      const promo = await prisma.providerPromotion.findFirst({
        where: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gte: now },
          multiplier: { gt: 1 },
        },
        orderBy: { multiplier: 'desc' },
      });

      if (promo) {
        activePromotion = {
          id: promo.id,
          provider: promo.provider,
          title: promo.title,
          multiplier: promo.multiplier,
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
          eligiblePlans: Array.isArray(promo.eligiblePlans)
            ? (promo.eligiblePlans as string[])
            : [],
          offPeakOnly: promo.offPeakOnly,
        };
      }
    } catch {
      // Promotion table may not exist yet — continue without savings
    }

    const enriched = suggestions.map((s) => ({
      ...s,
      savings: estimateSavings(s, activePromotion),
      activePromotion: activePromotion
        ? {
            id: activePromotion.id,
            provider: activePromotion.provider,
            title: activePromotion.title,
            multiplier: activePromotion.multiplier,
            endsAt: activePromotion.endsAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({
      suggestions: enriched,
      activePromotion: activePromotion
        ? {
            id: activePromotion.id,
            provider: activePromotion.provider,
            title: activePromotion.title,
            multiplier: activePromotion.multiplier,
            endsAt: activePromotion.endsAt.toISOString(),
          }
        : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Suggestions] Error generating suggestions:', err);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 },
    );
  }
}
