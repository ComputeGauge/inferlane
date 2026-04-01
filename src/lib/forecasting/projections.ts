import { prisma } from '@/lib/db';

export interface ForecastResult {
  currentSpend: number;
  projectedMonthEnd: number;
  burnRate: number;
  daysRemaining: number;
  confidenceLow: number;
  confidenceHigh: number;
  trendDirection: 'up' | 'down' | 'flat';
  percentChange: number;
}

export interface ProviderForecast extends ForecastResult {
  provider: string;
  providerConnectionId: string;
}

export interface FullForecast {
  overall: ForecastResult;
  byProvider: ProviderForecast[];
}

/**
 * Calculate spend forecast for a user for the current month.
 *
 * Uses a weighted daily burn rate (recent days weighted more) and variance-based
 * confidence intervals.
 */
export async function calculateForecast(userId: string): Promise<FullForecast> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const dayOfMonth = now.getDate();

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  // Period prefix for current month: "YYYY-MM"
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Get daily snapshots for current month
  const snapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId,
      periodType: 'DAILY',
      period: { startsWith: monthPrefix },
    },
    include: { providerConnection: true },
    orderBy: { period: 'asc' },
  });

  // Also get last month's total for trend comparison
  const lastMonth = month === 0
    ? `${year - 1}-12`
    : `${year}-${String(month).padStart(2, '0')}`;

  const lastMonthSnapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId,
      periodType: 'DAILY',
      period: { startsWith: lastMonth },
    },
    select: { totalSpend: true },
  });

  const lastMonthTotal = lastMonthSnapshots.reduce(
    (sum, s) => sum + Number(s.totalSpend),
    0,
  );

  // Group by provider
  const byProvider = new Map<
    string,
    { name: string; connId: string; dailySpends: number[] }
  >();

  for (const snap of snapshots) {
    const connId = snap.providerConnectionId;
    if (!byProvider.has(connId)) {
      byProvider.set(connId, {
        name:
          snap.providerConnection?.displayName ??
          snap.providerConnection?.provider ??
          'Unknown',
        connId,
        dailySpends: [],
      });
    }
    byProvider.get(connId)!.dailySpends.push(Number(snap.totalSpend));
  }

  // Calculate overall daily spends (sum across providers per day)
  const dayMap = new Map<string, number>();
  for (const snap of snapshots) {
    const existing = dayMap.get(snap.period) ?? 0;
    dayMap.set(snap.period, existing + Number(snap.totalSpend));
  }
  const overallDailySpends = Array.from(dayMap.values());

  const overall = computeForecastFromDailySpends(
    overallDailySpends,
    daysRemaining,
    lastMonthTotal,
  );

  const providerForecasts: ProviderForecast[] = [];
  for (const [_connId, data] of byProvider) {
    const forecast = computeForecastFromDailySpends(
      data.dailySpends,
      daysRemaining,
      0, // No per-provider last-month comparison
    );
    providerForecasts.push({
      ...forecast,
      provider: data.name,
      providerConnectionId: data.connId,
    });
  }

  // Sort by projected spend descending
  providerForecasts.sort((a, b) => b.projectedMonthEnd - a.projectedMonthEnd);

  return { overall, byProvider: providerForecasts };
}

/**
 * Compute forecast from an array of daily spend values.
 *
 * Burn rate uses exponential weighting — more recent days have higher weight.
 */
function computeForecastFromDailySpends(
  dailySpends: number[],
  daysRemaining: number,
  lastMonthTotal: number,
): ForecastResult {
  const currentSpend = dailySpends.reduce((a, b) => a + b, 0);

  if (dailySpends.length === 0) {
    return {
      currentSpend: 0,
      projectedMonthEnd: 0,
      burnRate: 0,
      daysRemaining,
      confidenceLow: 0,
      confidenceHigh: 0,
      trendDirection: 'flat',
      percentChange: 0,
    };
  }

  // Weighted average burn rate — exponential decay weights
  // Most recent day gets the highest weight
  const alpha = 0.3; // decay factor
  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < dailySpends.length; i++) {
    const weight = Math.exp(alpha * (i - dailySpends.length + 1));
    weightedSum += dailySpends[i] * weight;
    weightTotal += weight;
  }

  const burnRate = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const projectedMonthEnd = currentSpend + burnRate * daysRemaining;

  // Variance for confidence interval
  const mean = currentSpend / dailySpends.length;
  const variance =
    dailySpends.length > 1
      ? dailySpends.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
        (dailySpends.length - 1)
      : 0;
  const stddev = Math.sqrt(variance);

  // 95% confidence interval: +/- 1.96 * stddev * sqrt(daysRemaining)
  const margin = 1.96 * stddev * Math.sqrt(Math.max(daysRemaining, 0));
  const confidenceLow = Math.max(0, projectedMonthEnd - margin);
  const confidenceHigh = projectedMonthEnd + margin;

  // Trend direction — compare current projection to last month
  let trendDirection: 'up' | 'down' | 'flat' = 'flat';
  let percentChange = 0;

  if (lastMonthTotal > 0) {
    percentChange =
      ((projectedMonthEnd - lastMonthTotal) / lastMonthTotal) * 100;

    if (percentChange > 5) trendDirection = 'up';
    else if (percentChange < -5) trendDirection = 'down';
    else trendDirection = 'flat';
  } else if (projectedMonthEnd > 0) {
    trendDirection = 'up';
    percentChange = 100;
  }

  return {
    currentSpend: Math.round(currentSpend * 100) / 100,
    projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
    burnRate: Math.round(burnRate * 100) / 100,
    daysRemaining,
    confidenceLow: Math.round(confidenceLow * 100) / 100,
    confidenceHigh: Math.round(confidenceHigh * 100) / 100,
    trendDirection,
    percentChange: Math.round(percentChange * 10) / 10,
  };
}
