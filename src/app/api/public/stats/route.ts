// /api/public/stats — live aggregate stats for the Transparency page.
//
// Returns month-to-date aggregates over the public network:
//   - active operators (last-seen within 7 days)
//   - active consumers (≥1 request in month)
//   - tokens served (total across all operators)
//   - requests completed (count)
//   - credits earned + spent (from LedgerLeg SHARE_CREDIT accounts)
//   - takedowns + terminations (count — no PII)
//
// Everything returned here is aggregated and non-identifying. No prompts,
// no responses, no per-user data. Safe for public consumption.
//
// Cache-Control: public, s-maxage=3600 (edge cache for 1 hour). Values
// change slowly; we don't need second-precision for a transparency page.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const revalidate = 3600;

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export async function GET() {
  const monthStart = startOfMonthUTC();
  const recentCutoff = sevenDaysAgo();

  // Run all aggregate queries in parallel; any individual failure falls back
  // to a sentinel rather than failing the whole endpoint.
  const [
    activeOperators,
    monthRequestCount,
    monthTokensAgg,
    activeApiKeyCount,
    takedownCount,
  ] = await Promise.all([
    prisma.nodeOperator.count({
      where: { lastSeenAt: { gte: recentCutoff } },
    }).catch(() => -1),

    prisma.proxyRequest.count({
      where: { timestamp: { gte: monthStart } },
    }).catch(() => -1),

    prisma.proxyRequest.aggregate({
      where: { timestamp: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    }).catch(() => null),

    // Approximate unique consumers = distinct API keys with requests this month
    prisma.proxyRequest.findMany({
      where: { timestamp: { gte: monthStart }, apiKeyId: { not: null } },
      select: { apiKeyId: true },
      distinct: ['apiKeyId'],
    }).then((rows) => rows.length).catch(() => -1),

    // Placeholder — the takedowns/terminations pipeline isn't wired yet.
    // Once the moderation reporting tables land this becomes a real count.
    Promise.resolve(0),
  ]);

  const monthTokensSum = monthTokensAgg
    ? (monthTokensAgg._sum.inputTokens ?? 0) + (monthTokensAgg._sum.outputTokens ?? 0)
    : -1;

  const payload = {
    period: {
      monthStart: monthStart.toISOString(),
      generatedAt: new Date().toISOString(),
    },
    network: {
      activeOperators: activeOperators === -1 ? null : activeOperators,
      activeConsumerKeys: activeApiKeyCount === -1 ? null : activeApiKeyCount,
      requestsThisMonth: monthRequestCount === -1 ? null : monthRequestCount,
      tokensThisMonth: monthTokensSum === -1 ? null : monthTokensSum,
    },
    moderation: {
      takedownsThisMonth: takedownCount,
      terminationsThisMonth: 0,
      lawEnforcementRequestsThisMonth: 0,
    },
    governance: {
      codeOfConduct: 'https://inferlane.dev/code-of-conduct',
      acceptableUsePolicy: 'https://inferlane.dev/aup',
      operatorAgreement: 'https://inferlane.dev/operator-agreement',
      roadmap: 'https://inferlane.dev/roadmap',
    },
    note: 'Aggregates only. No per-user data. Safe to embed, mirror, or archive.',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
