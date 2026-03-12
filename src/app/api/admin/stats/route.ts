import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all admin stats in parallel
    const [
      totalUsers,
      activeSubscriptions,
      totalProxyRequests,
      totalAffiliateClicks,
      totalGpuClusters,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', tier: { not: 'FREE' } } }),
      prisma.proxyRequest.count(),
      prisma.affiliateClick.count(),
      prisma.gpuCluster.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          email: true,
          createdAt: true,
          subscription: { select: { tier: true } },
        },
      }),
    ]);

    // Calculate MRR from active subscriptions
    const paidSubs = await prisma.subscription.groupBy({
      by: ['tier'],
      where: { status: 'ACTIVE', tier: { not: 'FREE' } },
      _count: true,
    });

    const tierPrices: Record<string, number> = {
      PRO: 9,
      HYBRID: 29,
      TEAM: 49,
      ENTERPRISE: 250, // avg enterprise
    };

    const totalRevenue = paidSubs.reduce(
      (sum, sub) => sum + (tierPrices[sub.tier] || 0) * sub._count,
      0
    );

    // MAU (users active in last 30 days via sessions)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyActiveUsers = await prisma.session.count({
      where: { expires: { gte: thirtyDaysAgo } },
    });

    return NextResponse.json({
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      monthlyActiveUsers,
      totalProxyRequests,
      totalAffiliateClicks,
      totalGpuClusters,
      recentSignups,
    });
  } catch (error) {
    console.error('[Admin Stats]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
