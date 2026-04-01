import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET   /api/account/notifications — Get notification preferences
// PATCH /api/account/notifications — Update notification preferences
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = ['weeklyDigest', 'alertEmails', 'tradeNotifs', 'payoutNotifs', 'marketingEmails'] as const;

async function handleGET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    // Return existing prefs or defaults
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Return defaults (all opted in except marketing)
      return NextResponse.json({
        weeklyDigest: true,
        alertEmails: true,
        tradeNotifs: true,
        payoutNotifs: true,
        marketingEmails: false,
      });
    }

    return NextResponse.json({
      weeklyDigest: prefs.weeklyDigest,
      alertEmails: prefs.alertEmails,
      tradeNotifs: prefs.tradeNotifs,
      payoutNotifs: prefs.payoutNotifs,
      marketingEmails: prefs.marketingEmails,
    });
  } catch (error) {
    return handleApiError(error, 'GetNotificationPrefs');
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const rl = await rateLimit(`notif-prefs:${userId}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate only allowed boolean fields
    const updateData: Record<string, boolean> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        if (typeof body[field] !== 'boolean') {
          return NextResponse.json(
            { error: `${field} must be a boolean` },
            { status: 400 },
          );
        }
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      weeklyDigest: prefs.weeklyDigest,
      alertEmails: prefs.alertEmails,
      tradeNotifs: prefs.tradeNotifs,
      payoutNotifs: prefs.payoutNotifs,
      marketingEmails: prefs.marketingEmails,
    });
  } catch (error) {
    return handleApiError(error, 'UpdateNotificationPrefs');
  }
}

export const GET = withTiming(handleGET);
export const PATCH = withTiming(handlePATCH);
