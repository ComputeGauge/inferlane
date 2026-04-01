import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { createHash } from 'crypto';
import { withTiming } from '@/lib/api-timing';
import { calculateCost } from '@/lib/pricing/model-prices';
import { calculatePhaseAwareCost } from '@/lib/pricing/decode-pricing';
import { getProviderHardware } from '@/lib/pricing/provider-hardware';
import { consumeCredits } from '@/lib/credits/source-resolver';
import { dispatchToNode, disaggregatedDispatch, type DispatchMessage } from '@/lib/nodes/dispatch';
import { resultVerifier } from '@/lib/nodes/result-verifier';
import { proofOfExecution } from '@/lib/nodes/proof-of-execution';
import { checkApiHeaders } from '@/lib/promotions/monitor';
import { recordObservedRateLimits } from '@/lib/promotions/crawler';
import { createStreamTransformer } from '@/lib/proxy/stream-transformer';
import { routeRequest, routePinned, type RoutingStrategy } from '@/lib/proxy/router';
import { detectProvider } from '@/lib/proxy/model-equivalence';
import { sessionManager } from '@/lib/dispatch/session-manager';
import { healthTracker } from '@/lib/proxy/health-tracker';
import { requestCache } from '@/lib/proxy/request-cache';
import { tokenCompressor } from '@/lib/proxy/token-compressor';
import { advancedCompressor } from '@/lib/proxy/advanced-compressor';
import { bypassTier } from '@/lib/proxy/bypass-tier';
import { policyEngine, type PolicyRequest } from '@/lib/proxy/policy-engine';
import { prefixCache } from '@/lib/proxy/prefix-cache';
import { emitSSE } from '@/lib/events';

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
  MISTRAL: 'https://api.mistral.ai',
  COHERE: 'https://api.cohere.com',
  XAI: 'https://api.x.ai',
  PERPLEXITY: 'https://api.perplexity.ai',
  CEREBRAS: 'https://api.cerebras.ai',
  SAMBANOVA: 'https://api.sambanova.ai',
  AWS_BEDROCK: 'https://bedrock-runtime.us-east-1.amazonaws.com',
  AZURE_OPENAI: 'https://placeholder.openai.azure.com',
  MODAL: 'https://api.modal.com',
  LAMBDA: 'https://api.lambdalabs.com',
  COREWEAVE: 'https://api.coreweave.com',
};

// Retryable HTTP status codes for fallback
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_FALLBACK_RETRIES = 2;
const PROVIDER_TIMEOUT_MS = 30_000;

// Headers that must never be forwarded to the client
const SENSITIVE_HEADERS = [
  'authorization', 'x-api-key', 'x-auth-token', 'set-cookie',
  'x-ratelimit-remaining', 'x-ratelimit-reset',
];

function filterResponseHeaders(response: Response): void {
  SENSITIVE_HEADERS.forEach(h => response.headers.delete(h));
}

// Authenticate via InferLane API key (Bearer token)
async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer il_')) {
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

// Build provider-specific request headers
function buildProviderHeaders(provider: string, providerApiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'ANTHROPIC':
      headers['x-api-key'] = providerApiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'OPENAI':
    case 'TOGETHER':
    case 'FIREWORKS':
    case 'GROQ':
    case 'DEEPSEEK':
    case 'MISTRAL':
    case 'COHERE':
    case 'XAI':
    case 'PERPLEXITY':
    case 'CEREBRAS':
    case 'SAMBANOVA':
    case 'MODAL':
    case 'LAMBDA':
    case 'COREWEAVE':
      headers['Authorization'] = `Bearer ${providerApiKey}`;
      break;
    case 'GOOGLE':
      // Google uses API key as query param — handled in URL
      break;
    case 'AWS_BEDROCK':
      // Bedrock via API Gateway uses x-api-key header; native Bedrock requires SigV4
      headers['x-api-key'] = providerApiKey;
      break;
    case 'AZURE_OPENAI':
      // Azure uses 'api-key' header, not 'Authorization: Bearer'
      headers['api-key'] = providerApiKey;
      break;
  }

  return headers;
}

