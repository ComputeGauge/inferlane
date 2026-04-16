import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { decrypt } from '@/lib/crypto';
import { authenticateRequest } from '@/lib/auth-api-key';
import { calculateCost } from '@/lib/pricing/model-prices';
import { calculatePhaseAwareCost } from '@/lib/pricing/decode-pricing';
import { getProviderHardware } from '@/lib/pricing/provider-hardware';
import { consumeCredits } from '@/lib/credits/source-resolver';
import { createStreamTransformer } from '@/lib/proxy/stream-transformer';
import { routeRequest, type RoutingStrategy } from '@/lib/proxy/router';
import { detectProvider } from '@/lib/proxy/model-equivalence';

// ---------------------------------------------------------------------------
// Provider API base URLs
// ---------------------------------------------------------------------------

const PROVIDER_URLS: Record<string, string> = {
  ANTHROPIC: 'https://api.anthropic.com',
  OPENAI: 'https://api.openai.com',
  GOOGLE: 'https://generativelanguage.googleapis.com',
  TOGETHER: 'https://api.together.xyz',
  FIREWORKS: 'https://api.fireworks.ai',
  GROQ: 'https://api.groq.com/openai',
  DEEPSEEK: 'https://api.deepseek.com',
  MISTRAL: 'https://api.mistral.ai',
  COHERE: 'https://api.cohere.com',
  XAI: 'https://api.x.ai',
  PERPLEXITY: 'https://api.perplexity.ai',
  CEREBRAS: 'https://api.cerebras.ai',
  SAMBANOVA: 'https://api.sambanova.ai',
  // Decentralized AI compute providers
  BITTENSOR: 'https://api.chutes.ai',         // Chutes SN64 gateway (largest subnet)
  HYPERBOLIC: 'https://api.hyperbolic.xyz',
  // Decentralized Mac inference
  DARKBLOOM: 'https://api.darkbloom.dev',
  // AKASH: URL is per-deployment — resolved from ProviderConnection.metadata
};

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const PROVIDER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Provider headers
// ---------------------------------------------------------------------------

function buildProviderHeaders(
  provider: string,
  providerApiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'ANTHROPIC':
      headers['x-api-key'] = providerApiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'GOOGLE':
      // Google uses API key as query param -- handled in URL builder
      break;
    default:
      headers['Authorization'] = `Bearer ${providerApiKey}`;
      break;
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Provider URL + path
// ---------------------------------------------------------------------------

function buildTargetUrl(
  provider: string,
  model: string,
  providerApiKey: string,
  isStreaming: boolean,
  metadata?: Record<string, unknown> | null,
): string {
  // Akash uses per-deployment URLs stored in metadata
  if (provider === 'AKASH' && metadata?.gatewayUrl) {
    return `${metadata.gatewayUrl}/v1/chat/completions`;
  }

  const baseUrl = PROVIDER_URLS[provider];

  switch (provider) {
    case 'ANTHROPIC':
      return `${baseUrl}/v1/messages`;
    case 'GOOGLE': {
      const action = isStreaming ? 'streamGenerateContent' : 'generateContent';
      return `${baseUrl}/v1beta/models/${model}:${action}?key=${providerApiKey}`;
    }
    // Decentralized providers use OpenAI-compatible /v1/chat/completions
    case 'BITTENSOR':
    case 'HYPERBOLIC':
    case 'DARKBLOOM':
    default:
      return `${baseUrl}/v1/chat/completions`;
  }
}

// ---------------------------------------------------------------------------
// Provider credentials
// ---------------------------------------------------------------------------

async function getProviderCredentials(
  userId: string,
  provider: string,
): Promise<{ apiKey: string; metadata?: Record<string, unknown> | null } | { error: string; status: number }> {
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: provider as any } },
  });

  if (!connection || !connection.isActive) {
    // Env fallback — allows the proxy to work without DB-stored keys.
    // Useful for self-hosted / single-user deployments.
    const envKeyMap: Record<string, string> = {
      ANTHROPIC: 'ANTHROPIC_API_KEY',
      OPENAI: 'OPENAI_API_KEY',
      GOOGLE: 'GOOGLE_API_KEY',
      DEEPSEEK: 'DEEPSEEK_API_KEY',
      GROQ: 'GROQ_API_KEY',
      TOGETHER: 'TOGETHER_API_KEY',
      MISTRAL: 'MISTRAL_API_KEY',
      FIREWORKS: 'FIREWORKS_API_KEY',
      XAI: 'XAI_API_KEY',
      DARKBLOOM: 'DARKBLOOM_API_KEY',
    };
    const envVar = envKeyMap[provider];
    const envKey = envVar ? process.env[envVar] : undefined;
    if (envKey) {
      return { apiKey: envKey };
    }

    return {
      error: `Provider ${provider} not connected. Connect it in your dashboard or set ${envKeyMap[provider] ?? provider + '_API_KEY'} env var.`,
      status: 400,
    };
  }

  // Akash may not require an API key (depends on deployment config)
  // but must have a gatewayUrl in metadata
  if (provider === 'AKASH') {
    const meta = connection.metadata as Record<string, unknown> | null;
    if (!meta?.gatewayUrl) {
      return { error: `Akash provider requires a deployment URL in metadata.gatewayUrl.`, status: 400 };
    }
    return { apiKey: connection.encryptedApiKey ? decrypt(connection.encryptedApiKey) : '', metadata: meta };
  }

  if (!connection.encryptedApiKey) {
    return { error: `Provider ${provider} has no API key stored.`, status: 400 };
  }

  return { apiKey: decrypt(connection.encryptedApiKey), metadata: connection.metadata as Record<string, unknown> | null };
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Billing helpers (fire-and-forget)
// ---------------------------------------------------------------------------

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
  prisma.proxyRequest
    .create({ data: { apiKeyId, ...data } })
    .catch((err: unknown) => {
      console.error('[v1/chat/completions] Failed to log request:', err);
    });
}

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
          `[v1/chat/completions] Credits covered $${result.totalConsumed.toFixed(6)} of $${costUsd.toFixed(6)}. ` +
            `Remaining: $${result.remainingCost.toFixed(6)} (${result.consumed.length} source(s))`,
        );
      }
    } catch (creditErr) {
      console.error('[v1/chat/completions] Credit consumption error:', creditErr);
    }
  })();
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

