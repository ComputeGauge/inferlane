import { prisma } from '@/lib/db';

export type AlertSeverity = 'warning' | 'critical';

export interface AnomalyAlert {
  type: 'SPEND_SPIKE' | 'COST_ANOMALY';
  provider: string;
  message: string;
  severity: AlertSeverity;
  currentValue: number;
}

/**
 * Detect spend anomalies for a user by analysing the last 30 days of daily
 * SpendSnapshot data. Returns an array of anomaly alerts.
 *
 * Detection rules:
 *  1. SPEND_SPIKE — today's spend exceeds the rolling 7-day mean + 2*stddev
 *  2. COST_ANOMALY — a model appears today that wasn't used in the prior 7 days
 */
export async function detectAnomalies(userId: string): Promise<AnomalyAlert[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Format dates as YYYY-MM-DD for period comparison
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  const snapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId,
      periodType: 'DAILY',
      period: { gte: formatDate(thirtyDaysAgo) },
    },
    include: { providerConnection: true },
    orderBy: { period: 'asc' },
  });

  if (snapshots.length === 0) return [];

  const anomalies: AnomalyAlert[] = [];
  const today = formatDate(now);

  // Group snapshots by provider connection
  const byProvider = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const key = snap.providerConnectionId;
    if (!byProvider.has(key)) byProvider.set(key, []);
    byProvider.get(key)!.push(snap);
  }

  for (const [_connId, providerSnaps] of byProvider) {
    const providerName =
      providerSnaps[0]?.providerConnection?.displayName ??
      providerSnaps[0]?.providerConnection?.provider ??
      'Unknown';

    // Build daily spend array sorted by period
    const dailySpends = providerSnaps.map((s) => ({
      period: s.period,
      spend: Number(s.totalSpend),
      breakdown: s.modelBreakdown as Record<string, { spend?: number; tokens?: number }> | null,
    }));

    const todayEntry = dailySpends.find((d) => d.period === today);
    if (!todayEntry) continue;

    // ---- Rule 1: Spend spike (rolling 7-day mean + 2*stddev) ----
    const prior7 = dailySpends
      .filter((d) => d.period < today)
      .slice(-7)
      .map((d) => d.spend);

    if (prior7.length >= 3) {
      const mean = prior7.reduce((a, b) => a + b, 0) / prior7.length;
      const variance =
        prior7.reduce((sum, v) => sum + (v - mean) ** 2, 0) / prior7.length;
      const stddev = Math.sqrt(variance);
      const threshold = mean + 2 * stddev;

      if (todayEntry.spend > threshold && todayEntry.spend > 0) {
        const pctOver = ((todayEntry.spend - mean) / mean) * 100;
        const severity: AlertSeverity = pctOver > 200 ? 'critical' : 'warning';

        anomalies.push({
          type: 'SPEND_SPIKE',
          provider: providerName,
          message: `Spend spike detected for ${providerName}: $${todayEntry.spend.toFixed(2)} today vs $${mean.toFixed(2)} 7-day average (+${pctOver.toFixed(0)}%)`,
          severity,
          currentValue: todayEntry.spend,
        });
      }
    }

    // ---- Rule 2: New model alert ----
    if (todayEntry.breakdown && typeof todayEntry.breakdown === 'object') {
      const todayModels = new Set(Object.keys(todayEntry.breakdown));

      // Collect models seen in the prior 7 days
      const recentModels = new Set<string>();
      const recent7 = dailySpends.filter((d) => d.period < today).slice(-7);
      for (const day of recent7) {
        if (day.breakdown && typeof day.breakdown === 'object') {
          for (const model of Object.keys(day.breakdown)) {
            recentModels.add(model);
          }
        }
      }

      for (const model of todayModels) {
        if (!recentModels.has(model)) {
          anomalies.push({
            type: 'COST_ANOMALY',
            provider: providerName,
            message: `New model detected for ${providerName}: "${model}" was not used in the prior 7 days`,
            severity: 'warning',
            currentValue: todayEntry.spend,
          });
        }
      }
    }
  }

  return anomalies;
}
