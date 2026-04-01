import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { calculateCost, findModelPrice } from '@/lib/pricing/model-prices';
import bcrypt from 'bcryptjs';

// Valid provider names (case-insensitive matching)
const VALID_PROVIDERS = new Set([
  'ANTHROPIC', 'OPENAI', 'GOOGLE', 'AWS_BEDROCK', 'AZURE_OPENAI',
  'TOGETHER', 'GROQ', 'MISTRAL', 'COHERE', 'REPLICATE', 'DEEPSEEK',
  'XAI', 'PERPLEXITY', 'CEREBRAS', 'SAMBANOVA', 'FIREWORKS',
]);

// Aliases for common provider names
const PROVIDER_ALIASES: Record<string, string> = {
  'anthropic': 'ANTHROPIC',
  'claude': 'ANTHROPIC',
  'openai': 'OPENAI',
  'gpt': 'OPENAI',
  'google': 'GOOGLE',
  'gemini': 'GOOGLE',
  'bedrock': 'AWS_BEDROCK',
  'aws': 'AWS_BEDROCK',
  'azure': 'AZURE_OPENAI',
  'together': 'TOGETHER',
  'groq': 'GROQ',
  'mistral': 'MISTRAL',
  'cohere': 'COHERE',
  'replicate': 'REPLICATE',
  'deepseek': 'DEEPSEEK',
  'xai': 'XAI',
  'grok': 'XAI',
  'perplexity': 'PERPLEXITY',
  'sonar': 'PERPLEXITY',
  'cerebras': 'CEREBRAS',
  'sambanova': 'SAMBANOVA',
  'fireworks': 'FIREWORKS',
};

function resolveProvider(input: string): string | null {
  const upper = input.toUpperCase();
  if (VALID_PROVIDERS.has(upper)) return upper;
  const alias = PROVIDER_ALIASES[input.toLowerCase()];
  return alias || null;
}

async function authenticatePartner(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ilp_')) return null;

  const rawKey = authHeader.slice(7);
  const partners = await prisma.partner.findMany({ where: { isActive: true } });

  for (const partner of partners) {
    if (await bcrypt.compare(rawKey, partner.callbackKeyHash)) {
      return partner;
    }
  }
  return null;
}

interface IngestRecord {
  userRef: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

async function handlePOST(req: NextRequest) {
  const partner = await authenticatePartner(req);
  if (!partner) {
    return NextResponse.json({ error: 'Invalid or missing partner key' }, { status: 401 });
  }

  // Rate limit: 100 requests/min per partner
  const rl = await rateLimit(`ingest:${partner.id}`, 100, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 }
    );
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { records } = body;
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records array is required' }, { status: 400 });
  }
  if (records.length > 1000) {
    return NextResponse.json({ error: 'Maximum 1000 records per request' }, { status: 400 });
  }

  let accepted = 0;
  let rejected = 0;
  const byProvider: Record<string, number> = {};
  let totalCost = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i] as IngestRecord;

    // Validate required fields
    if (!record.userRef || !record.provider || !record.model) {
      errors.push(`Record ${i}: missing userRef, provider, or model`);
      rejected++;
      continue;
    }
    if (typeof record.inputTokens !== 'number' || typeof record.outputTokens !== 'number') {
      errors.push(`Record ${i}: inputTokens and outputTokens must be numbers`);
      rejected++;
      continue;
    }

    const resolvedProvider = resolveProvider(record.provider);
    if (!resolvedProvider) {
      errors.push(`Record ${i}: unknown provider '${record.provider}'`);
      rejected++;
      continue;
    }

    // Resolve user — look up by ID or email
    let userId: string | null = null;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: record.userRef },
          { email: record.userRef },
        ],
      },
    });
    if (user) {
      userId = user.id;
    }

    // Calculate cost if not provided
    const cost = typeof record.cost === 'number'
      ? record.cost
      : calculateCost(record.model, record.inputTokens, record.outputTokens);

    // Find or get provider connection ID for this user
    let providerConnectionId: string | null = null;
    if (userId) {
      const connection = await prisma.providerConnection.findUnique({
        where: { userId_provider: { userId, provider: resolvedProvider as any } },
      });
      providerConnectionId = connection?.id || null;
    }

    // If we have a valid connection, create a UsageRecord
    if (providerConnectionId) {
      await prisma.usageRecord.create({
        data: {
          providerConnectionId,
          model: record.model,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.inputTokens + record.outputTokens,
          costUsd: cost,
          latencyMs: record.latencyMs || null,
          requestType: 'chat',
          metadata: record.metadata as any ?? undefined,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
        },
      });
    }

    // Also create a ProxyRequest entry for the recommendation engine
    if (userId) {
      await prisma.proxyRequest.create({
        data: {
          requestModel: record.model,
          routedProvider: resolvedProvider,
          routedModel: record.model,
          routingReason: 'partner_ingest',
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          costUsd: cost,
          latencyMs: record.latencyMs || 0,
          statusCode: 200,
        },
      });
    }

    byProvider[resolvedProvider] = (byProvider[resolvedProvider] || 0) + cost;
    totalCost += cost;
    accepted++;
  }

  return NextResponse.json({
    accepted,
    rejected,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    summary: {
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      byProvider,
    },
  });
}

export const POST = withTiming(handlePOST);
