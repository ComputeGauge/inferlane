import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSavingsSummary,
  getLeaderboard,
  type SavingsPeriod,
} from '@/lib/billing/savings-ledger';

const VALID_PERIODS: SavingsPeriod[] = ['today', '7d', '30d', 'all'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const periodParam = req.nextUrl.searchParams.get('period') || '30d';
  const period: SavingsPeriod = VALID_PERIODS.includes(periodParam as SavingsPeriod)
    ? (periodParam as SavingsPeriod)
    : '30d';

  const includeLeaderboard = req.nextUrl.searchParams.get('leaderboard') === 'true';

  try {
    const summary = await getSavingsSummary(userId, period);

    const response: Record<string, unknown> = { summary };

    if (includeLeaderboard) {
      const leaderboard = await getLeaderboard(userId, period);
      response.leaderboard = leaderboard;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Savings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch savings data' },
      { status: 500 },
    );
  }
}
