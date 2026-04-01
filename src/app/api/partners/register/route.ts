import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only for now
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, slug, contactEmail, revSharePct } = body;

  if (!name || typeof name !== 'string' || name.length > 100) {
    return NextResponse.json({ error: 'name is required (max 100 chars)' }, { status: 400 });
  }
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'slug is required (lowercase alphanumeric + hyphens)' }, { status: 400 });
  }
  if (!contactEmail || typeof contactEmail !== 'string') {
    return NextResponse.json({ error: 'contactEmail is required' }, { status: 400 });
  }

  const share = typeof revSharePct === 'number' ? Math.min(Math.max(revSharePct, 0), 0.50) : 0.10;

  // Generate callback key
  const rawKey = `ilp_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = await bcrypt.hash(rawKey, 10);

  try {
    const partner = await prisma.partner.create({
      data: {
        name,
        slug,
        callbackKeyHash: keyHash,
        revSharePct: share,
        contactEmail,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PARTNER_REGISTERED',
        resource: 'partner',
        details: { partnerId: partner.id, name, slug },
      },
    });

    return NextResponse.json({
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      revSharePct: partner.revSharePct,
      // Return the raw key ONCE — partner must save it
      callbackKey: rawKey,
      warning: 'Save this callback key now. It will not be shown again.',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Partner name or slug already exists' }, { status: 409 });
    }
    throw error;
  }
}

export const POST = withTiming(handlePOST);
