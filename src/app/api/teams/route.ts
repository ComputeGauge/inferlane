import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { rateLimit } from '@/lib/rate-limit';

// GET /api/teams — List user's teams with member counts and total spend
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      },
    },
  });

  // Get current month start for spend calculation
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const teams = await Promise.all(
    memberships.map(async (membership) => {
      const team = membership.team;
      const memberUserIds = team.members.map((m) => m.userId);

      // Aggregate spend for all team members this month
      const spendResult = await prisma.spendSnapshot.aggregate({
        where: {
          userId: { in: memberUserIds },
          createdAt: { gte: monthStart },
        },
        _sum: { totalSpend: true },
      });

      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        role: membership.role,
        memberCount: team.members.length,
        totalSpendThisMonth: Number(spendResult._sum.totalSpend || 0),
        createdAt: team.createdAt.toISOString(),
      };
    })
  );

  return NextResponse.json({ teams });
}

// POST /api/teams — Create a new team
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { success } = await rateLimit(`teams-create:${userId}`, 10, 60_000);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const { name, slug } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens' }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.team.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
  }

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      slug,
      members: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json({ team }, { status: 201 });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
