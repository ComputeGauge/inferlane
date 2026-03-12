import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/mcp/spend-summary
// Called by the MCP server to get real spend data from the dashboard
export async function POST(req: NextRequest) {
  try {
    // Authenticate via API key
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeyRaw = authHeader.slice(7);
    // Hash the key and look it up
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKeyRaw).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { include: { providerConnections: true, subscription: true } } },
    });

    if (!apiKey || !apiKey.isActive) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    const { period, provider } = await req.json();
    const userId = apiKey.user.id;

    // Determine date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Query spend snapshots
    const snapshots = await prisma.spendSnapshot.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
        ...(provider ? {
          providerConnection: {
            provider: provider.toUpperCase().replace('-', '_'),
          },
        } : {}),
      },
      include: {
        providerConnection: {
          select: { provider: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by provider
    const byProvider: Record<string, { spend: number; tokens: number; requests: number }> = {};
    let totalSpend = 0;

    for (const snap of snapshots) {
      const prov = snap.providerConnection.displayName || snap.providerConnection.provider;
      if (!byProvider[prov]) {
        byProvider[prov] = { spend: 0, tokens: 0, requests: 0 };
      }
      const spend = Number(snap.totalSpend);
      byProvider[prov].spend += spend;
      byProvider[prov].tokens += Number(snap.tokenCount || 0);
      byProvider[prov].requests += snap.requestCount || 0;
      totalSpend += spend;
    }

    // Build response
    const lines: string[] = [];
    lines.push(`# AI Compute Spend Summary (${period})`);
    lines.push('');
    lines.push(`**Total Spend**: $${totalSpend.toFixed(2)}`);
    lines.push('');

    if (Object.keys(byProvider).length > 0) {
      lines.push('## By Provider');
      lines.push('| Provider | Spend | % of Total |');
      lines.push('|----------|-------|-----------|');
      for (const [prov, data] of Object.entries(byProvider).sort((a, b) => b[1].spend - a[1].spend)) {
        const pct = totalSpend > 0 ? ((data.spend / totalSpend) * 100).toFixed(1) : '0';
        lines.push(`| ${prov} | $${data.spend.toFixed(2)} | ${pct}% |`);
      }
    } else {
      lines.push('_No spend data found for this period. Connect provider API keys in the dashboard._');
    }

    return NextResponse.json(lines.join('\n'));
  } catch (error) {
    console.error('[MCP API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