function estimateInputTokens(messages: any[]): number {
  if (!messages || !Array.isArray(messages)) return 0;
  return (
    messages.reduce(
      (sum: number, m: any) =>
        sum + (typeof m.content === 'string' ? m.content.length : 0),
      0,
    ) / 4
  );
}

// ---------------------------------------------------------------------------
// OpenAI -> Anthropic body transformation
// ---------------------------------------------------------------------------

function transformToAnthropicBody(
  body: Record<string, any>,
): Record<string, any> {
  const { messages, model, max_tokens, stream, temperature, top_p, ...rest } =
    body;

  // Extract system message(s) from the messages array
  const systemMessages: string[] = [];
  const nonSystemMessages: any[] = [];

  for (const msg of messages ?? []) {
    if (msg.role === 'system') {
      systemMessages.push(
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      );
    } else {
      nonSystemMessages.push(msg);
    }
  }

  const anthropicBody: Record<string, any> = {
    model,
    messages: nonSystemMessages,
    max_tokens: max_tokens ?? 1024,
  };

  if (systemMessages.length > 0) {
    anthropicBody.system = systemMessages.join('\n\n');
  }

  if (stream !== undefined) anthropicBody.stream = stream;
  if (temperature !== undefined) anthropicBody.temperature = temperature;
  if (top_p !== undefined) anthropicBody.top_p = top_p;

  return anthropicBody;
}

// ---------------------------------------------------------------------------
// Strip InferLane extension fields from request body
// ---------------------------------------------------------------------------

function stripCgExtensions(body: Record<string, any>): Record<string, any> {
  const { il_routing, il_budget, ...clean } = body;
  return clean;
}

// ---------------------------------------------------------------------------
// Streaming response handler
// ---------------------------------------------------------------------------

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
    return NextResponse.json(
      { error: 'Provider returned no body for streaming' },
      { status: 502 },
    );
  }

  const { stream: transformStream, getAccumulator } =
    createStreamTransformer(provider);

  const transformedStream = providerRes.body.pipeThrough(transformStream);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = transformedStream.getReader();

  // Stream data through, then log billing when complete
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (err) {
      console.error('[v1/chat/completions] Stream error:', err);
    } finally {
      await writer.close();

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
      Connection: 'keep-alive',
      'X-IL-Request-Id': `il-${Date.now()}`,
      'X-IL-Routed-To': provider,
      'X-IL-Routing-Reason': routingReason,
    },
  });
}

