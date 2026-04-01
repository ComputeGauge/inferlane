import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { initiateDispute } from '@/lib/compute-intel/settlement';

// ---------------------------------------------------------------------------
// POST /api/compute-intel/settlement/dispute
// ---------------------------------------------------------------------------
// Initiate a dispute on a settlement record.
// Body: { settlementId: string, reason: string }
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Strict rate limit — disputes are a serious action
  const rl = await rateLimit(`dispute:${userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { settlementId, reason } = body;

  if (!settlementId || typeof settlementId !== 'string') {
    return NextResponse.json({ error: 'settlementId is required' }, { status: 400 });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return NextResponse.json(
      { error: 'reason is required (minimum 10 characters)' },
      { status: 400 },
    );
  }

  if (reason.length > 2000) {
    return NextResponse.json({ error: 'reason exceeds 2000 characters' }, { status: 400 });
  }

  const result = await initiateDispute(settlementId, userId, reason.trim());

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    settlementId,
    message: 'Dispute initiated. Settlement has been frozen pending review.',
  });
}

export const POST = withTiming(handlePOST);
