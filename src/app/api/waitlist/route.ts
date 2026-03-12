import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/waitlist — capture email for early access
export async function POST(req: NextRequest) {
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

  try {
    // Upsert to avoid duplicates
    await prisma.waitlistEntry.upsert({
      where: { email: email.toLowerCase().trim() },
      update: { updatedAt: new Date() },
      create: {
        email: email.toLowerCase().trim(),
        source: 'landing_page',
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    // If Prisma model doesn't exist yet, store in audit log as fallback
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'WAITLIST_SIGNUP',
          resource: 'waitlist',
          details: { email: email.toLowerCase().trim(), source: 'landing_page' },
        },
      });
      return NextResponse.json({ success: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
  }
}
