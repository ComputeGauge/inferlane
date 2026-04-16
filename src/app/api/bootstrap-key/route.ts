import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';

// POST /api/admin/bootstrap-key — Create an API key for testing.
// Requires CRON_SECRET header (reuses cron auth for admin access).
// This is intentionally gated — only someone with the cron secret can create keys.

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  if (!process.env.CRON_SECRET || !secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const email = body.email || 'admin@inferlane.dev';
  const keyName = body.name || 'bootstrap-key';

  // Find or create user
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: email.split('@')[0] },
    });
  }

  // Generate API key
  const { raw, hash, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: keyName,
      keyHash: hash,
      keyPrefix: prefix,
      isActive: true,
    },
  });

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    apiKey: raw,
    note: 'Save this key — it cannot be retrieved again.',
  });
}
