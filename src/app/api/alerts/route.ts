import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/alerts — list user's alerts
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(alerts);
}

// POST /api/alerts — create a new alert
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { type, provider, threshold, channel, message } = body;

  if (!type || !threshold) {
    return NextResponse.json({ error: 'type and threshold are required' }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      userId,
      type,
      provider: provider || null,
      threshold,
      channel: channel || 'IN_APP',
      message: message || `Alert: ${type} at $${threshold}`,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}

// DELETE /api/alerts — delete an alert
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.alert.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
