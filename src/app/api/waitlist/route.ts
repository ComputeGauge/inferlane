import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { sendEmail } from '@/lib/email';

const ADMIN_EMAIL = process.env.WAITLIST_NOTIFY_EMAIL || 'aardappvark@proton.me';

// POST /api/waitlist — capture email for early access
async function handlePOST(req: NextRequest) {
  // Rate limit: 5 submissions per IP per 15 minutes
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = await rateLimit(`waitlist:${ip}`, 5, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
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

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Upsert to avoid duplicates
    await prisma.waitlistEntry.upsert({
      where: { email: normalizedEmail },
      update: { updatedAt: new Date() },
      create: {
        email: normalizedEmail,
        source: 'landing_page',
      },
    });

    // Fire-and-forget: notify admin + send confirmation to subscriber
    notifyWaitlistSignup(normalizedEmail).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    // If Prisma model doesn't exist yet, store in audit log as fallback
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'WAITLIST_SIGNUP',
          resource: 'waitlist',
          details: { email: normalizedEmail, source: 'landing_page' },
        },
      });

      notifyWaitlistSignup(normalizedEmail).catch(() => {});

      return NextResponse.json({ success: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
  }
}

async function notifyWaitlistSignup(subscriberEmail: string) {
  // 1. Notify admin
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New waitlist signup: ${subscriberEmail}`,
    html: `<p style="font-family:sans-serif;color:#e2e8f0;">New waitlist signup from <strong>${subscriberEmail}</strong> at ${new Date().toISOString()}.</p>`,
  });

  // 2. Send confirmation to subscriber
  const appUrl = process.env.APP_URL || 'https://inferlane.dev';
  await sendEmail({
    to: subscriberEmail,
    subject: "You're on the InferLane waitlist",
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#f97316);text-align:center;line-height:40px;font-size:20px;color:#000;">&#9889;</div>
    </div>
    <div style="background:#12121a;border:1px solid #1e1e2e;border-radius:16px;padding:32px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">You're on the list.</h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
        We'll notify you when InferLane launches new features. In the meantime, the MCP server is already available:
      </p>
      <div style="background:#0a0a0f;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <code style="color:#4ade80;font-size:13px;">npm install @inferlane/mcp-server</code>
      </div>
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Learn More
      </a>
    </div>
    <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:24px;">InferLane &mdash; Compute infrastructure intelligence</p>
  </div>
</body></html>`,
  });
}

export const POST = withTiming(handlePOST);
