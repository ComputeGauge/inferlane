import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// GET /api/invoices/pdf?month=2026-02
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const userName = session.user.name || 'InferLane User';
  const userEmail = session.user.email || '';
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month parameter required in YYYY-MM format' }, { status: 400 });
  }

  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1);

  const snapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId,
      createdAt: { gte: startDate, lt: endDate },
    },
    include: {
      providerConnection: {
        select: { provider: true, displayName: true },
      },
    },
  });

  // Aggregate by provider
  const providerMap: Record<string, { provider: string; displayName: string; spend: number; tokenCount: number; requestCount: number }> = {};
  let totalSpend = 0;

  for (const snap of snapshots) {
    const prov = snap.providerConnection.provider;
    if (!providerMap[prov]) {
      providerMap[prov] = {
        provider: prov,
        displayName: snap.providerConnection.displayName || prov,
        spend: 0,
        tokenCount: 0,
        requestCount: 0,
      };
    }
    const spend = Number(snap.totalSpend);
    providerMap[prov].spend += spend;
    providerMap[prov].tokenCount += Number(snap.tokenCount || 0);
    providerMap[prov].requestCount += (snap.requestCount || 0);
    totalSpend += spend;
  }

  const byProvider = Object.values(providerMap).sort((a, b) => b.spend - a.spend);
  const monthLabel = new Date(year, mon - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const providerRows = byProvider
    .map(
      (p) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${p.displayName}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${p.spend.toFixed(4)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">${p.tokenCount.toLocaleString()}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">${p.requestCount.toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InferLane Invoice - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #f59e0b; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 18px; }
    .logo-text { font-size: 22px; font-weight: 700; color: #111827; }
    .invoice-label { text-align: right; }
    .invoice-label h2 { font-size: 28px; color: #111827; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-label p { color: #6b7280; margin-top: 4px; }
    .details { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .details-section h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .details-section p { color: #374151; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    thead th:not(:first-child) { text-align: right; }
    .total-row td { font-weight: 700; border-top: 2px solid #111827; border-bottom: none; padding: 16px; }
    .footer { text-align: center; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">&#9889;</div>
      <span class="logo-text">InferLane</span>
    </div>
    <div class="invoice-label">
      <h2>Invoice</h2>
      <p>${monthLabel}</p>
    </div>
  </div>

  <div class="details">
    <div class="details-section">
      <h4>Billed To</h4>
      <p><strong>${userName}</strong></p>
      <p>${userEmail}</p>
    </div>
    <div class="details-section" style="text-align: right;">
      <h4>Invoice Details</h4>
      <p>Period: ${monthLabel}</p>
      <p>Generated: ${generatedAt}</p>
      <p>Currency: USD</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Provider</th>
        <th>Spend (USD)</th>
        <th>Tokens</th>
        <th>Requests</th>
      </tr>
    </thead>
    <tbody>
      ${providerRows}
      <tr class="total-row">
        <td style="padding: 16px;">TOTAL</td>
        <td style="padding: 16px; text-align: right;">$${totalSpend.toFixed(4)}</td>
        <td style="padding: 16px; text-align: right;">${byProvider.reduce((s, p) => s + p.tokenCount, 0).toLocaleString()}</td>
        <td style="padding: 16px; text-align: right;">${byProvider.reduce((s, p) => s + p.requestCount, 0).toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>InferLane &mdash; AI Compute Cost Management</p>
    <p>This invoice was automatically generated. For questions, contact support@inferlane.ai</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="inferlane-invoice-${month}.html"`,
    },
  });
}

export const GET = withTiming(handleGET);
