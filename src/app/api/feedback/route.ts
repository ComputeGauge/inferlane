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

  try {
    const body = await req.json();
    const { type, message } = body;

    if (!message || typeof message !== 'string' || message.length > 2000) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
    }

    const validTypes = ['bug', 'feature', 'other'];
    const feedbackType = validTypes.includes(type) ? type : 'other';

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FEEDBACK_SUBMITTED',
        resource: 'feedback',
        details: {
          type: feedbackType,
          message: message.slice(0, 2000),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Feedback] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withTiming(handlePOST);
