import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { createHash } from 'crypto';

// Provider API base URLs
const PROVIDER_URLS: Record<string, string> = {
  ANTHROPIC: 'https://api.anthropic.com',
  OPENAI: 'https://api.openai.com',
  GOOGLE: 'https://generativelanguage.googleapis.com',
  TOGETHER: 'https://api.together.xyz',
  FIREWORKS: 'https://api.fireworks.ai',
  REPLICATE: 'https://api.replicate.com',
  GROQ: 'https://api.groq.com/openai',
  DEEPSEEK: 'https://api.deepseek.com',
};

// Authenticate via ComputeGauge API key (Bearer token)
async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer cg_')) {
    return null;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
  });

  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

// POST /api/proxy — forward requests to AI providers
export async function POST(req: NextRequest) {
  // Authenticate
  const apiKey = await authenticateRequest(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  // Rate limit: 100 requests per minute per API key
  const rl = rateLimit(`proxy:${apiKey.id}`, 100, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 }
    );
  }

  // Parse request
  let reqBody;
  try { reqBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { provider, path, body, model } = reqBody;
  if (!provider || !path) {
    return NextResponse.json({ error: 'provider and path are required' }, { status: 400 });
  }

  // Sanitize path — must start with / and not contain protocol or double dots
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('..') || path.includes('://')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const providerUpper = provider.toUpperCase();
  const baseUrl = PROVIDER_URLS[providerUpper];
  if (!baseUrl) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  // Get user's provider connection + decrypted API key
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId: apiKey.userId, provider: providerUpper } },
  });

  if (!connection || !connection.isActive) {
    return NextResponse.json(
      { error: `Provider ${provider} not connected. Connect it in your dashboard.` },
      { status: 400 }
    );
  }

  if (!connection.encryptedApiKey) {
    return NextResponse.json(
      { error: `Provider ${provider} has no API key stored.` },
      { status: 400 }
    );
  }

  const providerApiKey = decrypt(connection.encryptedApiKey);

  // Build provider-specific headers
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (providerUpper) {
    case 'ANTHROPIC':
      headers['x-api-key'] = providerApiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'OPENAI':
    case 'TOGETHER':
    case 'FIREWORKS':
    case 'GROQ':
    case 'DEEPSEEK':
      headers['Authorization'] = `Bearer ${providerApiKey}`;
      break;
    case 'GOOGLE':
      // Google uses API key as query param — handled in URL
      break;
  }

  // Build target URL
  let targetUrl = `${baseUrl}${path}`;
  if (providerUpper === 'GOOGLE') {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl += `${separator}key=${providerApiKey}`;
  }

  // Forward the request
  const startTime = Date.now();
  try {
    const providerRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const latencyMs = Date.now() - startTime;
    const responseData = await providerRes.json();

    // Log the proxy request for spend tracking
    const inputTokens = responseData?.usage?.input_tokens || responseData?.usage?.prompt_tokens || 0;
    const outputTokens = responseData?.usage?.output_tokens || responseData?.usage?.completion_tokens || 0;

    await prisma.proxyRequest.create({
      data: {
        apiKeyId: apiKey.id,
        requestModel: model || body?.model || 'unknown',
        routedProvider: providerUpper,
        routedModel: model || body?.model || 'unknown',
        routingReason: 'direct',
        inputTokens,
        outputTokens,
        costUsd: 0, // Calculated asynchronously by spend tracker
        latencyMs,
        statusCode: providerRes.status,
      },
    });

    return NextResponse.json(responseData, { status: providerRes.status });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    await prisma.proxyRequest.create({
      data: {
        apiKeyId: apiKey.id,
        requestModel: model || body?.model || 'unknown',
        routedProvider: providerUpper,
        routedModel: model || body?.model || 'unknown',
        routingReason: 'direct',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs,
        statusCode: 502,
      },
    });

    console.error(`[Proxy] ${providerUpper} error:`, error);
    return NextResponse.json(
      { error: `Failed to reach ${provider}` },
      { status: 502 }
    );
  }
}
