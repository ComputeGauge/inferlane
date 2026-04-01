import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider } = body;
  if (!provider || typeof provider !== 'string') {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  // Find the most recent unconverted click for this user+provider within 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const click = await prisma.affiliateClick.findFirst({
    where: {
      userId: session.user.id,
      provider: provider.toUpperCase(),
      converted: false,
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (click) {
    await prisma.affiliateClick.update({
      where: { id: click.id },
      data: {
        converted: true,
        convertedAt: new Date(),
      },
    });
    return NextResponse.json({ converted: true, clickId: click.id });
  }

  return NextResponse.json({ converted: false });
}

export const POST = withTiming(handlePOST);
