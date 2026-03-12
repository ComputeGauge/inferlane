import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';

// GET /api/api-keys — list user's API keys (never returns the actual key)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

// POST /api/api-keys — generate a new API key
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { name, permissions } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Check key limit (max 10 active keys)
  const activeCount = await prisma.apiKey.count({
    where: { userId, isActive: true },
  });
  if (activeCount >= 10) {
    return NextResponse.json({ error: 'Maximum 10 active API keys' }, { status: 400 });
  }

  const { raw, hash, prefix } = generateApiKey('live');

  const key = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: permissions || { proxy: true, read_spend: true },
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  // Return the raw key ONCE — it can never be retrieved again
  return NextResponse.json({ ...key, key: raw }, { status: 201 });
}

// DELETE /api/api-keys — revoke an API key
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const result = await prisma.apiKey.updateMany({
    where: { id, userId },
    data: { isActive: false },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'API_KEY_REVOKED',
      resource: 'api_key',
      details: { keyId: id },
    },
  });

  return NextResponse.json({ success: true });
}
