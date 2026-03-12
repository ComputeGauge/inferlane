import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeyRaw = authHeader.slice(7);
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKeyRaw).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey || !apiKey.isActive) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const userId = apiKey.user.id;

    // Get active alerts (budget-related)
    const alerts = await prisma.alert.findMany({
      where: {
        userId,
        isActive: true,
        type: { in: ['BUDGET_WARNING', 'BUDGET_EXCEEDED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get current month spend
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlySpend = await prisma.spendSnapshot.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { totalSpend: true },
    });

    const totalSpend = Number(monthlySpend._sum.totalSpend || 0);

    const lines: string[] = [];
    lines.push('# Budget Status');
    lines.push('');
    lines.push(`**Current Month Spend**: $${totalSpend.toFixed(2)}`);
    lines.push('');

    if (alerts.length > 0) {
      lines.push('## Active Alerts');
      for (const alert of alerts) {
        const icon = alert.type === 'BUDGET_EXCEEDED' ? '🔴' : '🟡';
        lines.push(`${icon} ${alert.message || `${alert.type}: $${Number(alert.currentValue || 0).toFixed(2)} / $${Number(alert.threshold).toFixed(2)}`}`);
      }
    } else {
      lines.push('✅ No budget alerts active.');
    }

    return NextResponse.json(lines.join('\n'));
  } catch (error) {
    console.error('[MCP Budget API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
