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

// GET /api/teams/[teamId]/members — List team members with roles
async function handleGET(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;

  const role = await getUserTeamRole(userId, teamId);
  if (!role) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    })),
  });
}

// POST /api/teams/[teamId]/members — Invite a member by email
async function handlePOST(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;
  const { success } = await rateLimit(`teams-invite:${userId}`, 20, 60_000);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const role = await getUserTeamRole(userId, teamId);
  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Only owners and admins can invite members' }, { status: 403 });
  }

  const body = await req.json();
  const { email, role: memberRole } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'MEMBER', 'VIEWER'];
  if (!memberRole || !validRoles.includes(memberRole)) {
    return NextResponse.json({ error: `Role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  // Non-owners cannot assign ADMIN role
  if (memberRole === 'ADMIN' && role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owners can assign the ADMIN role' }, { status: 403 });
  }

  // Find user by email
  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json({ error: 'No user found with that email' }, { status: 404 });
  }

  // Check if already a member
  const existingMember = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: targetUser.id, teamId } },
  });
  if (existingMember) {
    return NextResponse.json({ error: 'User is already a member of this team' }, { status: 409 });
  }

  const member = await prisma.teamMember.create({
    data: {
      userId: targetUser.id,
      teamId,
      role: memberRole,
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({
    member: {
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    },
  }, { status: 201 });
}

// DELETE /api/teams/[teamId]/members — Remove a member
async function handleDELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await ctx.params;
  const userId = session.user.id;
  const { success } = await rateLimit(`teams-remove:${userId}`, 20, 60_000);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const role = await getUserTeamRole(userId, teamId);
  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
  }

  const body = await req.json();
  const { userId: targetUserId } = body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // Cannot remove the owner
  const targetMembership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: targetUserId, teamId } },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member of this team' }, { status: 404 });
  }
  if (targetMembership.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 403 });
  }

  // ADMINs cannot remove other ADMINs
  if (targetMembership.role === 'ADMIN' && role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owners can remove admins' }, { status: 403 });
  }

  await prisma.teamMember.delete({
    where: { userId_teamId: { userId: targetUserId, teamId } },
  });

  return NextResponse.json({ success: true });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const DELETE = withTiming(handleDELETE);
