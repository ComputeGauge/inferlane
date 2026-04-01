import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateForecast } from '@/lib/forecasting/projections';
import { withTiming } from '@/lib/api-timing';

/**
 * GET /api/forecast
 *
 * Returns spend forecast data for the authenticated user, including overall
 * projection and per-provider breakdown.
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    const forecast = await calculateForecast(userId);
    return NextResponse.json(forecast);
  } catch (err) {
    console.error('[Forecast] Error calculating forecast:', err);
    return NextResponse.json(
      { error: 'Failed to calculate forecast' },
      { status: 500 },
    );
  }
}

export const GET = withTiming(handleGET);
