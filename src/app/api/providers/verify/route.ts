import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { complianceCheck } from '@/lib/compliance/middleware';

// ---------------------------------------------------------------------------
// Key verification — makes a minimal API call per provider to confirm validity
// ---------------------------------------------------------------------------

async function verifyKey(
  provider: string,
  apiKey: string,
  metadata?: { region?: string; endpointUrl?: string; resourceName?: string; deploymentId?: string; apiVersion?: string },
): Promise<{ valid: boolean; error?: string; model?: string }> {
  try {
    switch (provider) {
      case 'ANTHROPIC': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        if (res.status === 401) return { valid: false, error: 'Invalid API key' };
        if (res.status === 400 || res.status === 200) return { valid: true, model: 'claude-sonnet-4-20250514' };
        if (res.status === 429) return { valid: true, error: 'Key valid but rate limited or no credits' };
        // 404 means model not found — key may still be valid, try listing models
        if (res.status === 404) return { valid: true, model: 'claude-sonnet-4-20250514', error: 'Key valid but model access may be limited' };
        return { valid: false, error: `Unexpected status: ${res.status}` };
      }

      case 'OPENAI': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'GOOGLE': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'GROQ': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'DEEPSEEK': {
        const res = await fetch('https://api.deepseek.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'XAI': {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'TOGETHER': {
        const res = await fetch('https://api.together.xyz/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'FIREWORKS': {
        const res = await fetch('https://api.fireworks.ai/inference/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'MISTRAL': {
        const res = await fetch('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'COHERE': {
        const res = await fetch('https://api.cohere.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'PERPLEXITY': {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
        });
        if (res.status === 401) return { valid: false, error: 'Invalid API key' };
        return { valid: true };
      }

      case 'CEREBRAS': {
        const res = await fetch('https://api.cerebras.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'SAMBANOVA': {
        const res = await fetch('https://api.sambanova.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'REPLICATE': {
        const res = await fetch('https://api.replicate.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid API key' };
      }

      case 'AZURE_OPENAI': {
        const resourceName = metadata?.resourceName || 'default';
        const apiVersion = metadata?.apiVersion || '2024-10-21';
        const res = await fetch(
          `https://${resourceName}.openai.azure.com/openai/models?api-version=${apiVersion}`,
          { headers: { 'api-key': apiKey } },
        );
        return res.status === 200 ? { valid: true } : { valid: false, error: 'Invalid key or resource name' };
      }

      case 'AWS_BEDROCK': {
        // Bedrock uses IAM credentials or API Gateway keys — direct verification is complex.
        // If user provides a custom endpoint, try a GET against it.
        if (metadata?.endpointUrl) {
          try {
            const res = await fetch(`${metadata.endpointUrl}/models`, {
              headers: { 'x-api-key': apiKey },
            });
            if (res.status === 200) return { valid: true };
            if (res.status === 401 || res.status === 403) return { valid: false, error: 'Invalid API key or endpoint' };
          } catch {
            // Fall through to accept
          }
        }
        // Accept key — full IAM signature verification is not feasible from a simple API call
        return { valid: true, error: 'Key accepted (Bedrock IAM verification requires runtime test)' };
      }

      case 'MODAL':
      case 'LAMBDA':
      case 'COREWEAVE':
        // These providers lack a simple /models endpoint for verification
        return { valid: true, error: 'Key accepted (verification not available for this provider)' };

      default:
        return { valid: false, error: `Unknown provider: ${provider}` };
    }
  } catch {
    return { valid: false, error: 'Connection failed — check your network' };
  }
}

// ---------------------------------------------------------------------------
// POST /api/providers/verify
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Compliance check — block sanctioned regions from connecting providers
  const compliance = await complianceCheck(req, userId);
  if (!compliance.allowed) {
    return NextResponse.json(
      { error: 'Provider connections unavailable in your region', reason: compliance.reason },
      { status: 451 },
    );
  }

  // Global rate limit (all users combined)
  const { success: globalOk } = await rateLimit('verify:global', 100, 60 * 1000);
  if (!globalOk) {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // Rate limit: 10 verify requests per user per minute
  const { success: rateLimitOk } = await rateLimit(`verify:${userId}`, 10, 60 * 1000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: { provider?: string; apiKey?: string; metadata?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, apiKey, metadata } = body;

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 });
  }

  try {
    // 1. Verify the key with a real API call
    const result = await verifyKey(provider, apiKey, metadata);

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
    }

    // 2. Key is valid — encrypt and upsert the connection
    const encryptedApiKey = encrypt(apiKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providerEnum = provider as any;

    await prisma.providerConnection.upsert({
      where: { userId_provider: { userId, provider: providerEnum } },
      update: {
        encryptedApiKey,
        lastSyncStatus: 'SUCCESS' as any,
        isActive: true,
        ...(metadata && { metadata }),
      },
      create: {
        userId,
        provider: providerEnum,
        displayName: provider,
        encryptedApiKey,
        lastSyncStatus: 'SUCCESS' as any,
        ...(metadata && { metadata }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROVIDER_CONNECTED',
        resource: 'provider_connection',
        details: { provider, verified: true },
      },
    });

    return NextResponse.json({
      valid: true,
      provider,
      model: result.model,
      ...(result.error && { warning: result.error }),
    });
  } catch (error) {
    return handleApiError(error, 'VerifyProvider');
  }
}

export const POST = withTiming(handlePOST);
