import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { getReferralStats } from '@/lib/nodes/referral-bonus';

// ---------------------------------------------------------------------------
// GET /api/nodes/referral/stats — Node operator referral statistics
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`node-ref-stats:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const node = await prisma.nodeOperator.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!node) {
    return NextResponse.json(
      { error: 'Not registered as node operator' },
      { status: 404 },
    );
  }

  const stats = await getReferralStats(node.id);

  return NextResponse.json(stats);
}

export const GET = withTiming(handleGET);