// Build target URL for provider
function buildTargetUrl(
  provider: string,
  baseUrl: string,
  path: string,
  providerApiKey: string,
  metadata?: Record<string, unknown> | null,
  body?: any,
): string {
  switch (provider) {
    case 'GOOGLE': {
      let targetUrl = `${baseUrl}${path}`;
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl += `${separator}key=${providerApiKey}`;
      return targetUrl;
    }
    case 'AWS_BEDROCK': {
      // If user provides a custom API Gateway endpoint, use it directly
      if (metadata?.endpointUrl) {
        return `${metadata.endpointUrl as string}${path}`;
      }
      const region = (metadata?.region as string) || 'us-east-1';
      const bedrockBase = `https://bedrock-runtime.${region}.amazonaws.com`;
      const modelId = body?.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
      return `${bedrockBase}/model/${encodeURIComponent(modelId)}/converse`;
    }
    case 'AZURE_OPENAI': {
      const resourceName = (metadata?.resourceName as string) || 'default';
      const deploymentId = (metadata?.deploymentId as string) || body?.model || 'gpt-4o';
      const apiVersion = (metadata?.apiVersion as string) || '2024-10-21';
      return `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
    }
    default:
      return `${baseUrl}${path}`;
  }
}

// Get provider connection and decrypt API key
async function getProviderCredentials(
  userId: string,
  provider: string,
): Promise<{ apiKey: string; metadata?: Record<string, unknown> | null } | { error: string; status: number }> {
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: provider as any } },
  });

  if (!connection || !connection.isActive) {
    return { error: `Provider ${provider} not connected. Connect it in your dashboard.`, status: 400 };
  }

  if (!connection.encryptedApiKey) {
    return { error: `Provider ${provider} has no API key stored.`, status: 400 };
  }

  return {
    apiKey: decrypt(connection.encryptedApiKey),
    metadata: connection.metadata as Record<string, unknown> | null,
  };
}

// Calculate cost with phase-aware pricing (flat cost as floor)
function calculateRequestCost(
  provider: string,
  resolvedModel: string,
  inputTokens: number,
  outputTokens: number,
) {
  const hw = getProviderHardware(provider, resolvedModel);
  const phaseResult = calculatePhaseAwareCost({
    inputTokens,
    outputTokens,
    memoryTechnology: hw.memoryTechnology,
    memoryBandwidthGBs: hw.memoryBandwidthGBs,
  });

  const flatCost = calculateCost(resolvedModel, inputTokens, outputTokens);
  const costUsd = Math.max(phaseResult.totalCost, flatCost);

  return { costUsd, phaseResult, hw };
}

// Log proxy request to database (fire-and-forget)
function logProxyRequest(
  apiKeyId: string,
  data: {
    requestModel: string;
    routedProvider: string;
    routedModel: string;
    routingReason: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    prefillCost?: number | null;
    decodeCost?: number | null;
    kvCacheCost?: number | null;
    memoryTechnology?: string | null;
    costBreakdown?: any;
    latencyMs: number;
    statusCode: number;
  },
) {
  // Fire-and-forget — don't await in streaming path
  prisma.proxyRequest.create({
    data: { apiKeyId, ...data },
  }).catch((err: unknown) => {
    console.error('[Proxy] Failed to log request:', err);
  });
}

// Consume credits (fire-and-forget)
function consumeCreditsAsync(
  apiKeyId: string,
  userId: string,
  costUsd: number,
) {
  if (costUsd <= 0) return;

  (async () => {
    try {
      const proxyReq = await prisma.proxyRequest.findFirst({
        where: { apiKeyId },
        orderBy: { timestamp: 'desc' },
        select: { id: true },
      });

      const result = await consumeCredits(userId, costUsd, proxyReq?.id);

      if (result.remainingCost > 0) {
        console.log(
          `[Proxy] Credits covered $${result.totalConsumed.toFixed(6)} of $${costUsd.toFixed(6)}. ` +
          `Remaining: $${result.remainingCost.toFixed(6)} (${result.consumed.length} source(s))`,
        );
      }
    } catch (creditErr) {
      console.error('[Proxy] Credit consumption error:', creditErr);
    }
  })();
}

// Estimate input tokens from messages array
function estimateInputTokens(messages: any[]): number {
  if (!messages || !Array.isArray(messages)) return 0;
  return messages.reduce(
    (sum: number, m: any) => sum + (typeof m.content === 'string' ? m.content.length : 0),
    0,
  ) / 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming response handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleStreamingResponse(
  providerRes: Response,
  provider: string,
  resolvedModel: string,
  apiKeyId: string,
  userId: string,
  routingReason: string,
  startTime: number,
): Promise<Response> {
  if (!providerRes.body) {
    return NextResponse.json({ error: 'Provider returned no body for streaming' }, { status: 502 });
  }

  const { stream: transformStream, getAccumulator } = createStreamTransformer(provider);

  // Pipe provider response through our normalizer
  const transformedStream = providerRes.body.pipeThrough(transformStream);

  // Create a pass-through that logs billing after the stream finishes
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = transformedStream.getReader();

  // Stream data through, then log billing when done
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (err) {
      console.error('[Proxy] Stream error:', err);
    } finally {
      await writer.close();

      // Stream is complete — log billing asynchronously
      const latencyMs = Date.now() - startTime;
      const acc = getAccumulator();
      const { costUsd, phaseResult, hw } = calculateRequestCost(
        provider,
        acc.model || resolvedModel,
        acc.inputTokens,
        acc.outputTokens,
      );

      logProxyRequest(apiKeyId, {
        requestModel: resolvedModel,
        routedProvider: provider,
        routedModel: acc.model || resolvedModel,
        routingReason,
        inputTokens: acc.inputTokens,
        outputTokens: acc.outputTokens,
        costUsd,
        prefillCost: phaseResult.prefillCost,
        decodeCost: phaseResult.decodeCost,
        kvCacheCost: phaseResult.kvCacheCost,
        memoryTechnology: hw.memoryTechnology,
        costBreakdown: phaseResult as any,
        latencyMs,
        statusCode: providerRes.status,
      });

      consumeCreditsAsync(apiKeyId, userId, costUsd);
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-IL-Request-Id': `il-${Date.now()}`,
      'X-IL-Routed-To': provider,
      'X-IL-Routing-Reason': routingReason,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Forward request to a specific provider (used by both direct and fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function forwardToProvider(
  provider: string,
  path: string,
  body: any,
  userId: string,
  apiKeyId: string,
  resolvedModel: string,
  routingReason: string,
  isStreaming: boolean,
  startTime: number,
): Promise<{ response: Response; retryable: boolean } | { error: string; status: number; retryable: boolean }> {
  const baseUrl = PROVIDER_URLS[provider];
  if (!baseUrl) {
    return { error: `Unknown provider: ${provider}`, status: 400, retryable: false };
  }

  // Get credentials
  const creds = await getProviderCredentials(userId, provider);
  if ('error' in creds) {
    return { ...creds, retryable: false };
  }

  const headers = buildProviderHeaders(provider, creds.apiKey);
  const targetUrl = buildTargetUrl(provider, baseUrl, path, creds.apiKey, creds.metadata, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const providerRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Passive promotion detection (non-blocking)
    try {
      const headerDetections = checkApiHeaders(provider, providerRes.headers);
      if (headerDetections.length > 0) {
        console.log(`[Proxy] Promotion signals from ${provider}:`, headerDetections);
      }
    } catch {
      // Never fail a proxy request over promotion detection
    }

    // Feed rate limit data into the promotion crawler (non-blocking)
    try {
      recordObservedRateLimits(provider, providerRes.headers);
    } catch {
      // Never fail a proxy request over rate limit recording
    }

    // Check if we should retry on a different provider
    if (RETRYABLE_STATUS_CODES.has(providerRes.status)) {
      return { error: `Provider ${provider} returned ${providerRes.status}`, status: providerRes.status, retryable: true };
    }

    // ── Streaming path ──
    if (isStreaming && providerRes.body) {
      const streamResponse = await handleStreamingResponse(
        providerRes,
        provider,
        resolvedModel,
        apiKeyId,
        userId,
        routingReason,
        startTime,
      );
      return { response: streamResponse, retryable: false };
    }

    // ── Non-streaming path ──
    const latencyMs = Date.now() - startTime;
    const responseData = await providerRes.json();

    const inputTokens = responseData?.usage?.input_tokens || responseData?.usage?.prompt_tokens || 0;
    const outputTokens = responseData?.usage?.output_tokens || responseData?.usage?.completion_tokens || 0;
    const { costUsd, phaseResult, hw } = calculateRequestCost(
      provider,
      resolvedModel,
      inputTokens,
      outputTokens,
    );

    await prisma.proxyRequest.create({
      data: {
        apiKeyId,
        requestModel: resolvedModel,
        routedProvider: provider,
        routedModel: resolvedModel,
        routingReason,
        inputTokens,
        outputTokens,
        costUsd,
        prefillCost: phaseResult.prefillCost,
        decodeCost: phaseResult.decodeCost,
        kvCacheCost: phaseResult.kvCacheCost,
        memoryTechnology: hw.memoryTechnology,
        costBreakdown: phaseResult as any,
        latencyMs,
        statusCode: providerRes.status,
      },
    });

    // Credit consumption
    if (costUsd > 0 && providerRes.status >= 200 && providerRes.status < 300) {
      consumeCreditsAsync(apiKeyId, userId, costUsd);
    }

    // Emit SSE event for real-time dashboard updates
    emitSSE({
      type: 'proxy_request',
      data: {
        provider,
        model: resolvedModel,
        costUsd,
        latencyMs,
        status: providerRes.status < 400 ? 'success' : 'error',
        inputTokens,
        outputTokens,
      },
      timestamp: new Date().toISOString(),
    });

    // Add CG metadata headers to non-streaming response
    const res = NextResponse.json(responseData, { status: providerRes.status });
    res.headers.set('X-IL-Request-Id', `il-${Date.now()}`);
    res.headers.set('X-IL-Routed-To', provider);
    res.headers.set('X-IL-Routing-Reason', routingReason);
    res.headers.set('X-IL-Cost', costUsd.toFixed(6));
    return { response: res, retryable: false };

  } catch (error) {
    const latencyMs = Date.now() - startTime;

    await prisma.proxyRequest.create({
      data: {
        apiKeyId,
        requestModel: resolvedModel,
        routedProvider: provider,
        routedModel: resolvedModel,
        routingReason,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs,
        statusCode: 502,
      },
    });

    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error(`[Proxy] ${provider} ${isTimeout ? 'timeout' : 'error'}:`, error);
    return {
      error: isTimeout ? `Provider ${provider} timed out` : `Failed to reach ${provider}`,
      status: 502,
      retryable: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/proxy — forward requests to AI providers with smart routing
// ─────────────────────────────────────────────────────────────────────────────

async function handlePOST(req: NextRequest) {
  // Authenticate
  const apiKey = await authenticateRequest(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  // Rate limit: 100 requests per minute per API key
  const rl = await rateLimit(`proxy:${apiKey.id}`, 100, 60_000);
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

  const { provider, path, body, model, routing, stream, budget } = reqBody;

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Sanitize path — must start with / and not contain protocol or double dots
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('..') || path.includes('://')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Resolve model from multiple possible locations
  const resolvedModel = model || body?.model || 'unknown';
  const isStreaming = stream === true || body?.stream === true;

  // ── Tier 0 Bypass: answer deterministic requests without any LLM call ──
  const bypassResult = bypassTier.canBypass(body?.messages);
  if (bypassResult.bypass && bypassResult.response !== undefined) {
    const bypassStart = Date.now();
    const bypassLatency = Date.now() - bypassStart;

    // Log as a zero-cost request
    logProxyRequest(apiKey.id, {
      requestModel: resolvedModel || 'bypass',
      routedProvider: 'BYPASS',
      routedModel: 'bypass',
      routingReason: `bypass:${bypassResult.reason ?? 'deterministic'}`,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: bypassLatency,
      statusCode: 200,
    });

    // Return OpenAI-compatible chat completion format
    const bypassResponse = {
      id: `il-bypass-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'bypass',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: bypassResult.response },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      _inferlane: {
        bypass: true,
        bypassReason: bypassResult.reason,
        costUsd: 0,
        latencyMs: bypassLatency,
      },
    };

    const res = NextResponse.json(bypassResponse, { status: 200 });
    res.headers.set('X-IL-Bypass', 'true');
    res.headers.set('X-IL-Cost', '0');
    res.headers.set('X-IL-Latency', bypassLatency.toString());
    res.headers.set('X-IL-Request-Id', `il-${Date.now()}`);
    return res;
  }

  // ── Dedup cache: return cached response for identical recent requests ──
  let cacheKey: string | null = null;
  if (!isStreaming && body && !requestCache.shouldSkipCache(req.headers, body)) {
    cacheKey = requestCache.generateKey(body);
    const cached = requestCache.get(cacheKey);
    if (cached) {
      const res = new NextResponse(cached.body, {
        status: cached.status,
        headers: {
          'Content-Type': 'application/json',
          'X-IL-Cache': 'HIT',
          'X-IL-Cache-Provider': cached.provider,
          'X-IL-Cache-Model': cached.model,
          'X-IL-Request-Id': `il-${Date.now()}`,
        },
      });
      return res;
    }
  }

  // ── Token compression: advanced 12-layer LLMLingua-style pipeline ──
  let compressionSavings = 0;
  let compressionOriginalTokens = 0;
  let compressionCompressedTokens = 0;
  let compressionLayerNames: string[] = [];
  if (body?.messages && Array.isArray(body.messages)) {
    const totalEstimatedTokens = estimateInputTokens(body.messages);
    if (totalEstimatedTokens > 1000) {
      // Determine aggressiveness from request header (default: moderate)
      const compressionHeader = req.headers.get('x-il-compression') as
        | 'none' | 'light' | 'moderate' | 'aggressive'
        | null;

      if (compressionHeader !== 'none') {
        const aggressiveness = (
          compressionHeader === 'light' || compressionHeader === 'moderate' || compressionHeader === 'aggressive'
        ) ? compressionHeader : 'moderate';

        const result = advancedCompressor.compress(body.messages, {
          aggressiveness,
        });

        if (result.compressionRatio > 0) {
          compressionOriginalTokens = result.originalTokens;
          compressionCompressedTokens = result.compressedTokens;
          compressionSavings = result.compressionRatio;
          compressionLayerNames = result.layers.map((l) => l.name);

          // Replace messages with compressed versions
          body.messages = result.compressedMessages;
        }
      }
    }
  }

  // Detect provider from model name if not specified
  const specifiedProvider = provider?.toUpperCase();
  const providerUpper = specifiedProvider || detectProvider(resolvedModel);

  // ── Node routing: if provider is 'NODE' or 'DECENTRALISED' ──
  if (providerUpper === 'NODE' || providerUpper === 'DECENTRALISED') {
    const prompt = body?.messages?.[0]?.content || body?.prompt || '';
    const maxTokens = body?.max_tokens ?? 1024;
    const estimatedInput = estimateInputTokens(body?.messages);

    const DISAGGREGATE_INPUT_THRESHOLD = 4000;
    const DISAGGREGATE_OUTPUT_THRESHOLD = 512;
    const useDisaggregated = estimatedInput > DISAGGREGATE_INPUT_THRESHOLD
      && maxTokens > DISAGGREGATE_OUTPUT_THRESHOLD;

    const dispatchArgs = {
      userId: apiKey.userId,
      model: resolvedModel,
      prompt,
      messages: body?.messages,
      maxTokens,
      preferredRegion: body?.region,
      maxRetries: 2,
    };

    const result = useDisaggregated
      ? await disaggregatedDispatch(dispatchArgs)
      : await dispatchToNode(dispatchArgs);

    await prisma.proxyRequest.create({
      data: {
        apiKeyId: apiKey.id,
        requestModel: resolvedModel,
        routedProvider: 'NODE',
        routedModel: resolvedModel,
        routingReason: useDisaggregated ? 'disaggregated_dispatch' : 'node_dispatch',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: result.actualCostUsd,
        prefillCost: result.phaseBreakdown?.prefillCost ?? null,
        decodeCost: result.phaseBreakdown?.decodeCost ?? null,
        kvCacheCost: result.phaseBreakdown?.kvCacheCost ?? null,
        memoryTechnology: result.phaseBreakdown?.memoryTechnology ?? null,
        costBreakdown: result.phaseBreakdown ? (result.phaseBreakdown as any) : null,
        latencyMs: result.latencyMs,
        statusCode: result.success ? 200 : 502,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Node dispatch failed' },
        { status: 502 },
      );
    }

    // Create execution proof for the node response
    let proofHeaders: Record<string, string> = {};
    if (result.nodeId && result.response) {
      const proof = proofOfExecution.createProof(
        result.nodeId,
        prompt || JSON.stringify(body?.messages ?? []),
        result.response,
        result.latencyMs,
        resolvedModel,
      );
      proofHeaders = {
        'X-IL-Proof-Id': proof.proofId,
        'X-IL-Proof-Confidence': String(
          ((proof.fingerprintScore + proof.consistencyScore) / 2).toFixed(3),
        ),
        'X-IL-Proof-Method': 'fingerprint+consistency',
      };
      const avgConfidence = (proof.fingerprintScore + proof.consistencyScore) / 2;
      if (avgConfidence < 0.3) {
        console.warn(
          `[Proxy] Low proof confidence ${avgConfidence.toFixed(3)} for node ${result.nodeId} proof ${proof.proofId}`,
        );
      }
    }

    return NextResponse.json({
      id: `il-node-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: resolvedModel,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.response },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      _inferlane: {
        nodeId: result.nodeId,
        latencyMs: result.latencyMs,
        costUsd: result.actualCostUsd,
        disaggregated: useDisaggregated,
        routingReason: useDisaggregated ? 'disaggregated_dispatch' : 'node_dispatch',
      },
    }, { headers: proofHeaders });
  }

  // ── Smart routing: determine optimal provider ──
  const routingStrategy: RoutingStrategy = (routing as RoutingStrategy) || 'auto';
  const estimatedInput = estimateInputTokens(body?.messages);
  const estimatedOutput = body?.max_tokens ?? 500;

  const routingReq = {
    userId: apiKey.userId,
    model: resolvedModel,
    provider: providerUpper !== 'UNKNOWN' ? providerUpper : undefined,
    routing: routingStrategy,
    budget,
    estimatedInputTokens: estimatedInput || 1000,
    estimatedOutputTokens: estimatedOutput,
    messages: body?.messages as Array<{ role: string; content: string }> | undefined,
  };

  // ── Session pinning: honour pinned provider/model for multi-turn sessions ──
  const sessionId = req.headers.get('x-il-session-id');
  let pinOverridden = false;
  let routingDecision;

  if (sessionId) {
    const pinned = await sessionManager.getPinned(sessionId);
    if (pinned) {
      const pinResult = await routePinned(pinned.provider, pinned.model, routingReq);
      routingDecision = pinResult.decision;
      pinOverridden = pinResult.pinOverridden;
    } else {
      routingDecision = await routeRequest(routingReq);
      // Pin the session to whichever provider/model was chosen
      sessionManager.pinSession(sessionId, routingDecision.provider, routingDecision.model).catch((err) => {
        console.error('[Proxy] Failed to pin session:', err);
      });
    }
  } else {
    routingDecision = await routeRequest(routingReq);
  }

  // Budget gate: if budget is set and estimated cost exceeds it, reject
  if (budget !== undefined && routingDecision.budgetExceeded) {
    return NextResponse.json(
      {
        error: 'Estimated cost exceeds budget',
        estimatedCost: routingDecision.estimatedCost,
        budget,
        cheapestModel: routingDecision.model,
        cheapestProvider: routingDecision.provider,
      },
      { status: 402 },
    );
  }

  // ── Policy engine: enforce routing constraints ──
  const policyRequest: PolicyRequest = {
    model: resolvedModel,
    provider: routingDecision.provider,
    tier: routingDecision.tier,
    estimatedCost: routingDecision.estimatedCost,
    estimatedTokens: estimatedInput + estimatedOutput,
    sessionId: sessionId ?? undefined,
    messages: body?.messages,
  };

  policyEngine.recordRequest(apiKey.userId);
  const policyResult = policyEngine.evaluate(policyRequest, routingDecision);

  if (!policyResult.allowed) {
    const blockReason = policyResult.warnings.join('; ') || 'Blocked by policy';
    const blockedPolicy = policyResult.matchedPolicies.find(
      (mp) => mp.action.type === 'block',
    );
    return NextResponse.json(
      {
        error: 'Request blocked by routing policy',
        reason: blockReason,
        policy: blockedPolicy?.policy.name,
      },
      { status: 403 },
    );
  }

  // Apply policy overrides
  if (policyResult.overrides.provider) {
    routingDecision.provider = policyResult.overrides.provider;
  }
  if (policyResult.overrides.model) {
    routingDecision.model = policyResult.overrides.model;
  }

  // Determine the provider and model to use
  let targetProvider = routingDecision.provider;
  let targetModel = routingDecision.model;
  const routingReason = routingDecision.reasonCode;

  // Ensure the body uses the routed model
  // If user specified an exact model and routing didn't change the provider, preserve the user's model
  const userModel = body?.model;
  const effectiveModel = (routingReason === 'direct' && userModel) ? userModel : targetModel;
  // Google's API doesn't accept 'stream' or 'model' in the body — strip them
  const routedBody = body
    ? targetProvider === 'GOOGLE'
      ? { ...body }
      : { ...body, model: effectiveModel, stream: isStreaming }
    : undefined;

  // Determine the correct API path for the routed provider
  // If routing changed the provider, we need to adjust the path
  let routedPath = path;
  if (targetProvider !== providerUpper && routingStrategy !== 'direct') {
    // Auto-map path based on provider conventions
    if (targetProvider === 'ANTHROPIC') {
      routedPath = '/v1/messages';
    } else {
      // OpenAI-compatible providers all use this path
      routedPath = '/v1/chat/completions';
    }
  }

  const startTime = Date.now();

  // ── Forward to primary provider ──
  const primaryResult = await forwardToProvider(
    targetProvider,
    routedPath,
    routedBody,
    apiKey.userId,
    apiKey.id,
    resolvedModel,
    routingReason,
    isStreaming,
    startTime,
  );

  // Record health for primary provider
  const primaryLatencyMs = Date.now() - startTime;
  if ('response' in primaryResult) {
    healthTracker.recordResult(targetProvider, primaryLatencyMs, 200);
  } else {
    healthTracker.recordResult(targetProvider, primaryLatencyMs, primaryResult.status);
  }

  // Success on primary
  if ('response' in primaryResult) {
    // Add routing metadata headers
    const res = primaryResult.response;
    if (routingDecision.savings && routingDecision.savings > 0) {
      res.headers.set('X-IL-Savings', routingDecision.savings.toFixed(6));
    }
    if (routingDecision.alternativeProvider) {
      res.headers.set('X-IL-Alternative', `${routingDecision.alternativeProvider}/${routingDecision.alternativeModel}`);
    }

    // Pin override header
    if (pinOverridden) {
      res.headers.set('X-IL-Pin-Override', 'true');
    }

    // Compression headers
    if (compressionSavings > 0) {
      res.headers.set('X-IL-Compression-Ratio', compressionSavings.toFixed(4));
      res.headers.set('X-IL-Original-Tokens', String(compressionOriginalTokens));
      res.headers.set('X-IL-Compressed-Tokens', String(compressionCompressedTokens));
      res.headers.set('X-IL-Compression-Layers', compressionLayerNames.join(','));
    }

    // Classification headers
    if (routingDecision.tier) {
      res.headers.set('X-IL-Tier', routingDecision.tier);
    }
    if (routingDecision.confidence !== undefined) {
      res.headers.set('X-IL-Confidence', routingDecision.confidence.toFixed(4));
    }

    // Policy warnings header
    if (policyResult.warnings.length > 0) {
      res.headers.set('X-IL-Policy-Warnings', policyResult.warnings.join('; '));
    }

    // Prefix cache hit header
    if (routingDecision.reason?.includes('[prefix-cache-hit]')) {
      res.headers.set('X-IL-Prefix-Cache-Hit', 'true');
    }

    // Record prefix cache for OpenClaw node responses
    if (
      targetProvider === 'NODE' ||
      targetProvider === 'DECENTRALISED' ||
      targetProvider === 'openclaw'
    ) {
      if (body?.messages && Array.isArray(body.messages)) {
        const nodeId = res.headers.get('X-IL-Node-Id') ?? targetProvider;
        prefixCache.recordCache(nodeId, body.messages, resolvedModel);
      }
    }

    // Validation override header
    if (routingDecision.validationOverride) {
      res.headers.set('X-IL-Validation-Override', routingDecision.validationOverride);
    }

    // Store in dedup cache (non-streaming only)
    if (cacheKey && !isStreaming && res.status >= 200 && res.status < 300) {
      // Clone body for caching without consuming the response
      try {
        const clonedRes = res.clone();
        clonedRes.text().then((bodyText) => {
          requestCache.set(cacheKey!, {
            body: bodyText,
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            cachedAt: Date.now(),
            provider: routingDecision.provider,
            model: routingDecision.model,
            costUsd: routingDecision.estimatedCost,
          });
        }).catch(() => { /* cache miss is acceptable */ });
      } catch {
        // Cache storage failure is non-critical
      }
    }

    filterResponseHeaders(res);
    return res;
  }

  // ── Fallback: retry on equivalent provider if primary failed ──
  if (primaryResult.retryable && routingDecision.fallbackProvider) {
    console.log(
      `[Proxy] Primary ${targetProvider} failed (${primaryResult.status}), falling back to ${routingDecision.fallbackProvider}/${routingDecision.fallbackModel}`,
    );

    const fallbackProvider = routingDecision.fallbackProvider;
    const fallbackModel = routingDecision.fallbackModel!;

    // Adjust path for fallback provider
    let fallbackPath = routedPath;
    if (fallbackProvider === 'ANTHROPIC') {
      fallbackPath = '/v1/messages';
    } else if (fallbackProvider !== targetProvider) {
      fallbackPath = '/v1/chat/completions';
    }

    const fallbackBody = routedBody
      ? { ...routedBody, model: fallbackModel }
      : undefined;

    const fallbackResult = await forwardToProvider(
      fallbackProvider,
      fallbackPath,
      fallbackBody,
      apiKey.userId,
      apiKey.id,
      resolvedModel,
      'fallback_retry',
      isStreaming,
      Date.now(),
    );

    // Record health for fallback provider
    const fallbackLatencyMs = Date.now() - startTime;
    if ('response' in fallbackResult) {
      healthTracker.recordResult(fallbackProvider, fallbackLatencyMs, 200);
    } else {
      healthTracker.recordResult(fallbackProvider, fallbackLatencyMs, fallbackResult.status);
    }

    if ('response' in fallbackResult) {
      fallbackResult.response.headers.set('X-IL-Fallback', 'true');
      fallbackResult.response.headers.set('X-IL-Fallback-From', `${targetProvider}/${targetModel}`);
      fallbackResult.response.headers.set('X-IL-Fallback-To', `${fallbackProvider}/${fallbackModel}`);
      filterResponseHeaders(fallbackResult.response);
      return fallbackResult.response;
    }

    // Fallback also failed — try decentralized nodes as last resort
    const onlineNodes = await prisma.nodeOperator.count({ where: { isOnline: true } });
    if (onlineNodes > 0) {
      console.log(
        `[Proxy] Both centralized providers failed, attempting node fallback (${onlineNodes} nodes online)`,
      );

      try {
        // Inject verification challenge into node dispatch
        const challenge1 = resultVerifier.generateChallenge();
        const verifiedMessages1: DispatchMessage[] | undefined = routedBody?.messages
          ? resultVerifier.injectChallenge(routedBody.messages as DispatchMessage[], challenge1)
          : undefined;

        const nodeStartTime = Date.now();
        const nodeResult = await dispatchToNode({
          userId: apiKey.userId,
          model: resolvedModel,
          prompt: routedBody?.messages?.[0]?.content || routedBody?.prompt || '',
          messages: verifiedMessages1,
          maxTokens: routedBody?.max_tokens ?? 1024,
          maxRetries: 2,
        });

        const nodeLatencyMs = Date.now() - nodeStartTime;
        healthTracker.recordResult('NODE', nodeLatencyMs, nodeResult.success ? 200 : 502);

        if (nodeResult.success && nodeResult.response) {
          // Verify the node actually performed computation
          const verification1 = resultVerifier.verifyResponse(nodeResult.response, challenge1);
          if (nodeResult.nodeId) {
            resultVerifier.updateReputation(nodeResult.nodeId, verification1.passed).catch(() => {});
          }

          // Strip verification block before returning to user
          const cleanResponse1 = resultVerifier.stripVerificationBlock(nodeResult.response, challenge1);

          // Create execution proof
          const proofHeadersFb1: Record<string, string> = {};
          if (nodeResult.nodeId) {
            const proof1 = proofOfExecution.createProof(
              nodeResult.nodeId,
              routedBody?.messages?.[0]?.content || routedBody?.prompt || '',
              cleanResponse1,
              nodeLatencyMs,
              resolvedModel,
              { passed: verification1.passed, confidence: verification1.confidence },
            );
            proofHeadersFb1['X-IL-Proof-Id'] = proof1.proofId;
            proofHeadersFb1['X-IL-Proof-Confidence'] = String(
              ((proof1.fingerprintScore + proof1.consistencyScore) / 2).toFixed(3),
            );
            proofHeadersFb1['X-IL-Proof-Method'] = 'challenge+fingerprint+consistency';
          }

          return NextResponse.json(
            {
              id: `il-node-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: resolvedModel,
              choices: [{
                index: 0,
                message: { role: 'assistant', content: cleanResponse1 },
                finish_reason: 'stop',
              }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              _inferlane: {
                nodeId: nodeResult.nodeId,
                latencyMs: nodeResult.latencyMs,
                costUsd: nodeResult.actualCostUsd,
                routingReason: 'node_auto_fallback',
                verification: {
                  passed: verification1.passed,
                  confidence: verification1.confidence,
                },
              },
            },
            {
              status: 200,
              headers: {
                'X-IL-Request-Id': `il-${Date.now()}`,
                'X-IL-Routed-To': 'NODE',
                'X-IL-Routing-Reason': 'node_auto_fallback',
                'X-IL-Fallback': 'true',
                'X-IL-Fallback-To-Node': 'true',
                'X-IL-Fallback-From': `${targetProvider}/${targetModel}`,
                'X-IL-Verification': verification1.passed ? 'PASS' : 'FAIL',
                'X-IL-Verification-Confidence': verification1.confidence.toFixed(2),
                ...proofHeadersFb1,
              },
            },
          );
        }
      } catch (nodeErr) {
        console.error('[Proxy] Node auto-fallback failed:', nodeErr);
        healthTracker.recordResult('NODE', Date.now() - startTime, 502);
      }
    }

    // All fallbacks exhausted — return the original centralized error
    return NextResponse.json(
      {
        error: `Both primary (${targetProvider}) and fallback (${fallbackProvider}) failed`,
        primaryError: primaryResult.error,
        fallbackError: fallbackResult.error,
      },
      { status: 502 },
    );
  }

  // No fallback available or not retryable — try nodes as last resort
  if (primaryResult.retryable) {
    const onlineNodes = await prisma.nodeOperator.count({ where: { isOnline: true } });
    if (onlineNodes > 0) {
      console.log(
        `[Proxy] Primary ${targetProvider} failed, no centralized fallback, attempting node fallback (${onlineNodes} nodes online)`,
      );

      try {
        // Inject verification challenge into node dispatch
        const challenge2 = resultVerifier.generateChallenge();
        const verifiedMessages2: DispatchMessage[] | undefined = routedBody?.messages
          ? resultVerifier.injectChallenge(routedBody.messages as DispatchMessage[], challenge2)
          : undefined;

        const nodeStartTime = Date.now();
        const nodeResult = await dispatchToNode({
          userId: apiKey.userId,
          model: resolvedModel,
          prompt: routedBody?.messages?.[0]?.content || routedBody?.prompt || '',
          messages: verifiedMessages2,
          maxTokens: routedBody?.max_tokens ?? 1024,
          maxRetries: 2,
        });

        const nodeLatencyMs = Date.now() - nodeStartTime;
        healthTracker.recordResult('NODE', nodeLatencyMs, nodeResult.success ? 200 : 502);

        if (nodeResult.success && nodeResult.response) {
          // Verify the node actually performed computation
          const verification2 = resultVerifier.verifyResponse(nodeResult.response, challenge2);
          if (nodeResult.nodeId) {
            resultVerifier.updateReputation(nodeResult.nodeId, verification2.passed).catch(() => {});
          }

          // Strip verification block before returning to user
          const cleanResponse2 = resultVerifier.stripVerificationBlock(nodeResult.response, challenge2);

          // Create execution proof
          const proofHeadersFb2: Record<string, string> = {};
          if (nodeResult.nodeId) {
            const proof2 = proofOfExecution.createProof(
              nodeResult.nodeId,
              routedBody?.messages?.[0]?.content || routedBody?.prompt || '',
              cleanResponse2,
              nodeLatencyMs,
              resolvedModel,
              { passed: verification2.passed, confidence: verification2.confidence },
            );
            proofHeadersFb2['X-IL-Proof-Id'] = proof2.proofId;
            proofHeadersFb2['X-IL-Proof-Confidence'] = String(
              ((proof2.fingerprintScore + proof2.consistencyScore) / 2).toFixed(3),
            );
            proofHeadersFb2['X-IL-Proof-Method'] = 'challenge+fingerprint+consistency';
          }

          return NextResponse.json(
            {
              id: `il-node-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: resolvedModel,
              choices: [{
                index: 0,
                message: { role: 'assistant', content: cleanResponse2 },
                finish_reason: 'stop',
              }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              _inferlane: {
                nodeId: nodeResult.nodeId,
                latencyMs: nodeResult.latencyMs,
                costUsd: nodeResult.actualCostUsd,
                routingReason: 'node_auto_fallback',
                verification: {
                  passed: verification2.passed,
                  confidence: verification2.confidence,
                },
              },
            },
            {
              status: 200,
              headers: {
                'X-IL-Request-Id': `il-${Date.now()}`,
                'X-IL-Routed-To': 'NODE',
                'X-IL-Routing-Reason': 'node_auto_fallback',
                'X-IL-Fallback': 'true',
                'X-IL-Fallback-To-Node': 'true',
                'X-IL-Fallback-From': `${targetProvider}/${targetModel}`,
                'X-IL-Verification': verification2.passed ? 'PASS' : 'FAIL',
                'X-IL-Verification-Confidence': verification2.confidence.toFixed(2),
                ...proofHeadersFb2,
              },
            },
          );
        }
      } catch (nodeErr) {
        console.error('[Proxy] Node auto-fallback failed:', nodeErr);
        healthTracker.recordResult('NODE', Date.now() - startTime, 502);
      }
    }
  }

  return NextResponse.json(
    { error: primaryResult.error },
    { status: primaryResult.status },
  );
}

export const POST = withTiming(handlePOST);
