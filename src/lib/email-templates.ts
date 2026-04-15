// ---------------------------------------------------------------------------
// Branded Email Templates (Stream Y4)
// ---------------------------------------------------------------------------
// All templates follow the same dark-theme design as the existing digest
// and welcome emails. 600px max-width, #0a0a0f background, amber/orange CTAs.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://inferlane.dev';

// ── Shared Layout ────────────────────────────────────────────────────────

function wrapTemplate(title: string, bodyContent: string): string {
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    `<title>${title}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">',
    '<div style="max-width:600px;margin:0 auto;padding:40px 20px;">',
    // Header
    '<div style="text-align:center;margin-bottom:32px;">',
    '<div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#f97316);text-align:center;line-height:40px;font-size:20px;color:#000;">⚡</div>',
    '<h1 style="color:#fff;font-size:20px;margin:12px 0 0;">InferLane</h1>',
    '</div>',
    // Content card
    '<div style="background:#12121a;border:1px solid #1e1e2e;border-radius:16px;padding:32px;">',
    bodyContent,
    '</div>',
    // Footer
    '<div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #1e1e2e;">',
    '<p style="color:#6b7280;font-size:12px;margin:0;">',
    `<a href="${BASE_URL}/dashboard/settings" style="color:#6b7280;text-decoration:underline;">Manage email preferences</a>`,
    '</p>',
    '<p style="color:#4b5563;font-size:11px;margin:8px 0 0;">InferLane &mdash; Compute Infrastructure Intelligence</p>',
    '</div>',
    '</div>',
    '</body></html>',
  ].join('');
}

function ctaButton(text: string, href: string): string {
  return [
    '<div style="text-align:center;margin:24px 0 8px;">',
    `<a href="${href}" style="display:inline-block;padding:12px 28px;background:linear-gradient(90deg,#f59e0b,#f97316);color:#000;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">${text}</a>`,
    '</div>',
  ].join('');
}

// ── Template Builders ────────────────────────────────────────────────────

/**
 * Subscription upgrade confirmation
 */
export function buildSubscriptionUpgradeHtml(userName: string, tier: string): string {
  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  return wrapTemplate(
    `Upgraded to ${tierDisplay}`,
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Welcome to ${tierDisplay}, ${userName}!</h2>`,
      '<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 16px;">',
      `Your subscription has been upgraded to the <strong style="color:#f59e0b;">${tierDisplay}</strong> plan. All new features are now unlocked.`,
      '</p>',
      '<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0;">',
      'Head to your dashboard to explore what\'s new.',
      '</p>',
      ctaButton('Open Dashboard', `${BASE_URL}/dashboard`),
    ].join(''),
  );
}

/**
 * Node operator payout confirmation
 */
export function buildPayoutConfirmationHtml(
  operatorName: string,
  amount: number,
  requestCount: number,
): string {
  const formattedAmount = amount.toFixed(2);
  return wrapTemplate(
    `Payout Sent: $${formattedAmount}`,
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Payout Sent</h2>`,
      `<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">Hey ${operatorName}, your earnings have been sent.</p>`,
      '<div style="background:#0a0a0f;border-radius:12px;padding:20px;margin:0 0 16px;">',
      '<table style="width:100%;border-collapse:collapse;">',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Amount</td>',
      `<td style="color:#10b981;font-size:18px;font-weight:700;text-align:right;padding:6px 0;">$${formattedAmount}</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Requests served</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">${requestCount.toLocaleString()}</td>`,
      '</tr>',
      '</table>',
      '</div>',
      '<p style="color:#6b7280;font-size:12px;margin:0;">Funds are sent via Stripe Connect and typically arrive within 2 business days.</p>',
      ctaButton('View Earnings', `${BASE_URL}/dashboard/nodes`),
    ].join(''),
  );
}

/**
 * Trading order fill notification
 */
export function buildOrderFillHtml(
  userName: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  pricePerUnit: number,
  tier: string,
): string {
  const totalUsd = (quantity * pricePerUnit).toFixed(2);
  const sideLabel = side === 'BUY' ? 'Buy' : 'Sell';
  const sideColor = side === 'BUY' ? '#10b981' : '#ef4444';

  return wrapTemplate(
    `Order Filled: ${sideLabel} ${quantity} credits`,
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Order Filled</h2>`,
      `<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">Your trading order has been filled, ${userName}.</p>`,
      '<div style="background:#0a0a0f;border-radius:12px;padding:20px;margin:0 0 16px;">',
      '<table style="width:100%;border-collapse:collapse;">',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Side</td>',
      `<td style="color:${sideColor};font-size:14px;font-weight:700;text-align:right;padding:6px 0;">${sideLabel.toUpperCase()}</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Tier</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">${tier}</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Quantity</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">${quantity.toLocaleString()} credits</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Price</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">$${pricePerUnit.toFixed(4)}/credit</td>`,
      '</tr>',
      '<tr style="border-top:1px solid #1e1e2e;">',
      '<td style="color:#6b7280;font-size:13px;padding:10px 0 6px;">Total</td>',
      `<td style="color:#f59e0b;font-size:16px;font-weight:700;text-align:right;padding:10px 0 6px;">$${totalUsd}</td>`,
      '</tr>',
      '</table>',
      '</div>',
      ctaButton('View Trading', `${BASE_URL}/dashboard/trading`),
    ].join(''),
  );
}

