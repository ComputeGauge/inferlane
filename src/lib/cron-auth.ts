import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
    || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!process.env.CRON_SECRET || !secret) return false;

  try {
    return timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(process.env.CRON_SECRET)
    );
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
