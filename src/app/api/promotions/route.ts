// ---------------------------------------------------------------------------
// GET/POST /api/promotions — List and submit promotions (Stream Z1)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { createHash } from 'crypto';

const VALID_PROMOTION_TYPES = [
  'USAGE_BONUS', 'PRICE_DISCOUNT', 'FREE_TIER',
  'CREDIT_GRANT', 'NEW_MODEL_PREVIEW', 'RATE_LIMIT_BOOST',
] as const;

const VALID_STATUSES = ['UPCOMING', 'ACTIVE', 'EXPIRED'] as const;

/**
 * Resolve an authenticated identity from session or Bearer token.
 * Returns a rate-limit key (userId or token hash) or null if unauthenticated.
 */
async function resolveIdentity(req: NextRequest): Promise<string | null> {
  // Try session first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as { id: string }).id;
  }

  // Fall back to Bearer token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer il_')) {
    return null;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
    select: { userId: true },
  });

  return apiKey?.userId ?? null;
}

// GET /api/promotions — list active promotions
async function handleGET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 30/min
  const { success: rateLimitOk } = await rateLimit(
    `promotions:get:${identity}`,
    30,
    60_000,
  );
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const now = new Date();
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const where: Record<string, unknown> = {
      status: 'ACTIVE' as any,
      startsAt: { lte: now },
      endsAt: { gte: now },
    };

    // Allow overriding the default "active only" filter
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      where.status = status;
      // If querying non-ACTIVE statuses, remove the date bounds
      if (status !== 'ACTIVE') {
        delete where.startsAt;
        delete where.endsAt;
      }
    }

    if (provider) where.provider = provider;

    const promotions = await prisma.providerPromotion.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ promotions });
  } catch (error) {
    return handleApiError(error, 'ListPromotions');
  }
}

// POST /api/promotions — manually submit a promotion
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success: rateLimitOk } = await rateLimit(
    `promotions:post:${(session.user as { id: string }).id}`,
    5,
    60_000,
  );
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    provider,
    title,
    sourceUrl,
    startsAt,
    endsAt,
    type,
    multiplier,
    eligiblePlans,
    offPeakOnly,
    peakHoursStart,
    peakHoursEnd,
    peakTimezone,
  } = body;

  // Validate required fields
  if (!provider || !title || !sourceUrl || !startsAt || !endsAt || !type) {
    return NextResponse.json(
      { error: 'provider, title, sourceUrl, startsAt, endsAt, and type are required' },
      { status: 400 },
    );
  }

  if (!VALID_PROMOTION_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_PROMOTION_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  // Validate dates
  const parsedStart = new Date(startsAt);
  const parsedEnd = new Date(endsAt);
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid date format for startsAt or endsAt' }, { status: 400 });
  }
  if (parsedEnd <= parsedStart) {
    return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  }

  try {
    const promotion = await prisma.providerPromotion.create({
      data: {
        provider,
        title,
        type,
        sourceUrl,
        startsAt: parsedStart,
        endsAt: parsedEnd,
        eligiblePlans: Array.isArray(eligiblePlans) ? eligiblePlans : [],
        multiplier: typeof multiplier === 'number' ? multiplier : 1.0,
        offPeakOnly: offPeakOnly === true,
        peakHoursStart: peakHoursStart || null,
        peakHoursEnd: peakHoursEnd || null,
        peakTimezone: peakTimezone || null,
        affectedSurfaces: [],
        rawDescription: title,
        confidence: 1.0, // Manual submissions get full confidence
        status: parsedStart <= new Date() ? 'ACTIVE' : 'UPCOMING',
      },
    });

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreatePromotion');
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
