// POST /api/privacy/correct — GDPR Article 16 right to rectification.
//
// Lets a user correct inaccurate personal data on their account.
// This route is deliberately narrow: it only allows updating the
// fields a user has direct control over (name, email, notification
// prefs). Other personal data (KYC results, audit logs) cannot be
// corrected — if the underlying source is wrong, the user must
// redo the KYC flow or contact support.
//
// Closes SOC 2 P5.2 gap identified in commercial/memos/soc2-readiness.md

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/telemetry';

interface CorrectionRequest {
  name?: string;
  email?: string;
  image?: string | null;
  notificationPrefs?: {
    weeklyDigest?: boolean;
    alertEmails?: boolean;
    tradeNotifs?: boolean;
    payoutNotifs?: boolean;
    marketingEmails?: boolean;
  };
}

function isPlausibleEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`privacy-correct:${auth.userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: CorrectionRequest;
  try {
    body = (await req.json()) as CorrectionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: { name?: string; email?: string; image?: string | null } = {};
  const nameOk = typeof body.name === 'string' && body.name.length > 0 && body.name.length <= 200;
  if (nameOk) updates.name = body.name!.trim();

  // Image correction: allow setting a profile image URL or clearing
  // it (set to null). Primarily for users who want to override the
  // OAuth-sourced avatar.
  if (body.image !== undefined) {
    if (body.image === null || body.image === '') {
      updates.image = null; // clear image
    } else if (typeof body.image === 'string' && body.image.startsWith('https://') && body.image.length <= 2048) {
      updates.image = body.image;
    }
  }

  // Email correction: validate format + check it's not already in
  // use by another account.
  if (typeof body.email === 'string' && body.email !== '') {
    if (!isPlausibleEmail(body.email)) {
      return NextResponse.json({ error: 'email must be a valid email address' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing && existing.id !== auth.userId) {
      return NextResponse.json(
        { error: 'email already in use by another account' },
        { status: 409 },
      );
    }
    updates.email = body.email;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({
      where: { id: auth.userId },
      data: updates,
    });
  }

  if (body.notificationPrefs) {
    await prisma.notificationPreferences.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        weeklyDigest: body.notificationPrefs.weeklyDigest ?? true,
        alertEmails: body.notificationPrefs.alertEmails ?? true,
        tradeNotifs: body.notificationPrefs.tradeNotifs ?? true,
        payoutNotifs: body.notificationPrefs.payoutNotifs ?? true,
        marketingEmails: body.notificationPrefs.marketingEmails ?? false,
      },
      update: {
        ...(body.notificationPrefs.weeklyDigest !== undefined && {
          weeklyDigest: body.notificationPrefs.weeklyDigest,
        }),
        ...(body.notificationPrefs.alertEmails !== undefined && {
          alertEmails: body.notificationPrefs.alertEmails,
        }),
        ...(body.notificationPrefs.tradeNotifs !== undefined && {
          tradeNotifs: body.notificationPrefs.tradeNotifs,
        }),
        ...(body.notificationPrefs.payoutNotifs !== undefined && {
          payoutNotifs: body.notificationPrefs.payoutNotifs,
        }),
        ...(body.notificationPrefs.marketingEmails !== undefined && {
          marketingEmails: body.notificationPrefs.marketingEmails,
        }),
      },
    });
  }

  const updatedFields = Object.keys(updates);
  // Telemetry facade only accepts scalar attribute values, so we
  // JSON-stringify the field list rather than passing the array.
  logger.info('privacy.correct.applied', {
    userId: auth.userId,
    fieldsJson: JSON.stringify(updatedFields),
    prefsUpdated: body.notificationPrefs !== undefined,
  });

  return NextResponse.json({ ok: true, updatedFields });
}
