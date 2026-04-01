import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

const VALID_ALERT_TYPES = [
  'BUDGET_WARNING', 'BUDGET_EXCEEDED', 'SPEND_SPIKE',
  'PROVIDER_DOWN', 'RATE_LIMIT', 'COST_ANOMALY',
] as const;

const VALID_CHANNELS = ['EMAIL', 'SLACK', 'WEBHOOK', 'IN_APP'] as const;

// GET /api/alerts — list user's alerts
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(alerts);
}

// POST /api/alerts — create a new alert
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { type, provider, threshold, channel, message, webhookUrl, slackWebhookUrl } = body;

  if (!type || !threshold) {
    return NextResponse.json({ error: 'type and threshold are required' }, { status: 400 });
  }

  // Validate alert type
  if (!VALID_ALERT_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}` }, { status: 400 });
  }

  // Validate channel if provided
  if (channel && !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 });
  }

  // Validate threshold is a positive number
  if (typeof threshold !== 'number' || threshold <= 0) {
    return NextResponse.json({ error: 'threshold must be a positive number' }, { status: 400 });
  }

  // Rate limit: 20 alerts per user per hour
  const { success: rateLimitOk } = await rateLimit(`alert:${userId}`, 20, 60 * 60 * 1000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const alert = await prisma.alert.create({
    data: {
      userId,
      type,
      provider: provider || null,
      threshold,
      channel: channel || 'IN_APP',
      message: buildAlertMessage(message, type, threshold, webhookUrl, slackWebhookUrl),
    },
  });

  return NextResponse.json(alert, { status: 201 });
}

// PUT /api/alerts — update an existing alert
async function handlePUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, threshold, channel, webhookUrl, slackWebhookUrl, message } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Verify the alert belongs to the user
  const existing = await prisma.alert.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  // Validate channel if provided
  if (channel && !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 });
  }

  // Validate threshold if provided
  if (threshold !== undefined && (typeof threshold !== 'number' || threshold <= 0)) {
    return NextResponse.json({ error: 'threshold must be a positive number' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (threshold !== undefined) updateData.threshold = threshold;
  if (channel) updateData.channel = channel;

  // Rebuild the message field with metadata if webhook URLs are provided
  if (message !== undefined || webhookUrl !== undefined || slackWebhookUrl !== undefined) {
    const baseMessage = message ?? existing.message?.replace(/\|META:\{.*\}$/, '') ?? '';
    const meta: Record<string, string> = {};

    // Preserve existing metadata then override
    try {
      const existingMetaMatch = existing.message?.match(/\|META:({.*})$/);
      if (existingMetaMatch) {
        Object.assign(meta, JSON.parse(existingMetaMatch[1]));
      }
    } catch { /* ignore */ }

    if (webhookUrl !== undefined) meta.webhookUrl = webhookUrl;
    if (slackWebhookUrl !== undefined) meta.slackWebhookUrl = slackWebhookUrl;

    const hasMetadata = Object.keys(meta).length > 0;
    updateData.message = hasMetadata
      ? `${baseMessage}|META:${JSON.stringify(meta)}`
      : baseMessage;
  }

  const updated = await prisma.alert.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

// DELETE /api/alerts — delete an alert
async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

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

/** Build the message field, optionally appending webhook metadata */
function buildAlertMessage(
  message: string | undefined,
  type: string,
  threshold: number,
  webhookUrl?: string,
  slackWebhookUrl?: string,
): string {
  const base = message || `Alert: ${type} at $${threshold}`;
  const meta: Record<string, string> = {};
  if (webhookUrl) meta.webhookUrl = webhookUrl;
  if (slackWebhookUrl) meta.slackWebhookUrl = slackWebhookUrl;
  if (Object.keys(meta).length === 0) return base;
  return `${base}|META:${JSON.stringify(meta)}`;
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const PUT = withTiming(handlePUT);
export const DELETE = withTiming(handleDELETE);