/**
 * Futures contract matched notification
 */
export function buildFutureMatchedHtml(
  userName: string,
  contractType: string,
  quantity: number,
  strikePrice: number,
  deliveryDate: string,
): string {
  return wrapTemplate(
    'Futures Contract Matched',
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Contract Matched</h2>`,
      `<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">Your futures contract has been matched with a counterparty, ${userName}.</p>`,
      '<div style="background:#0a0a0f;border-radius:12px;padding:20px;margin:0 0 16px;">',
      '<table style="width:100%;border-collapse:collapse;">',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Type</td>',
      `<td style="color:#8b5cf6;font-size:14px;font-weight:600;text-align:right;padding:6px 0;">${contractType.replace(/_/g, ' ')}</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Quantity</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">${quantity.toLocaleString()} credits</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Strike Price</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">$${strikePrice.toFixed(4)}/credit</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:6px 0;">Delivery Date</td>',
      `<td style="color:#fff;font-size:14px;text-align:right;padding:6px 0;">${deliveryDate}</td>`,
      '</tr>',
      '</table>',
      '</div>',
      '<p style="color:#6b7280;font-size:12px;margin:0;">The contract will settle automatically on the delivery date against the CG price index.</p>',
      ctaButton('View Contracts', `${BASE_URL}/dashboard/trading`),
    ].join(''),
  );
}

/**
 * Futures contract settled notification
 */
export function buildFutureSettledHtml(
  userName: string,
  contractType: string,
  pnlUsd: number,
  settlementPrice: number,
  strikePrice: number,
): string {
  const isProfitable = pnlUsd >= 0;
  const pnlColor = isProfitable ? '#10b981' : '#ef4444';
  const pnlSign = isProfitable ? '+' : '';

  return wrapTemplate(
    `Contract Settled: ${pnlSign}$${pnlUsd.toFixed(2)}`,
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Contract Settled</h2>`,
      `<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">Your ${contractType.replace(/_/g, ' ').toLowerCase()} contract has settled, ${userName}.</p>`,
      '<div style="background:#0a0a0f;border-radius:12px;padding:20px;text-align:center;margin:0 0 16px;">',
      `<p style="color:${pnlColor};font-size:32px;font-weight:700;margin:0;">${pnlSign}$${Math.abs(pnlUsd).toFixed(2)}</p>`,
      `<p style="color:#6b7280;font-size:13px;margin:8px 0 0;">${isProfitable ? 'Profit' : 'Loss'}</p>`,
      '</div>',
      '<div style="background:#0a0a0f;border-radius:12px;padding:16px;margin:0 0 16px;">',
      '<table style="width:100%;border-collapse:collapse;">',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:4px 0;">Strike</td>',
      `<td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">$${strikePrice.toFixed(4)}</td>`,
      '</tr>',
      '<tr>',
      '<td style="color:#6b7280;font-size:13px;padding:4px 0;">Settlement</td>',
      `<td style="color:#fff;font-size:13px;text-align:right;padding:4px 0;">$${settlementPrice.toFixed(4)}</td>`,
      '</tr>',
      '</table>',
      '</div>',
      ctaButton('View Trading', `${BASE_URL}/dashboard/trading`),
    ].join(''),
  );
}

/**
 * Account deletion confirmation
 */
export function buildAccountDeletedHtml(userName: string): string {
  return wrapTemplate(
    'Account Deleted',
    [
      `<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Account Deleted</h2>`,
      `<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 16px;">Hey ${userName}, your InferLane account has been deleted as requested.</p>`,
      '<p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 16px;">',
      'Your data has been anonymized and any active subscriptions have been cancelled.',
      '</p>',
      '<p style="color:#6b7280;font-size:12px;margin:16px 0 0;">',
      'If this was a mistake, contact support within 30 days to recover your account.',
      '</p>',
    ].join(''),
  );
}
