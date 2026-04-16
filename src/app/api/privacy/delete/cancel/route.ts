// POST /api/privacy/delete/cancel — cancel a pending account deletion.
//
// Only valid during the 30-day cooling-off window after POST
// /api/privacy/delete. Clears `deletedAt` on the User row.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`privacy-delete-cancel:${auth.userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { deletedAt: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!user.deletedAt) {
    return NextResponse.json(
      { error: 'No pending deletion to cancel' },
      { status: 409 },
    );
  }
  if (user.deletedAt < new Date()) {
    return NextResponse.json(
      { error: 'Cooling-off window has elapsed; contact support' },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { deletedAt: null },
  });

  logger.info('privacy.delete.cancelled', { userId: auth.userId });

  return NextResponse.json({ ok: true });
}
