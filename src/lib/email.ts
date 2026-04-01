/**
 * Email service for InferLane — weekly spend digests and alert notifications.
 *
 * Supports two transports:
 *   1. Resend (preferred) — set RESEND_API_KEY
 *   2. Nodemailer/SMTP fallback — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *
 * Without either configured, emails are logged to console (dev mode).
 */

interface DigestData {
  userName: string;
  period: string; // e.g. "Mar 3 – Mar 9, 2026"
  totalSpend: number;
  budget: number;
  topModels: { name: string; provider: string; spend: number; requests: number }[];
  alerts: { type: string; message: string; createdAt: string }[];
  savingsTip?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendWithResend(payload: EmailPayload): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'InferLane <noreply@inferlane.ai>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });
  return res.ok;
}

async function sendWithNodemailer(payload: EmailPayload): Promise<boolean> {
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'InferLane <noreply@inferlane.ai>',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
  return true;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY) {
      return await sendWithResend(payload);
    }
    if (process.env.SMTP_HOST) {
      return await sendWithNodemailer(payload);
    }
    // Dev fallback — log to console
    console.log(`[Email] To: ${payload.to} | Subject: ${payload.subject}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send:', err);
    return false;
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function budgetBarColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

export function buildDigestHtml(data: DigestData): string {
  const budgetPct = data.budget > 0 ? Math.min((data.totalSpend / data.budget) * 100, 100) : 0;
  const barColor = budgetBarColor(budgetPct);

  const modelRows = data.topModels
    .slice(0, 5)
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#e2e8f0;">${escapeHtml(m.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#94a3b8;">${escapeHtml(m.provider)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#e2e8f0;text-align:right;">${formatCurrency(m.spend)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#94a3b8;text-align:right;">${m.requests.toLocaleString()}</td>
      </tr>`
    )
    .join('');

  const alertRows = data.alerts
    .slice(0, 5)
    .map(
      (a) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#f59e0b;font-size:12px;">${escapeHtml(a.type.replace(/_/g, ' '))}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#e2e8f0;font-size:12px;">${escapeHtml(a.message)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:24px 32px;background:linear-gradient(135deg,#1e1e2e,#2d1b69);">
          <span style="font-size:24px;">⚡</span>
          <span style="color:#e2e8f0;font-size:20px;font-weight:700;margin-left:8px;">InferLane</span>
          <span style="color:#94a3b8;font-size:14px;float:right;line-height:32px;">Weekly Digest</span>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 32px 8px;">
          <p style="color:#e2e8f0;font-size:16px;margin:0;">Hi ${escapeHtml(data.userName)},</p>
          <p style="color:#94a3b8;font-size:14px;margin:8px 0 0;">Here's your AI spend summary for <strong style="color:#e2e8f0;">${data.period}</strong>.</p>
        </td></tr>

        <!-- Spend Summary -->
        <tr><td style="padding:16px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px;width:50%;">
                <p style="color:#94a3b8;font-size:12px;margin:0;text-transform:uppercase;">Total Spend</p>
                <p style="color:#e2e8f0;font-size:28px;font-weight:700;margin:4px 0 0;">${formatCurrency(data.totalSpend)}</p>
              </td>
              <td style="padding:16px 20px;width:50%;">
                <p style="color:#94a3b8;font-size:12px;margin:0;text-transform:uppercase;">Budget Used</p>
                <p style="color:${barColor};font-size:28px;font-weight:700;margin:4px 0 0;">${budgetPct.toFixed(0)}%</p>
              </td>
            </tr>
            <tr><td colspan="2" style="padding:0 20px 16px;">
              <div style="background:#0a0a0f;border-radius:4px;height:8px;overflow:hidden;">
                <div style="background:${barColor};height:8px;width:${budgetPct}%;border-radius:4px;"></div>
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Top Models -->
        ${data.topModels.length > 0 ? `
        <tr><td style="padding:8px 32px 4px;">
          <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0;">Top Models</p>
        </td></tr>
        <tr><td style="padding:0 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;overflow:hidden;">
            <tr style="background:#0f0f1a;">
              <th style="padding:8px 12px;color:#94a3b8;font-size:11px;text-align:left;text-transform:uppercase;">Model</th>
              <th style="padding:8px 12px;color:#94a3b8;font-size:11px;text-align:left;text-transform:uppercase;">Provider</th>
              <th style="padding:8px 12px;color:#94a3b8;font-size:11px;text-align:right;text-transform:uppercase;">Spend</th>
              <th style="padding:8px 12px;color:#94a3b8;font-size:11px;text-align:right;text-transform:uppercase;">Requests</th>
            </tr>
            ${modelRows}
          </table>
        </td></tr>` : ''}

        <!-- Alerts -->
        ${data.alerts.length > 0 ? `
        <tr><td style="padding:8px 32px 4px;">
          <p style="color:#f59e0b;font-size:14px;font-weight:600;margin:0;">⚠ Alerts This Week</p>
        </td></tr>
        <tr><td style="padding:0 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;overflow:hidden;">
            ${alertRows}
          </table>
        </td></tr>` : ''}

        <!-- Savings Tip -->
        ${data.savingsTip ? `
        <tr><td style="padding:8px 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a2e1a;border:1px solid #22c55e33;border-radius:8px;">
            <tr><td style="padding:12px 16px;">
              <p style="color:#22c55e;font-size:12px;font-weight:600;margin:0;">💡 SAVINGS TIP</p>
              <p style="color:#e2e8f0;font-size:13px;margin:6px 0 0;">${escapeHtml(data.savingsTip)}</p>
            </td></tr>
          </table>
        </td></tr>` : ''}

        <!-- CTA -->
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${process.env.APP_URL || 'https://inferlane.ai'}/dashboard"
             style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            View Dashboard
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#0f0f1a;border-top:1px solid #1e1e2e;">
          <p style="color:#64748b;font-size:11px;margin:0;text-align:center;">
            You're receiving this because you enabled weekly digests.
            <a href="${process.env.APP_URL || 'https://inferlane.ai'}/dashboard/settings" style="color:#7c3aed;text-decoration:none;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWeeklyDigest(
  to: string,
  data: DigestData
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `⚡ Your AI Spend: ${formatCurrency(data.totalSpend)} this week — InferLane`,
    html: buildDigestHtml(data),
  });
}

