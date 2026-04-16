// GET  /api/account/notifications — fetch notification preferences
// PUT  /api/account/notifications — update notification preferences

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await prisma.notificationPreferences.findUnique({
    where: { userId: session.user.id },
  });

  if (!prefs) {
    // Return defaults if no prefs exist yet
    return NextResponse.json({
      weeklyDigest: true,
      alertEmails: true,
      tradeNotifs: true,
      payoutNotifs: true,
      marketingEmails: false,
      slackWebhookUrl: null,
      telegramBotToken: null,
      telegramChatId: null,
      discordWebhookUrl: null,
      webhookUrl: null,
    });
  }

  // Never return full bot token — mask it
  return NextResponse.json({
    ...prefs,
    telegramBotToken: prefs.telegramBotToken
      ? `${prefs.telegramBotToken.slice(0, 10)}...${prefs.telegramBotToken.slice(-4)}`
      : null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Whitelist allowed fields
  const allowed: Record<string, unknown> = {};
  const boolFields = ['weeklyDigest', 'alertEmails', 'tradeNotifs', 'payoutNotifs', 'marketingEmails'];
  const strFields = ['slackWebhookUrl', 'telegramBotToken', 'telegramChatId', 'discordWebhookUrl', 'webhookUrl'];

  for (const f of boolFields) {
    if (typeof body[f] === 'boolean') allowed[f] = body[f];
  }
  // Credential fields are encrypted at rest using the same vault
  // as API keys (AES-256-GCM via HKDF). telegramChatId is NOT
  // encrypted — it's not a credential, just an identifier.
  const credentialFields = ['slackWebhookUrl', 'telegramBotToken', 'discordWebhookUrl', 'webhookUrl'];
  for (const f of strFields) {
    if (typeof body[f] === 'string') {
      const val = body[f] || null;
      if (val && credentialFields.includes(f)) {
        allowed[f] = encrypt(val); // encrypt credentials at rest
      } else {
        allowed[f] = val;
      }
    }
  }

  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId: session.user.id },
    update: allowed,
    create: { userId: session.user.id, ...allowed },
  });

  return NextResponse.json({ ok: true, prefs });
}
