import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import bcrypt from 'bcryptjs';

async function authenticatePartner(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ilp_')) return null;

  const rawKey = authHeader.slice(7);
  const partners = await prisma.partner.findMany({ where: { isActive: true } });

  for (const partner of partners) {
    if (await bcrypt.compare(rawKey, partner.callbackKeyHash)) {
      return partner;
    }
  }
  return null;
}

async function handleGET(req: NextRequest) {
  const partner = await authenticatePartner(req);
  if (!partner) {
    return NextResponse.json({ error: 'Invalid or missing partner key' }, { status: 401 });
  }

  const referredUsers = await prisma.user.count({
    where: { partnerId: partner.id },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const referredThisMonth = await prisma.user.count({
    where: {
      partnerId: partner.id,
      createdAt: { gte: thisMonth },
    },
  });

  return NextResponse.json({
    partner: {
      name: partner.name,
      slug: partner.slug,
      revSharePct: partner.revSharePct,
    },
    referredUsers: {
      total: referredUsers,
      thisMonth: referredThisMonth,
    },
  });
}

export const GET = withTiming(handleGET);
