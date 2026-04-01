import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// Provider API base URLs (mirrors proxy/route.ts)
const PROVIDER_URLS: Record<string, string> = {
  ANTHROPIC: 'https://api.anthropic.com',
  OPENAI: 'https://api.openai.com',
  GOOGLE: 'https://generativelanguage.googleapis.com',
  TOGETHER: 'https://api.together.xyz',
  FIREWORKS: 'https://api.fireworks.ai',
  REPLICATE: 'https://api.replicate.com',
  GROQ: 'https://api.groq.com/openai',
  DEEPSEEK: 'https://api.deepseek.com',
  MISTRAL: 'https://api.mistral.ai',
  COHERE: 'https://api.cohere.com',
  XAI: 'https://api.x.ai',
  PERPLEXITY: 'https://api.perplexity.ai',
  CEREBRAS: 'https://api.cerebras.ai',
  SAMBANOVA: 'https://api.sambanova.ai',
};

// Rough cost per 1M tokens (input/output) for common models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-4-sonnet': { input: 3.0, output: 15.0 },
  'claude-4-haiku': { input: 0.80, output: 4.0 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  // Google
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  // Together
  'meta-llama/Llama-3-70b-chat-hf': { input: 0.90, output: 0.90 },
  'meta-llama/Llama-3-8b-chat-hf': { input: 0.20, output: 0.20 },
  // Groq
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // xAI
  'grok-2': { input: 2.0, output: 10.0 },
  // Mistral
  'mistral-large-latest': { input: 2.0, output: 6.0 },
  'mistral-small-latest': { input: 0.20, output: 0.60 },
  // Perplexity
  'sonar-pro': { input: 3.0, output: 15.0 },
  'sonar': { input: 1.0, output: 1.0 },
  // Cerebras
  'llama3.1-8b': { input: 0.10, output: 0.10 },
  'llama3.1-70b': { input: 0.60, output: 0.60 },
  // Cohere
  'command-r-plus': { input: 2.50, output: 10.0 },
  'command-r': { input: 0.15, output: 0.60 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

interface ProviderSpec {
  provider: string;
  model: string;
}

// Build the request body and path for a given provider
function buildProviderRequest(provider: string, model: string, prompt: string) {
  const providerUpper = provider.toUpperCase();

  switch (providerUpper) {
    case 'ANTHROPIC':
      return {
        path: '/v1/messages',
        body: {
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    case 'GOOGLE':
      return {
        path: `/v1beta/models/${model}:generateContent`,
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024 },
        },
      };
    case 'COHERE':
      return {
        path: '/v2/chat',
        body: {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        },
      };
    default:
      // OpenAI-compatible: OPENAI, TOGETHER, GROQ, DEEPSEEK, MISTRAL, XAI,
      // PERPLEXITY, CEREBRAS, SAMBANOVA, FIREWORKS, REPLICATE
      return {
        path: '/v1/chat/completions',
        body: {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        },
      };
  }
}

// Extract response text and token counts from provider-specific response shapes
function parseProviderResponse(provider: string, data: Record<string, unknown>) {
  const providerUpper = provider.toUpperCase();

  if (providerUpper === 'ANTHROPIC') {
    const content = data.content as Array<{ type: string; text?: string }> | undefined;
    const text = content?.find((c) => c.type === 'text')?.text || '';
    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return {
      response: text,
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
    };
  }

  if (providerUpper === 'GOOGLE') {
    const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const text = candidates?.[0]?.content?.parts?.[0]?.text || '';
    const meta = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    return {
      response: text,
      inputTokens: meta?.promptTokenCount || 0,
      outputTokens: meta?.candidatesTokenCount || 0,
    };
  }

  if (providerUpper === 'COHERE') {
    const message = data.message as { content?: Array<{ text?: string }> } | undefined;
    const text = message?.content?.[0]?.text || '';
    const usage = data.usage as { tokens?: { input_tokens?: number; output_tokens?: number } } | undefined;
    return {
      response: text,
      inputTokens: usage?.tokens?.input_tokens || 0,
      outputTokens: usage?.tokens?.output_tokens || 0,
    };
  }

  // OpenAI-compatible
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content || '';
  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return {
    response: text,
    inputTokens: usage?.prompt_tokens || 0,
    outputTokens: usage?.completion_tokens || 0,
  };
}

async function callProvider(
  userId: string,
  spec: ProviderSpec,
  prompt: string,
): Promise<{
  response: string;
  tokens: { input: number; output: number; total: number };
  cost: number;
  latencyMs: number;
  error?: string;
}> {
  const providerUpper = spec.provider.toUpperCase();
  const baseUrl = PROVIDER_URLS[providerUpper];
  if (!baseUrl) {
    return { response: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, latencyMs: 0, error: `Unknown provider: ${spec.provider}` };
  }

  // Look up user's connection for this provider
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: providerUpper as unknown as import('@/generated/prisma/enums').AIProvider } },
  });

  if (!connection || !connection.isActive || !connection.encryptedApiKey) {
    return { response: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, latencyMs: 0, error: `Provider ${spec.provider} not connected.` };
  }

  const providerApiKey = decrypt(connection.encryptedApiKey);

  // Build headers
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  switch (providerUpper) {
    case 'ANTHROPIC':
      headers['x-api-key'] = providerApiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'GOOGLE':
      break; // key goes in URL
    default:
      headers['Authorization'] = `Bearer ${providerApiKey}`;
      break;
  }

  const { path, body } = buildProviderRequest(providerUpper, spec.model, prompt);

  let targetUrl = `${baseUrl}${path}`;
  if (providerUpper === 'GOOGLE') {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl += `${separator}key=${providerApiKey}`;
  }

  const startTime = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startTime;
    const data = await res.json();

    if (!res.ok) {
      const errMsg = (data as Record<string, unknown>).error
        ? JSON.stringify((data as Record<string, unknown>).error)
        : `HTTP ${res.status}`;
      return { response: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, latencyMs, error: errMsg };
    }

    const parsed = parseProviderResponse(providerUpper, data as Record<string, unknown>);
    const totalTokens = parsed.inputTokens + parsed.outputTokens;
    const cost = estimateCost(spec.model, parsed.inputTokens, parsed.outputTokens);

    return {
      response: parsed.response,
      tokens: { input: parsed.inputTokens, output: parsed.outputTokens, total: totalTokens },
      cost: Math.round(cost * 1_000_000) / 1_000_000, // round to 6 decimal places
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return { response: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, latencyMs, error: String(err) };
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Rate limit: 10 comparisons per hour per user
  const rl = await rateLimit(`compare:${userId}`, 10, 3_600_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 10 comparisons per hour.', remaining: rl.remaining },
      { status: 429 },
    );
  }

  let body: { prompt?: string; providerA?: ProviderSpec; providerB?: ProviderSpec };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, providerA, providerB } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  if (!providerA?.provider || !providerA?.model) {
    return NextResponse.json({ error: 'providerA with provider and model is required' }, { status: 400 });
  }
  if (!providerB?.provider || !providerB?.model) {
    return NextResponse.json({ error: 'providerB with provider and model is required' }, { status: 400 });
  }

  // Call both providers in parallel
  const [resultA, resultB] = await Promise.all([
    callProvider(userId, providerA, prompt.trim()),
    callProvider(userId, providerB, prompt.trim()),
  ]);

  // Calculate savings
  const costDiff = Math.abs(resultA.cost - resultB.cost);
  const maxCost = Math.max(resultA.cost, resultB.cost);
  const savingsPercent = maxCost > 0 ? (costDiff / maxCost) * 100 : 0;
  const winner = resultA.cost <= resultB.cost ? 'A' : 'B';

  return NextResponse.json({
    a: {
      provider: providerA.provider,
      model: providerA.model,
      response: resultA.response,
      tokens: resultA.tokens,
      cost: resultA.cost,
      latencyMs: resultA.latencyMs,
      error: resultA.error,
    },
    b: {
      provider: providerB.provider,
      model: providerB.model,
      response: resultB.response,
      tokens: resultB.tokens,
      cost: resultB.cost,
      latencyMs: resultB.latencyMs,
      error: resultB.error,
    },
    savings: {
      amount: Math.round(costDiff * 1_000_000) / 1_000_000,
      percent: Math.round(savingsPercent * 100) / 100,
      winner,
    },
  });
}

export const POST = withTiming(handlePOST);
