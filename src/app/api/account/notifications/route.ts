// GET  /api/account/notifications — fetch notification preferences
// PUT  /api/account/notifications — update notification preferences

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
  for (const f of strFields) {
    if (typeof body[f] === 'string') allowed[f] = body[f] || null; // empty string → null
  }

  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId: session.user.id },
    update: allowed,
    create: { userId: session.user.id, ...allowed },
  });

  return NextResponse.json({ ok: true, prefs });
}
