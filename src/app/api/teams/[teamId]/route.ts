import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { rateLimit } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ teamId: string }> };

// Helper: check user's role on team
async function getUserTeamRole(userId: string, teamId: string) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return membership?.role || null;
}

// GET /api/teams/[teamId] — Get team details with members and spend
async function handleGET(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;

  const role = await getUserTeamRole(userId, teamId);
  if (!role) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // Get current month spend per member
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const memberUserIds = team.members.map((m) => m.userId);

  const spendSnapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId: { in: memberUserIds },
      createdAt: { gte: monthStart },
    },
    include: {
      providerConnection: { select: { provider: true } },
    },
  });

  // Aggregate spend per user and per provider
  const spendByUser: Record<string, number> = {};
  const spendByProvider: Record<string, number> = {};
  let totalSpend = 0;

  for (const snap of spendSnapshots) {
    const spend = Number(snap.totalSpend);
    spendByUser[snap.userId] = (spendByUser[snap.userId] || 0) + spend;
    const provider = snap.providerConnection.provider;
    spendByProvider[provider] = (spendByProvider[provider] || 0) + spend;
    totalSpend += spend;
  }

  const membersWithSpend = team.members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    spendThisMonth: spendByUser[m.userId] || 0,
    joinedAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({
    id: team.id,
    name: team.name,
    slug: team.slug,
    currentUserRole: role,
    members: membersWithSpend,
    totalSpendThisMonth: totalSpend,
    spendByProvider,
    createdAt: team.createdAt.toISOString(),
  });
}

// PUT /api/teams/[teamId] — Update team name (OWNER or ADMIN only)
async function handlePUT(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;

  const role = await getUserTeamRole(userId, teamId);
  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Only owners and admins can update the team' }, { status: 403 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: { name: name.trim() },
  });

  return NextResponse.json({ team });
}

// DELETE /api/teams/[teamId] — Delete team (OWNER only)
async function handleDELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;
  const { success } = await rateLimit(`teams-delete:${userId}`, 5, 60_000);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const role = await getUserTeamRole(userId, teamId);
  if (role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the team owner can delete the team' }, { status: 403 });
  }

  // Delete all members first, then the team
  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.team.delete({ where: { id: teamId } });

  return NextResponse.json({ success: true });
}

export const GET = withTiming(handleGET);
export const PUT = withTiming(handlePUT);
export const DELETE = withTiming(handleDELETE);