// ---------------------------------------------------------------------------
// Welcome Email
// ---------------------------------------------------------------------------

const APP_URL = process.env.APP_URL || 'https://inferlane.ai';

export function buildWelcomeHtml(data: { userName: string }): string {
  const name = escapeHtml(data.userName);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:24px 32px;background:linear-gradient(135deg,#1e1e2e,#2d1b69);">
          <span style="font-size:24px;">⚡</span>
          <span style="color:#e2e8f0;font-size:20px;font-weight:700;margin-left:8px;">InferLane</span>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="color:#e2e8f0;font-size:22px;font-weight:700;margin:0;">Welcome to InferLane, ${name}!</h1>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:12px 0 0;">
            You're all set to take control of your AI spending. Connect your providers,
            set budgets, and get real-time cost insights — all in one place.
          </p>
        </td></tr>

        <!-- Quick Start Steps -->
        <tr><td style="padding:24px 32px 8px;">
          <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0 0 12px;">Quick Start</p>

          <!-- Step 1 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;margin-bottom:10px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;font-size:13px;">
                <span style="color:#f59e0b;font-weight:700;">1.</span>
                <span style="color:#e2e8f0;font-weight:600;margin-left:6px;">Connect Your First Provider</span>
              </p>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0 18px;">
                Link your AI API key to start tracking spend.
              </p>
            </td></tr>
          </table>

          <!-- Step 2 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;margin-bottom:10px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;font-size:13px;">
                <span style="color:#f59e0b;font-weight:700;">2.</span>
                <span style="color:#e2e8f0;font-weight:600;margin-left:6px;">Set a Budget</span>
              </p>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0 18px;">
                Get alerts before you overshoot your monthly limit.
              </p>
            </td></tr>
          </table>

          <!-- Step 3 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;margin-bottom:10px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;font-size:13px;">
                <span style="color:#f59e0b;font-weight:700;">3.</span>
                <span style="color:#e2e8f0;font-weight:600;margin-left:6px;">Explore the Dashboard</span>
              </p>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0 18px;">
                See real-time spend, savings tips, and model comparisons.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:16px 32px 28px;">
          <a href="${APP_URL}/dashboard"
             style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Open Your Dashboard
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#0f0f1a;border-top:1px solid #1e1e2e;">
          <p style="color:#64748b;font-size:11px;margin:0;text-align:center;">
            You're receiving this because you signed up for InferLane.
            <a href="${APP_URL}/dashboard/settings" style="color:#7c3aed;text-decoration:none;">Email preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Welcome to InferLane \u2014 let\u2019s cut your AI costs",
    html: buildWelcomeHtml({ userName }),
  });
}
