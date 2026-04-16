// Alert delivery dispatcher.
//
// Supports 6 channels: EMAIL, SLACK, TELEGRAM, DISCORD, WEBHOOK, IN_APP.
// Each channel gets a dedicated delivery function with branded formatting.
//
// Two usage modes:
//
//   1. EXPLICIT — caller passes URLs/tokens inline on DeliverableAlert.
//      Used by cron jobs and internal systems that know where to send.
//
//   2. AUTO — caller passes a userId and the dispatcher reads channel
//      config from the NotificationPreferences table. Used by the
//      anomaly detector and budget-alert check so users don't have to
//      configure alerts per-provider — they configure once in settings.

import { sendEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertChannel =
  | 'EMAIL'
  | 'SLACK'
  | 'TELEGRAM'
  | 'DISCORD'
  | 'WEBHOOK'
  | 'IN_APP';

export interface DeliverableAlert {
  type: string;
  provider: string;
  message: string;
  severity: 'warning' | 'critical';
  /** Email address for EMAIL channel */
  recipientEmail?: string;
  /** Slack incoming webhook URL */
  slackWebhookUrl?: string;
  /** Telegram bot token (from @BotFather) */
  telegramBotToken?: string;
  /** Telegram chat/group/channel ID to send to */
  telegramChatId?: string;
  /** Discord webhook URL */
  discordWebhookUrl?: string;
  /** Generic webhook URL */
  webhookUrl?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deliver an alert through the specified channel.
 * Returns true if the delivery succeeded, false otherwise.
 * Never throws — all errors are caught and logged.
 */
export async function deliverAlert(
  alert: DeliverableAlert,
  channel: AlertChannel,
): Promise<boolean> {
  switch (channel) {
    case 'EMAIL':
      return deliverEmail(alert);
    case 'SLACK':
      return deliverSlack(alert);
    case 'TELEGRAM':
      return deliverTelegram(alert);
    case 'DISCORD':
      return deliverDiscord(alert);
    case 'WEBHOOK':
      return deliverWebhook(alert);
    case 'IN_APP':
      return true;
    default:
      console.warn(`[AlertDelivery] Unknown channel: ${channel}`);
      return false;
  }
}

/**
 * Deliver an alert to ALL configured channels for a user.
 * Reads the user's NotificationPreferences and fans out to
 * every channel that has credentials configured. Returns the
 * number of channels that succeeded.
 */
export async function deliverToUserChannels(
  userId: string,
  alert: Omit<DeliverableAlert, 'recipientEmail' | 'slackWebhookUrl' | 'telegramBotToken' | 'telegramChatId' | 'discordWebhookUrl' | 'webhookUrl'>,
): Promise<number> {
  // Dynamic import so the delivery module doesn't force a Prisma
  // import at the module level (keeps it testable without a DB).
  const { prisma } = await import('@/lib/db');

  const [prefs, user] = await Promise.all([
    prisma.notificationPreferences.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  let succeeded = 0;

  // Email — always attempt if the user has alertEmails enabled and an email
  if (prefs?.alertEmails !== false && user?.email) {
    const ok = await deliverEmail({ ...alert, recipientEmail: user.email });
    if (ok) succeeded++;
  }

  // Slack — if user has a webhook URL configured
  if ((prefs as Record<string, unknown>)?.slackWebhookUrl) {
    const ok = await deliverSlack({
      ...alert,
      slackWebhookUrl: (prefs as Record<string, unknown>).slackWebhookUrl as string,
    });
    if (ok) succeeded++;
  }

  // Telegram — if user has bot token + chat ID configured
  if (
    (prefs as Record<string, unknown>)?.telegramBotToken &&
    (prefs as Record<string, unknown>)?.telegramChatId
  ) {
    const ok = await deliverTelegram({
      ...alert,
      telegramBotToken: (prefs as Record<string, unknown>).telegramBotToken as string,
      telegramChatId: (prefs as Record<string, unknown>).telegramChatId as string,
    });
    if (ok) succeeded++;
  }

  // Discord — if user has a webhook URL configured
  if ((prefs as Record<string, unknown>)?.discordWebhookUrl) {
    const ok = await deliverDiscord({
      ...alert,
      discordWebhookUrl: (prefs as Record<string, unknown>).discordWebhookUrl as string,
    });
    if (ok) succeeded++;
  }

  // Generic webhook — if user has a URL configured
  if ((prefs as Record<string, unknown>)?.webhookUrl) {
    const ok = await deliverWebhook({
      ...alert,
      webhookUrl: (prefs as Record<string, unknown>).webhookUrl as string,
    });
    if (ok) succeeded++;
  }

  // In-app is always delivered (it's just a DB row)
  succeeded++;

  return succeeded;
}

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------

async function deliverEmail(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.recipientEmail) {
    console.warn('[AlertDelivery] No recipient email for EMAIL channel');
    return false;
  }

  const severityColor = alert.severity === 'critical' ? '#ef4444' : '#f59e0b';
  const severityLabel = alert.severity.toUpperCase();
  const APP_URL = process.env.APP_URL || 'https://inferlane.dev';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;background:linear-gradient(135deg,#1e1e2e,#2d1b69);">
          <span style="color:#e2e8f0;font-size:20px;font-weight:700;">InferLane Alert</span>
          <span style="background:${severityColor};color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;margin-left:12px;">${severityLabel}</span>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="color:#94a3b8;font-size:12px;margin:0;text-transform:uppercase;">${alert.type.replace(/_/g, ' ')}</p>
          <p style="color:#e2e8f0;font-size:16px;margin:8px 0 0;line-height:1.5;">${escapeHtml(alert.message)}</p>
          <p style="color:#64748b;font-size:13px;margin:16px 0 0;">Provider: <strong style="color:#e2e8f0;">${escapeHtml(alert.provider)}</strong></p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            View Dashboard
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0f0f1a;border-top:1px solid #1e1e2e;">
          <p style="color:#64748b;font-size:11px;margin:0;text-align:center;">
            Manage alert preferences in your
            <a href="${APP_URL}/dashboard/settings" style="color:#7c3aed;text-decoration:none;">dashboard settings</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: alert.recipientEmail,
    subject: `[${severityLabel}] ${alert.type.replace(/_/g, ' ')}: ${alert.provider} — InferLane`,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// SLACK (rich Block Kit format)
// ---------------------------------------------------------------------------

async function deliverSlack(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.slackWebhookUrl) {
    console.warn('[AlertDelivery] No slackWebhookUrl for SLACK channel');
    return false;
  }

  const severityEmoji = alert.severity === 'critical' ? ':rotating_light:' : ':warning:';
  const APP_URL = process.env.APP_URL || 'https://inferlane.dev';

  try {
    const res = await fetch(alert.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${severityEmoji} InferLane ${alert.severity.toUpperCase()} Alert`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Type:*\n${alert.type.replace(/_/g, ' ')}` },
              { type: 'mrkdwn', text: `*Provider:*\n${alert.provider}` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: alert.message },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Dashboard' },
                url: `${APP_URL}/dashboard`,
                style: alert.severity === 'critical' ? 'danger' : 'primary',
              },
            ],
          },
        ],
        // Fallback for clients that don't support blocks
        text: `[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message} (${alert.provider})`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[AlertDelivery] Slack delivery failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// TELEGRAM (via Bot API — user creates bot with @BotFather)
//
// Setup instructions for users:
//   1. Open Telegram, search @BotFather
//   2. Send /newbot, follow the prompts, get your bot token
//   3. Start a chat with your bot (or add it to a group)
//   4. Get your chat ID: https://api.telegram.org/bot<TOKEN>/getUpdates
//      (send a message first, then the chat ID appears in the response)
//   5. Paste bot token + chat ID in InferLane dashboard settings
// ---------------------------------------------------------------------------

async function deliverTelegram(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.telegramBotToken || !alert.telegramChatId) {
    console.warn('[AlertDelivery] Missing telegramBotToken or telegramChatId');
    return false;
  }

  const severityEmoji = alert.severity === 'critical' ? '🚨' : '⚠️';
  const APP_URL = process.env.APP_URL || 'https://inferlane.dev';

  // Telegram Bot API sendMessage with MarkdownV2 formatting.
  // We use HTML parse mode because it's more forgiving with special chars.
  const text = [
    `${severityEmoji} <b>InferLane ${alert.severity.toUpperCase()} Alert</b>`,
    '',
    `<b>Type:</b> ${escapeHtml(alert.type.replace(/_/g, ' '))}`,
    `<b>Provider:</b> ${escapeHtml(alert.provider)}`,
    '',
    escapeHtml(alert.message),
    '',
    `<a href="${APP_URL}/dashboard">View Dashboard</a>`,
  ].join('\n');

  try {
    const url = `https://api.telegram.org/bot${alert.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: alert.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[AlertDelivery] Telegram API error ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.ok;
  } catch (err) {
    console.error('[AlertDelivery] Telegram delivery failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// DISCORD (webhook with rich embed)
// ---------------------------------------------------------------------------

async function deliverDiscord(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.discordWebhookUrl) {
    console.warn('[AlertDelivery] No discordWebhookUrl for DISCORD channel');
    return false;
  }

  const APP_URL = process.env.APP_URL || 'https://inferlane.dev';
  const color = alert.severity === 'critical' ? 0xef4444 : 0xf59e0b;

  try {
    const res = await fetch(alert.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'InferLane',
        embeds: [
          {
            title: `${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.type.replace(/_/g, ' ')}`,
            description: alert.message,
            color,
            fields: [
              { name: 'Provider', value: alert.provider, inline: true },
              { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
            ],
            footer: { text: 'InferLane Alert System' },
            timestamp: new Date().toISOString(),
            url: `${APP_URL}/dashboard`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[AlertDelivery] Discord webhook error ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.ok;
  } catch (err) {
    console.error('[AlertDelivery] Discord delivery failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// GENERIC WEBHOOK
// ---------------------------------------------------------------------------

async function deliverWebhook(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.webhookUrl) {
    console.warn('[AlertDelivery] No webhookUrl for WEBHOOK channel');
    return false;
  }

  try {
    const res = await fetch(alert.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: alert.type,
        provider: alert.provider,
        message: alert.message,
        severity: alert.severity,
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[AlertDelivery] Webhook delivery failed:', err);
    return false;
  }
}
