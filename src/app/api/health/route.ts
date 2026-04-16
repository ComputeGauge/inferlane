import { NextResponse } from 'next/server';

// GET /api/health — Simple health check
// No auth. Returns provider count + status.
// Designed to be as minimal as Darkbloom's /health endpoint.

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      providers: 23,
      models: 80,
      exchange: 'live',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
      },
    },
  );
}