// ---------------------------------------------------------------------------
// Forward to a specific provider (used by primary + fallback)
// ---------------------------------------------------------------------------

async function forwardToProvider(
  provider: string,
  body: Record<string, any>,
  userId: string,
  apiKeyId: string,
  resolvedModel: string,
  routingReason: string,
  isStreaming: boolean,
  startTime: number,
): Promise<
  | { response: Response; retryable: boolean }
  | { error: string; status: number; retryable: boolean }
> {
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
  const targetUrl = buildTargetUrl(provider, body.model, creds.apiKey, isStreaming, creds.metadata);

  // Transform request body for non-OpenAI providers
  let providerBody: Record<string, any>;
  if (provider === 'ANTHROPIC') {
    providerBody = transformToAnthropicBody(body);
  } else {
    providerBody = { ...body };
  }

  // Strip provider prefix from model name for decentralized providers
  // e.g., "bittensor/llama-3.3-70b" → "llama-3.3-70b" for the upstream API
  const DECENTRAL_PREFIXES = ['bittensor/', 'akash/', 'hyperbolic/'];
  for (const prefix of DECENTRAL_PREFIXES) {
    if (providerBody.model?.startsWith(prefix)) {
      providerBody.model = providerBody.model.slice(prefix.length);
      break;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const providerRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(providerBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (RETRYABLE_STATUS_CODES.has(providerRes.status)) {
      return {
        error: `Provider ${provider} returned ${providerRes.status}`,
        status: providerRes.status,
        retryable: true,
      };
    }

    // -- Streaming path --
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

    // -- Non-streaming path --
    const latencyMs = Date.now() - startTime;
    const responseData = await providerRes.json();

    const inputTokens =
      responseData?.usage?.input_tokens ||
      responseData?.usage?.prompt_tokens ||
      0;
    const outputTokens =
      responseData?.usage?.output_tokens ||
      responseData?.usage?.completion_tokens ||
      0;

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

    if (costUsd > 0 && providerRes.status >= 200 && providerRes.status < 300) {
      consumeCreditsAsync(apiKeyId, userId, costUsd);
    }

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

    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError';
    console.error(
      `[v1/chat/completions] ${provider} ${isTimeout ? 'timeout' : 'error'}:`,
      error,
    );
    return {
      error: isTimeout
        ? `Provider ${provider} timed out`
        : `Failed to reach ${provider}`,
      status: 502,
      retryable: true,
    };
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/chat/completions
// ---------------------------------------------------------------------------

async function handler(req: NextRequest) {
  // -- Authenticate --
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid or missing API key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      },
      { status: 401 },
    );
  }

  // Proxy requests require an API key for billing — session auth is not sufficient
  if (auth.authMethod === 'session') {
    return NextResponse.json(
      {
        error: {
          message: 'API key required for proxy requests. Session auth is not supported on this endpoint.',
          type: 'authentication_error',
          code: 'api_key_required',
        },
      },
      { status: 401 },
    );
  }

  const apiKeyId = auth.apiKeyId!;
  const userId = auth.userId;

  // -- Rate limit: 100 req/min per API key --
  const rl = await rateLimit(`v1chat:${apiKeyId}`, 100, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
      },
      { status: 429 },
    );
  }

  // -- Parse body --
  let reqBody: Record<string, any>;
  try {
    reqBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid JSON body',
          type: 'invalid_request_error',
          code: 'invalid_json',
        },
      },
      { status: 400 },
    );
  }

  const model = reqBody.model;
  if (!model || typeof model !== 'string') {
    return NextResponse.json(
      {
        error: {
          message: '`model` is required',
          type: 'invalid_request_error',
          code: 'missing_model',
        },
      },
      { status: 400 },
    );
  }

  const isStreaming = reqBody.stream === true;

  // -- Extract CG extensions from headers and body --
  const routingHeader = req.headers.get('x-il-routing');
  const budgetHeader = req.headers.get('x-il-budget');

  const routingStrategy: RoutingStrategy =
    (routingHeader as RoutingStrategy) ||
    (reqBody.il_routing as RoutingStrategy) ||
    'direct';

  const budget =
    budgetHeader !== null
      ? parseFloat(budgetHeader)
      : reqBody.il_budget !== undefined
        ? parseFloat(reqBody.il_budget)
        : undefined;

  // Strip CG extensions before forwarding
  const cleanBody = stripCgExtensions(reqBody);

  // -- Detect provider from model name --
  const provider = detectProvider(model);

  // -- Smart routing --
  const estimatedInput = estimateInputTokens(reqBody.messages);
  const estimatedOutput = reqBody.max_tokens ?? 500;

  const routingDecision = await routeRequest({
    userId,
    model,
    provider: provider !== 'UNKNOWN' ? provider : undefined,
    routing: routingStrategy,
    budget,
    estimatedInputTokens: estimatedInput || 1000,
    estimatedOutputTokens: estimatedOutput,
  });

  // -- Budget gate --
  if (budget !== undefined && routingDecision.budgetExceeded) {
    return NextResponse.json(
      {
        error: {
          message: 'Estimated cost exceeds budget',
          type: 'budget_exceeded',
          code: 'budget_exceeded',
        },
        estimatedCost: routingDecision.estimatedCost,
        budget,
        cheapestModel: routingDecision.model,
        cheapestProvider: routingDecision.provider,
      },
      { status: 402 },
    );
  }

  // -- Build forwarding body with routed model --
  const targetProvider = routingDecision.provider;
  const targetModel = routingDecision.model;
  const routingReason = routingDecision.reasonCode;

  const forwardBody: Record<string, any> = {
    ...cleanBody,
    model: targetModel,
    stream: isStreaming,
  };

  const startTime = Date.now();

  // -- Forward to primary provider --
  const primaryResult = await forwardToProvider(
    targetProvider,
    forwardBody,
    userId,
    apiKeyId,
    model,
    routingReason,
    isStreaming,
    startTime,
  );

  // Success on primary
  if ('response' in primaryResult) {
    const res = primaryResult.response;
    if (routingDecision.savings && routingDecision.savings > 0) {
      res.headers.set('X-IL-Savings', routingDecision.savings.toFixed(6));
    }
    if (routingDecision.alternativeProvider) {
      res.headers.set(
        'X-IL-Alternative',
        `${routingDecision.alternativeProvider}/${routingDecision.alternativeModel}`,
      );
    }
    return res;
  }

  // -- Fallback: retry on equivalent provider if primary failed --
  if (primaryResult.retryable && routingDecision.fallbackProvider) {
    console.log(
      `[v1/chat/completions] Primary ${targetProvider} failed (${primaryResult.status}), ` +
        `falling back to ${routingDecision.fallbackProvider}/${routingDecision.fallbackModel}`,
    );

    const fallbackProvider = routingDecision.fallbackProvider;
    const fallbackModel = routingDecision.fallbackModel!;

    const fallbackBody: Record<string, any> = {
      ...cleanBody,
      model: fallbackModel,
      stream: isStreaming,
    };

    const fallbackResult = await forwardToProvider(
      fallbackProvider,
      fallbackBody,
      userId,
      apiKeyId,
      model,
      'fallback_retry',
      isStreaming,
      Date.now(),
    );

    if ('response' in fallbackResult) {
      fallbackResult.response.headers.set('X-IL-Fallback', 'true');
      fallbackResult.response.headers.set(
        'X-IL-Fallback-From',
        `${targetProvider}/${targetModel}`,
      );
      fallbackResult.response.headers.set(
        'X-IL-Fallback-To',
        `${fallbackProvider}/${fallbackModel}`,
      );
      return fallbackResult.response;
    }

    // Both failed
    return NextResponse.json(
      {
        error: {
          message: `Both primary (${targetProvider}) and fallback (${fallbackProvider}) failed`,
          type: 'provider_error',
          code: 'all_providers_failed',
        },
        primaryError: primaryResult.error,
        fallbackError: fallbackResult.error,
      },
      { status: 502 },
    );
  }

  // No fallback available
  return NextResponse.json(
    {
      error: {
        message: primaryResult.error,
        type: 'provider_error',
        code: 'provider_failed',
      },
    },
    { status: primaryResult.status },
  );
}

export const POST = handler;
