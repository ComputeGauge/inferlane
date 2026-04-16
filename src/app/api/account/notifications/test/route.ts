// POST /api/account/notifications/test — send a test alert to a specific channel

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deliverAlert, type AlertChannel, type DeliverableAlert } from '@/lib/alerts/delivery';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const channel = body.channel as AlertChannel;

  if (!channel || !['EMAIL', 'SLACK', 'TELEGRAM', 'DISCORD', 'WEBHOOK'].includes(channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  }

  const testAlert: DeliverableAlert = {
    type: 'TEST_ALERT',
    provider: 'InferLane',
    message: `This is a test alert from InferLane. If you see this, your ${channel.toLowerCase()} notifications are working correctly.`,
    severity: 'warning',
    recipientEmail: session.user.email || undefined,
    slackWebhookUrl: body.slackWebhookUrl,
    telegramBotToken: body.telegramBotToken,
    telegramChatId: body.telegramChatId,
    discordWebhookUrl: body.discordWebhookUrl,
    webhookUrl: body.webhookUrl,
  };

  try {
    const ok = await deliverAlert(testAlert, channel);
    if (ok) {
      return NextResponse.json({ ok: true, message: `Test alert sent via ${channel}` });
    }
    return NextResponse.json({ ok: false, message: `Failed to deliver via ${channel} — check your credentials` }, { status: 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
