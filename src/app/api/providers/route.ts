import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

const VALID_PROVIDERS = [
  'ANTHROPIC', 'OPENAI', 'GOOGLE', 'AWS_BEDROCK', 'AZURE_OPENAI',
  'TOGETHER', 'GROQ', 'MISTRAL', 'COHERE', 'REPLICATE', 'DEEPSEEK',
  'XAI', 'PERPLEXITY', 'CEREBRAS', 'SAMBANOVA', 'FIREWORKS',
  'MODAL', 'LAMBDA', 'COREWEAVE', 'ON_PREM',
] as const;

// GET /api/providers — list connected providers
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const connections = await prisma.providerConnection.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      displayName: true,
      isActive: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      syncError: true,
      createdAt: true,
      // Never return encryptedApiKey
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(connections);
}

// POST /api/providers — connect a new provider
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { provider, apiKey, displayName, metadata } = body;

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 });
  }

  // Validate provider against allowed enum values
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` }, { status: 400 });
  }

  // Rate limit: 10 provider connections per user per hour
  const { success: rateLimitOk } = await rateLimit(`provider:${userId}`, 10, 60 * 60 * 1000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // Check if already connected
  const existing = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (existing) {
    return NextResponse.json({ error: 'Provider already connected. Use PUT to update.' }, { status: 409 });
  }

  // Encrypt the API key
  const encryptedApiKey = encrypt(apiKey);

  const connection = await prisma.providerConnection.create({
    data: {
      userId,
      provider,
      displayName: displayName || provider,
      encryptedApiKey,
      lastSyncStatus: 'PENDING',
      ...(metadata && { metadata }),
    },
    select: {
      id: true,
      provider: true,
      displayName: true,
      isActive: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROVIDER_CONNECTED',
      resource: 'provider_connection',
      details: { provider },
    },
  });

  return NextResponse.json(connection, { status: 201 });
}

// PUT /api/providers — update a provider connection (e.g., rotate API key)
async function handlePUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { provider, apiKey, displayName, isActive } = body;

  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (apiKey) updateData.encryptedApiKey = encrypt(apiKey);
  if (displayName !== undefined) updateData.displayName = displayName;
  if (isActive !== undefined) updateData.isActive = isActive;

  try {
    const connection = await prisma.providerConnection.update({
      where: { userId_provider: { userId, provider } },
      data: updateData,
      select: {
        id: true,
        provider: true,
        displayName: true,
        isActive: true,
        lastSyncAt: true,
      },
    });
    return NextResponse.json(connection);
  } catch {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }
}

// DELETE /api/providers — disconnect a provider
async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { provider } = body;

  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  try {
    await prisma.providerConnection.delete({
      where: { userId_provider: { userId, provider } },
    });
  } catch {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROVIDER_DISCONNECTED',
      resource: 'provider_connection',
      details: { provider },
    },
  });

  return NextResponse.json({ success: true });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const PUT = withTiming(handlePUT);
export const DELETE = withTiming(handleDELETE);
