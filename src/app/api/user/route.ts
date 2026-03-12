import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/user — Return current user with subscription + connections
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscription: true,
        providerConnections: {
          where: { isActive: true },
          select: {
            id: true,
            provider: true,
            displayName: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            createdAt: true,
          },
        },
        alerts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            spendSnapshots: true,
            affiliateClicks: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      subscription: user.subscription,
      providerConnections: user.providerConnections,
      alerts: user.alerts,
      stats: {
        totalSnapshots: user._count.spendSnapshots,
        totalAffiliateClicks: user._count.affiliateClicks,
      },
    });
  } catch (error) {
    console.error('[User API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
