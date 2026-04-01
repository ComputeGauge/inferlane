import { sendEmail } from '@/lib/email';

export type AlertChannel = 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'IN_APP';

export interface DeliverableAlert {
  type: string;
  provider: string;
  message: string;
  severity: 'warning' | 'critical';
  /** Email address for EMAIL channel */
  recipientEmail?: string;
  /** Slack incoming webhook URL */
  slackWebhookUrl?: string;
  /** Generic webhook URL */
  webhookUrl?: string;
}

/**
 * Deliver an alert through the specified channel.
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
    case 'WEBHOOK':
      return deliverWebhook(alert);
    case 'IN_APP':
      // Already visible in the dashboard — no external delivery needed
      return true;
    default:
      console.warn(`[AlertDelivery] Unknown channel: ${channel}`);
      return false;
  }
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
  const APP_URL = process.env.APP_URL || 'https://inferlane.ai';

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
// SLACK
// ---------------------------------------------------------------------------

async function deliverSlack(alert: DeliverableAlert): Promise<boolean> {
  if (!alert.slackWebhookUrl) {
    console.warn('[AlertDelivery] No slackWebhookUrl for SLACK channel');
    return false;
  }

  try {
    const res = await fetch(alert.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: alert.message }),
    });
    return res.ok;
  } catch (err) {
    console.error('[AlertDelivery] Slack delivery failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// WEBHOOK
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
