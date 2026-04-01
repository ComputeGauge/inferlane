import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTiming } from '@/lib/api-timing';
import { generateRecommendations } from '@/lib/recommendations/engine';

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recommendations = await generateRecommendations(session.user.id);
  return NextResponse.json(recommendations);
}

export const GET = withTiming(handleGET);
