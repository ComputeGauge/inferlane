import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { createHash, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// GET  /api/trading/keys — list user's trading API keys
// POST /api/trading/keys — create new trading API key
// ---------------------------------------------------------------------------
// Trading API keys (ilt_ prefix) allow third-party platforms to submit
// orders, query indices, and manage contracts programmatically.
// This is the gateway for prediction markets, arbitrage bots, and
// synthetic trading platforms built on InferLane's compute liquidity.
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const keys = await prisma.tradingApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      permissions: true,
      rateLimit: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      // Never return keyHash
    },
  });

  return NextResponse.json({ keys });
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`trading-key:${userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Max 10 keys per user
  const existing = await prisma.tradingApiKey.count({ where: { userId } });
  if (existing >= 10) {
    return NextResponse.json({ error: 'Maximum 10 trading API keys allowed' }, { status: 400 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, permissions = ['read', 'trade'] } = body;

  if (!name || typeof name !== 'string' || name.length < 2) {
    return NextResponse.json({ error: 'name is required (min 2 chars)' }, { status: 400 });
  }

  const validPermissions = ['read', 'trade', 'settle'];
  const filteredPerms = (permissions as string[]).filter((p: string) => validPermissions.includes(p));
  if (filteredPerms.length === 0) {
    return NextResponse.json({ error: 'At least one valid permission required (read, trade, settle)' }, { status: 400 });
  }

  // Generate key
  const rawKey = `ilt_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  await prisma.tradingApiKey.create({
    data: {
      userId,
      name: name.trim(),
      keyHash,
      permissions: filteredPerms,
    },
  });

  // Return key ONCE — never stored in plaintext
  return NextResponse.json({
    key: rawKey,
    name: name.trim(),
    permissions: filteredPerms,
    message: 'Save this key — it will not be shown again.',
  }, { status: 201 });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
