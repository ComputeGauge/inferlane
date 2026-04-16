// POST /api/kyc/sessions — start a Stripe Identity verification session
// GET  /api/kyc/sessions  — get the latest KYC status for the caller
//
// Commercial build, Phase 2.2. Wraps src/lib/kyc/stripe-identity.ts
// in the standard auth + rate-limit envelope.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { startKycSession, getKycStatus } from '@/lib/kyc/stripe-identity';
import { logger } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`kyc-start:${auth.userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const purpose = (body.purpose as 'buyer' | 'seller') ?? 'seller';
  const returnUrl =
    (body.returnUrl as string | undefined) ??
    `${process.env.NEXTAUTH_URL ?? 'https://inferlane.dev'}/dashboard/operator/onboarding/kyc`;

  try {
    const session = await startKycSession({
      subjectId: user.id,
      purpose,
      email: user.email,
      returnUrl,
    });

    // Persist the session id so we can resume / poll.
    await prisma.kycSession.create({
      data: {
        subjectUserId: user.id,
        purpose: purpose === 'seller' ? 'SELLER_ONBOARDING' : 'BUYER_HIGH_VALUE',
        provider: 'STRIPE_IDENTITY',
        providerSessionId: session.providerSessionId,
        status: session.status,
        expiresAt: session.expiresAt,
      },
    });

    return NextResponse.json({
      providerSessionId: session.providerSessionId,
      clientSecret: session.clientSecret,
      verificationUrl: session.verificationUrl,
      status: session.status,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    logger.warn('kyc.start.failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Unable to start KYC session' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`kyc-get:${auth.userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const latest = await prisma.kycSession.findFirst({
    where: { subjectUserId: auth.userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) {
    return NextResponse.json({ status: 'NOT_STARTED' });
  }

  // Refresh from Stripe if the session isn't terminal yet.
  if (latest.status !== 'VERIFIED' && latest.status !== 'REJECTED') {
    try {
      const fresh = await getKycStatus(latest.providerSessionId);
      if (fresh.status !== latest.status) {
        await prisma.kycSession.update({
          where: { id: latest.id },
          data: {
            status: fresh.status,
            attestationHash: fresh.attestationHash,
            verifiedAt: fresh.verifiedAt,
            rejectedAt: fresh.status === 'REJECTED' ? new Date() : null,
            rejectionReason: fresh.lastError,
          },
        });
        return NextResponse.json({
          status: fresh.status,
          verifiedAt: fresh.verifiedAt,
        });
      }
    } catch {
      /* swallow and return cached */
    }
  }

  return NextResponse.json({
    status: latest.status,
    verifiedAt: latest.verifiedAt,
  });
}
