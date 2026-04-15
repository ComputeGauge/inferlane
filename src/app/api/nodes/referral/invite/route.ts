import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { sendEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// POST /api/nodes/referral/invite — Send node operator referral invite
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`node-referral:${userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Must be a registered node operator
  const node = await prisma.nodeOperator.findUnique({
    where: { userId },
    select: { id: true, displayName: true },
  });

  if (!node) {
    return NextResponse.json(
      { error: 'You must be a registered node operator to send referral invites' },
      { status: 403 },
    );
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email } = body;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://inferlane.ai';
  const referralLink = `${baseUrl}/dashboard/nodes?ref=${node.id}`;

  const inviterName = node.displayName ?? 'A node operator';
  const emailSent = await sendEmail({
    to: email,
    subject: `${inviterName} invited you to join InferLane`,
    html: [
      `<p>You've been invited to become a node operator on InferLane by <strong>${inviterName}</strong>.</p>`,
      '<p>Earn money by contributing your GPU compute to the network.</p>',
      `<p><a href="${referralLink}">Join here</a></p>`,
      '<p>&mdash; InferLane</p>',
    ].join(''),
  });

  if (!emailSent) {
    return NextResponse.json({ error: 'Failed to send invite email' }, { status: 500 });
  }

  // Log the referral invite
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'NODE_REFERRAL_INVITE',
      resource: 'node_referral',
      details: { email, nodeId: node.id },
    },
  });

  return NextResponse.json({
    message: `Invite sent to ${email}`,
    referralLink,
  });
}

export const POST = withTiming(handlePOST);
