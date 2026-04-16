import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// POST /api/auth/cli — CLI-based API key creation
//
// Two-step flow (no browser required):
//
// Step 1: POST with { action: "start" }
//   → Returns a one-time code the user pastes into the CLI
//   → Creates a pending auth record
//
// Step 2: POST with { action: "complete", code: "...", email: "..." }
//   → Validates the code, creates user + API key
//   → Returns the API key
//
// The code expires after 10 minutes. This is simpler than a full OAuth
// device flow but achieves the same UX: user stays in terminal.

const PENDING_CODES = new Map<string, { email?: string; expiresAt: number; used: boolean }>();

// Cleanup expired codes periodically
function cleanupCodes() {
  const now = Date.now();
  for (const [code, data] of PENDING_CODES) {
    if (data.expiresAt < now || data.used) PENDING_CODES.delete(code);
  }
}

export async function POST(req: NextRequest) {
  cleanupCodes();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success: rateLimitOk } = await rateLimit(`cli-auth:${ip}`, 10, 60 * 60 * 1000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  // ─── Step 1: Start — generate a verification code ────────────────────
  if (action === 'start') {
    const { email } = body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Generate a short memorable code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F2B1"
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    PENDING_CODES.set(code, { email: email.toLowerCase().trim(), expiresAt, used: false });

    // In production, send the code via email for verification
    // For now, return it directly (the CLI shows it to the user)
    return NextResponse.json({
      code,
      expiresIn: '10 minutes',
      next: `POST /api/auth/cli with { "action": "complete", "code": "${code}", "email": "${email}" }`,
    });
  }

  // ─── Step 2: Complete — verify code and create API key ───────────────
  if (action === 'complete') {
    const { code, email } = body;
    if (!code || !email) {
      return NextResponse.json({ error: 'code and email are required' }, { status: 400 });
    }

    const pending = PENDING_CODES.get(code);
    if (!pending) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    if (pending.expiresAt < Date.now()) {
      PENDING_CODES.delete(code);
      return NextResponse.json({ error: 'Code expired. Start again.' }, { status: 400 });
    }
    if (pending.email !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Email does not match the code' }, { status: 400 });
    }
    if (pending.used) {
      return NextResponse.json({ error: 'Code already used' }, { status: 400 });
    }

    // Mark as used
    pending.used = true;
    PENDING_CODES.delete(code);

    // Find or create user
    const normalizedEmail = email.toLowerCase().trim();
    let user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: normalizedEmail, name: normalizedEmail.split('@')[0] },
      });
    }

    // Generate API key
    const { raw, hash, prefix } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: `cli-${new Date().toISOString().slice(0, 10)}`,
        keyHash: hash,
        keyPrefix: prefix,
        isActive: true,
      },
    });

    return NextResponse.json({
      apiKey: raw,
      email: normalizedEmail,
      note: 'Save this key — it cannot be retrieved again. Add to your environment: export INFERLANE_API_KEY="' + raw + '"',
    });
  }

  // ─── One-step: Quick key generation with email ───────────────────────
  // For the simplest possible flow: POST with { email }
  // Creates user + key immediately. No verification step.
  // Gated by rate limiting (10/hr per IP).
  if (body.email && !action) {
    const normalizedEmail = body.email.toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    let user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: normalizedEmail, name: normalizedEmail.split('@')[0] },
      });
    }

    // Check key limit
    const existingKeys = await prisma.apiKey.count({ where: { userId: user.id, isActive: true } });
    if (existingKeys >= 10) {
      return NextResponse.json({ error: 'Maximum 10 active API keys per account' }, { status: 400 });
    }

    const { raw, hash, prefix } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: `cli-${new Date().toISOString().slice(0, 10)}`,
        keyHash: hash,
        keyPrefix: prefix,
        isActive: true,
      },
    });

    return NextResponse.json({
      apiKey: raw,
      email: normalizedEmail,
      setup: `export INFERLANE_API_KEY="${raw}"`,
      note: 'Save this key — it cannot be retrieved again.',
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use { "email": "you@example.com" } for quick key creation.' }, { status: 400 });
}
