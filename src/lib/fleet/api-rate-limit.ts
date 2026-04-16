// Shared rate-limit helper for the Fleet API.
//
// Each Fleet route has its own bucket sized to its expected workload — the
// hot-path /events endpoint gets the largest budget, dashboard reads are next,
// and admin-style mutations get the smallest. Buckets are keyed by API key id
// when available (per-key isolation) and fall back to user id otherwise, so
// one runaway client can't starve other clients on the same account.

import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export type FleetRouteName =
  | 'sessions_create'
  | 'sessions_list'
  | 'session_read'
  | 'session_update'
  | 'session_events'
  | 'fleet_summary';

interface BudgetSpec {
  limit: number;
  windowMs: number;
}

// Per-route budgets. Numbers picked to:
//   - Allow a normal long-running agent to comfortably exceed any single
//     burst (events at 5/sec sustained = 300/min ✓)
//   - Cap the worst-case "infinite loop" client at a level that protects
//     Neon connections without being trivially exhausted
//   - Give read-heavy dashboard polling enough headroom (Pro tier polling
//     a fleet view every second sustained = 60/min, well under 600/min)
const BUDGETS: Record<FleetRouteName, BudgetSpec> = {
  sessions_create: { limit: 100, windowMs: 60_000 },   // session start is rare
  sessions_list:   { limit: 600, windowMs: 60_000 },   // dashboard polling
  session_read:    { limit: 600, windowMs: 60_000 },   // dashboard polling
  session_update:  { limit: 200, windowMs: 60_000 },   // status PATCH on transitions
  session_events:  { limit: 300, windowMs: 60_000 },   // hot path — same as before
  fleet_summary:   { limit: 120, windowMs: 60_000 },   // heavy DB query
};

export interface AuthShape {
  userId: string;
  apiKeyId?: string;
}

/**
 * Run the rate limiter for a given Fleet route. Returns `null` if the request
 * is allowed (caller should proceed) or a 429 NextResponse if the request is
 * blocked (caller should return it directly).
 *
 * Usage:
 *   const limited = await checkFleetRateLimit('sessions_create', auth);
 *   if (limited) return limited;
 */
export async function checkFleetRateLimit(
  route: FleetRouteName,
  auth: AuthShape,
): Promise<NextResponse | null> {
  const budget = BUDGETS[route];
  const key = `fleet:${route}:${auth.apiKeyId ?? auth.userId}`;
  const result = await rateLimit(key, budget.limit, budget.windowMs);

  if (result.success) return null;

  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      route,
      limit: budget.limit,
      windowSeconds: Math.round(budget.windowMs / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.round(budget.windowMs / 1000)),
        'X-RateLimit-Limit': String(budget.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  );
}
