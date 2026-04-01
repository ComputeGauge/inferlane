import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { PROVIDER_REGISTRY } from '@/lib/providers/registry';

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, source } = body;
  if (!provider || typeof provider !== 'string') {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const validSources = ['router', 'dashboard', 'recommendation', 'marketplace'];
  const clickSource = validSources.includes(source) ? source : 'dashboard';

  // Look up provider for affiliate/signup URL
  const entry = PROVIDER_REGISTRY[provider.toUpperCase()];
  const redirectUrl = entry?.affiliateUrl || entry?.signupUrl || '#';

  await prisma.affiliateClick.create({
    data: {
      userId: session?.user?.id || null,
      provider: provider.toUpperCase(),
      source: clickSource,
      destination: redirectUrl,
    },
  });

  return NextResponse.json({ redirectUrl });
}

export const POST = withTiming(handlePOST);
