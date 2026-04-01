import { NextResponse } from 'next/server';
import { healthTracker } from '@/lib/proxy/health-tracker';

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    providers: healthTracker.getAllHealth(),
  });
}
