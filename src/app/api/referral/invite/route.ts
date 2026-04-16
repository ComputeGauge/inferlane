import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// POST /api/referral/invite — send a referral invite email
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const userName = (session.user as Record<string, unknown>).name as string | null;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Send the referral invite email
  const referrerName = userName || 'A InferLane user';
  const signupUrl = `${process.env.NEXTAUTH_URL || 'https://inferlane.dev'}/signup?ref=${userId}`;

  const emailSent = await sendEmail({
    to: email,
    subject: `${referrerName} invited you to InferLane`,
    html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 2px; border-radius: 16px;">
        <div style="background: #12121a; border-radius: 14px; padding: 32px;">
          <h1 style="color: #fff; font-size: 22px; margin: 0 0 12px;">You're invited to InferLane</h1>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            ${referrerName} thinks you'd benefit from InferLane — the cost intelligence layer for AI teams. Track spend across providers, discover cheaper alternatives, and optimize your AI infrastructure costs.
          </p>
          <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #f97316); color: #000; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 12px; text-decoration: none;">
            Get Started Free
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 24px 0 0;">
            InferLane works with OpenAI, Anthropic, Google, and 17 more providers.
          </p>
        </div>
      </div>
    </div>
  `,
  });

  // Log the invite in AuditLog
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'REFERRAL_INVITE_SENT',
      resource: 'referral',
      details: {
        inviteeEmail: email,
        referrerUserId: userId,
        emailSent,
      },
    },
  });

  return NextResponse.json({ success: true, emailSent });
}
