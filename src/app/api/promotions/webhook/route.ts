// ---------------------------------------------------------------------------
// POST /api/promotions/webhook — Inbound webhook for external promotion data
// ---------------------------------------------------------------------------
// Accepts promotion data from partners or monitoring services.
// Secured by PROMOTION_WEBHOOK_SECRET, not session auth.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

const VALID_PROMOTION_TYPES = [
  'USAGE_BONUS', 'PRICE_DISCOUNT', 'FREE_TIER',
  'CREDIT_GRANT', 'NEW_MODEL_PREVIEW', 'RATE_LIMIT_BOOST',
] as const;

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function handlePOST(req: NextRequest) {
  // Authenticate via webhook secret
  const secret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  const webhookSecret = process.env.PROMOTION_WEBHOOK_SECRET;

  if (!webhookSecret || !secret || !safeCompare(secret, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit by IP: 10/min
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success: rateLimitOk } = await rateLimit(
    `promotions:webhook:${ip}`,
    10,
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
    rawDescription,
    affectedSurfaces,
    stacksWithOther,
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

  const parsedStart = new Date(startsAt);
  const parsedEnd = new Date(endsAt);
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid date format for startsAt or endsAt' }, { status: 400 });
  }
  if (parsedEnd <= parsedStart) {
    return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  }

  try {
    // Upsert: match on provider + sourceUrl + title
    const existing = await prisma.providerPromotion.findFirst({
      where: {
        provider,
        sourceUrl,
        title,
      },
    });

    const now = new Date();
    const data = {
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
      affectedSurfaces: Array.isArray(affectedSurfaces) ? affectedSurfaces : [],
      stacksWithOther: stacksWithOther === true,
      rawDescription: rawDescription || title,
      confidence: 0.9, // External webhooks get high (but not perfect) confidence
      status: parsedStart <= now && parsedEnd > now ? 'ACTIVE' as const : (parsedStart > now ? 'UPCOMING' as const : 'EXPIRED' as const),
    };

    let promotion;
    if (existing) {
      promotion = await prisma.providerPromotion.update({
        where: { id: existing.id },
        data,
      });
    } else {
      promotion = await prisma.providerPromotion.create({ data });
    }

    return NextResponse.json(
      { id: promotion.id, status: promotion.status, upserted: !!existing },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return handleApiError(error, 'PromotionWebhook');
  }
}

export const POST = withTiming(handlePOST);
