// GET /api/fleet/summary  — aggregated fleet dashboard data
//
// Query params:
//   fleetId  — optional, scope to a specific fleet
//   period   — "day" | "week" | "month" | "all" (default "week")

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { checkFleetRateLimit } from '@/lib/fleet/api-rate-limit';
import { summarizeFleet } from '@/lib/fleet/session-aggregator';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await checkFleetRateLimit('fleet_summary', auth);
  if (limited) return limited;

  const url = new URL(req.url);
  const fleetId = url.searchParams.get('fleetId') ?? undefined;
  const period = url.searchParams.get('period') ?? 'week';

  const since = (() => {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all':
        return undefined;
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  })();

  const summary = await summarizeFleet({
    userId: auth.userId,
    fleetId,
    since,
  });

  return NextResponse.json({ period, fleetId: fleetId ?? null, summary });
}
