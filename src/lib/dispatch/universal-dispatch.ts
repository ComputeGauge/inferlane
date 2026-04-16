// ---------------------------------------------------------------------------
// Universal Dispatch — "Dispatch Anywhere, Execute Anywhere" (Stream D1)
// ---------------------------------------------------------------------------
// Single entry point that accepts work from any device (phone, desktop, API,
// MCP) and routes it to the best available provider or decentralized node.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { routeRequest, type RoutingStrategy } from '@/lib/proxy/router';
import { calculateCost } from '@/lib/pricing/model-prices';
import { capacityOrchestrator } from '@/lib/nodes/orchestrator';
import { type AIProvider } from '@/generated/prisma/enums';
import crypto from 'crypto';
import { isAllowedWebhookUrl } from '@/lib/security/ssrf-guard';
import { emitSSE } from '@/lib/events';
import { DEFAULT_ANTHROPIC, normalizeAnthropicModel } from '@/lib/providers/anthropic-models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DispatchRequest {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  sessionId?: string;
  routing?: 'auto' | 'cheapest' | 'fastest' | 'quality' | 'decentralized_only' | 'centralized_only';
  priority?: 'realtime' | 'standard' | 'batch';
  deliveryMethod?: 'sync' | 'webhook' | 'poll';
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  taskId: string;
  status: 'executing' | 'queued' | 'completed';
  provider?: string;
  model?: string;
  result?: {
    content: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  };
  estimatedCompletionMs?: number;
  pollUrl?: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Map dispatch routing to router RoutingStrategy
// ---------------------------------------------------------------------------

function toRoutingStrategy(
  routing: DispatchRequest['routing'],
): RoutingStrategy {
  switch (routing) {
    case 'cheapest':
      return 'cheapest';
    case 'fastest':
      return 'fastest';
    case 'quality':
      return 'quality';
    case 'auto':
    case 'decentralized_only':
    case 'centralized_only':
    default:
      return 'auto';
  }
}

// ---------------------------------------------------------------------------
// Webhook delivery with retry
// ---------------------------------------------------------------------------

async function postWebhook(
  url: string,
  payload: unknown,
  attempt = 1,
): Promise<{ ok: boolean; error?: string }> {
  if (!isAllowedWebhookUrl(url)) {
    return { ok: false, error: 'Webhook URL is not allowed (must be public HTTPS)' };
  }

  const MAX_RETRIES = 3;
  const BACKOFF = [1000, 2000, 4000];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true };

    const errText = await res.text().catch(() => 'unknown');
    const msg = `HTTP ${res.status}: ${errText.slice(0, 200)}`;

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BACKOFF[attempt - 1]));
      return postWebhook(url, payload, attempt + 1);
    }

    return { ok: false, error: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BACKOFF[attempt - 1]));
      return postWebhook(url, payload, attempt + 1);
    }

    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Universal Dispatcher
// ---------------------------------------------------------------------------

class UniversalDispatcher {
  // ── Main entry point ───────────────────────────────────────────────────

  async dispatch(
    request: DispatchRequest,
    userId: string,
  ): Promise<DispatchResult> {
    const taskId = crypto.randomUUID();
    const sessionId = request.sessionId ?? crypto.randomUUID();
    const priority = request.priority ?? 'standard';
    const delivery = request.deliveryMethod ?? 'sync';

    // Build conversation messages — load session history if continuing
    const messages = await this.buildMessages(request, sessionId, userId);

    // Resolve model via routing if not specified
    const resolvedModel = await this.resolveModel(request, userId);

    // ── Realtime / sync: execute immediately ─────────────────────────
    if (priority === 'realtime' || delivery === 'sync') {
      return this.executeImmediate(
        taskId,
        sessionId,
        userId,
        request,
        resolvedModel,
        messages,
      );
    }

    // ── Standard priority: queue as IMMEDIATE ScheduledPrompt ────────
    if (priority === 'standard') {
      return this.enqueue(
        taskId,
        sessionId,
        userId,
        request,
        resolvedModel,
        messages,
        'IMMEDIATE',
      );
    }

    // ── Batch priority: queue as OPTIMAL_WINDOW ──────────────────────
    return this.enqueue(
      taskId,
      sessionId,
      userId,
      request,
      resolvedModel,
      messages,
      'OPTIMAL_WINDOW',
    );
  }

  // ── Poll for task status ───────────────────────────────────────────────

  async getTaskStatus(
    taskId: string,
    userId: string,
  ): Promise<DispatchResult | null> {
    const prompt = await prisma.scheduledPrompt.findFirst({
      where: { id: taskId, userId },
    });

    if (!prompt) return null;

    const meta = prompt.parameters as Record<string, unknown> | null;
    const sessionId = (meta?.sessionId as string) ?? '';

    const status = this.mapStatus(prompt.status);

    const result: DispatchResult = {
      taskId: prompt.id,
      status,
      provider: (meta?.resolvedProvider as string) ?? undefined,
      model: prompt.model,
      sessionId,
      pollUrl: `/api/dispatch/${prompt.id}`,
    };

    if (status === 'completed' && prompt.response) {
      const tokens = prompt.tokensUsed as Record<string, number> | null;
      result.result = {
        content: prompt.response,
        inputTokens: tokens?.inputTokens ?? 0,
        outputTokens: tokens?.outputTokens ?? 0,
        costUsd: (prompt.costCents ?? 0) / 100,
        latencyMs: (meta?.latencyMs as number) ?? 0,
      };
    }

    if (status === 'queued') {
      result.estimatedCompletionMs = 30_000; // rough default estimate
    }

    return result;
  }

  // ── Webhook delivery ───────────────────────────────────────────────────

  async deliverWebhook(taskId: string, result: unknown): Promise<void> {
    const prompt = await prisma.scheduledPrompt.findUnique({
      where: { id: taskId },
    });

    if (!prompt) return;

    const meta = prompt.parameters as Record<string, unknown> | null;
    const webhookUrl = meta?.webhookUrl as string | undefined;
    if (!webhookUrl) return;

    const delivery = await postWebhook(webhookUrl, {
      taskId,
      ...(result as Record<string, unknown>),
    });

    console.log(
      `[Dispatch] Webhook delivery for ${taskId}: ${delivery.ok ? 'success' : delivery.error}`,
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async buildMessages(
    request: DispatchRequest,
    sessionId: string,
    userId: string,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages: Array<{ role: string; content: string }> = [];

    // Prepend system prompt if provided
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    // Load session history if continuing an existing session
    if (request.sessionId) {
      try {
        const previousTasks = await prisma.scheduledPrompt.findMany({
          where: {
            userId,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });

        // Filter to tasks in the same session via metadata
        for (const task of previousTasks) {
          const meta = task.parameters as Record<string, unknown> | null;
          if (meta?.sessionId !== sessionId) continue;

          const taskMessages = task.messages as Array<{ role: string; content: string }> | null;
          if (taskMessages) {
            messages.push(...taskMessages);
          }

          if (task.response) {
            messages.push({ role: 'assistant', content: task.response });
          }
        }
      } catch (err) {
        console.error('[Dispatch] Failed to load session history:', err);
      }
    }

    // Add current prompt
    messages.push({ role: 'user', content: request.prompt });

    return messages;
  }

  private async resolveModel(
    request: DispatchRequest,
    userId: string,
  ): Promise<{ provider: string; model: string }> {
    // If model explicitly specified, route normally
    const model = normalizeAnthropicModel(request.model ?? DEFAULT_ANTHROPIC);
    const strategy = toRoutingStrategy(request.routing);

    // For decentralized_only, check OpenClaw node availability
    if (request.routing === 'decentralized_only') {
      const idleNodes = await capacityOrchestrator.getIdleNodes();
      if (idleNodes.length === 0) {
        throw new Error('No decentralized nodes available');
      }
      // Return first idle node's capabilities — simplified model resolution
      return { provider: 'OPENCLAW', model };
    }

    const decision = await routeRequest({
      userId,
      model,
      routing: strategy,
    });

    return { provider: decision.provider, model: decision.model };
  }

  private async executeImmediate(
    taskId: string,
    sessionId: string,
    userId: string,
    request: DispatchRequest,
    resolved: { provider: string; model: string },
    messages: Array<{ role: string; content: string }>,
  ): Promise<DispatchResult> {
    const start = performance.now();

    // Create the task record first
    await prisma.scheduledPrompt.create({
      data: {
        id: taskId,
        userId,
        title: `dispatch:${taskId.slice(0, 8)}`,
        model: resolved.model,
        systemPrompt: request.systemPrompt ?? null,
        messages: messages as any,
        parameters: {
          maxTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          sessionId,
          dispatchRouting: request.routing ?? 'auto',
          resolvedProvider: resolved.provider,
          deliveryMethod: request.deliveryMethod ?? 'sync',
          webhookUrl: request.webhookUrl,
          ...request.metadata,
        },
        scheduleType: 'IMMEDIATE',
        status: 'RUNNING',
        priority: 'HIGH',
      },
    });

    try {
      // Execute via the provider API through the proxy pipeline
      const providerConnection = await prisma.providerConnection.findFirst({
        where: { userId, provider: resolved.provider as AIProvider, isActive: true },
      });

      if (!providerConnection?.encryptedApiKey) {
        throw new Error(`No active API key for provider ${resolved.provider}`);
      }

      // Import decrypt inline to avoid circular dependency issues
      const { decrypt } = await import('@/lib/crypto');
      const apiKey = decrypt(providerConnection.encryptedApiKey);

      // Build request to the provider
      const providerResponse = await this.callProvider(
        resolved.provider,
        resolved.model,
        apiKey,
        messages,
        request.maxTokens ?? 4096,
        request.temperature ?? 0.7,
      );

      const latencyMs = Math.round(performance.now() - start);
      const costUsd = calculateCost(
        resolved.model,
        providerResponse.inputTokens,
        providerResponse.outputTokens,
      );

      // Update task as completed
      await prisma.scheduledPrompt.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          executedAt: new Date(),
          response: providerResponse.content,
          tokensUsed: {
            inputTokens: providerResponse.inputTokens,
            outputTokens: providerResponse.outputTokens,
          },
          costCents: Math.round(costUsd * 100),
          parameters: {
            maxTokens: request.maxTokens ?? 4096,
            temperature: request.temperature ?? 0.7,
            sessionId,
            dispatchRouting: request.routing ?? 'auto',
            resolvedProvider: resolved.provider,
            deliveryMethod: request.deliveryMethod ?? 'sync',
            webhookUrl: request.webhookUrl,
            latencyMs,
            ...request.metadata,
          },
        },
      });

      const dispatchResult: DispatchResult = {
        taskId,
        status: 'completed',
        provider: resolved.provider,
        model: resolved.model,
        result: {
          content: providerResponse.content,
          inputTokens: providerResponse.inputTokens,
          outputTokens: providerResponse.outputTokens,
          costUsd,
          latencyMs,
        },
        sessionId,
      };

      // Emit SSE event for real-time dashboard updates
      emitSSE({
        type: 'dispatch_status',
        data: {
          taskId,
          status: 'completed',
          provider: resolved.provider,
          model: resolved.model,
          costUsd,
          latencyMs,
        },
        timestamp: new Date().toISOString(),
      });

      // Fire webhook asynchronously if requested
      if (request.deliveryMethod === 'webhook' && request.webhookUrl) {
        this.deliverWebhook(taskId, dispatchResult).catch(() => {});
      }

      return dispatchResult;
    } catch (err) {
      // Mark task as failed
      await prisma.scheduledPrompt.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {});

      // Emit SSE event for failed dispatch
      emitSSE({
        type: 'dispatch_status',
        data: {
          taskId,
          status: 'failed',
          provider: resolved.provider,
          model: resolved.model,
          error: err instanceof Error ? err.message : String(err),
        },
        timestamp: new Date().toISOString(),
      });

      throw err;
    }
  }

  private async enqueue(
    taskId: string,
    sessionId: string,
    userId: string,
    request: DispatchRequest,
    resolved: { provider: string; model: string },
    messages: Array<{ role: string; content: string }>,
    scheduleType: 'IMMEDIATE' | 'OPTIMAL_WINDOW',
  ): Promise<DispatchResult> {
    await prisma.scheduledPrompt.create({
      data: {
        id: taskId,
        userId,
        title: `dispatch:${taskId.slice(0, 8)}`,
        model: resolved.model,
        systemPrompt: request.systemPrompt ?? null,
        messages: messages as any,
        parameters: {
          maxTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          sessionId,
          dispatchRouting: request.routing ?? 'auto',
          resolvedProvider: resolved.provider,
          deliveryMethod: request.deliveryMethod ?? 'poll',
          webhookUrl: request.webhookUrl,
          ...request.metadata,
        },
        scheduleType,
        status: 'QUEUED',
        priority: request.priority === 'batch' ? 'LOW' : 'NORMAL',
      },
    });

    return {
      taskId,
      status: 'queued',
      provider: resolved.provider,
      model: resolved.model,
      estimatedCompletionMs: scheduleType === 'IMMEDIATE' ? 30_000 : 300_000,
      pollUrl: `/api/dispatch/${taskId}`,
      sessionId,
    };
  }

  private mapStatus(
    dbStatus: string,
  ): 'executing' | 'queued' | 'completed' {
    switch (dbStatus) {
      case 'RUNNING':
        return 'executing';
      case 'COMPLETED':
      case 'FAILED':
        return 'completed';
      default:
        return 'queued';
    }
  }

  private async callProvider(
    provider: string,
    model: string,
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    temperature: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Unified provider call — supports OpenAI-compatible and Anthropic formats
    if (provider === 'ANTHROPIC') {
      return this.callAnthropic(apiKey, model, messages, maxTokens, temperature);
    }

    // OpenAI-compatible providers (OpenAI, Together, Groq, DeepSeek, etc.)
    return this.callOpenAICompatible(provider, apiKey, model, messages, maxTokens, temperature);
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    temperature: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Separate system message from conversation messages
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: conversationMessages,
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    return {
      content: data.content?.[0]?.text ?? '',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }

  private async callOpenAICompatible(
    provider: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    temperature: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const PROVIDER_URLS: Record<string, string> = {
      OPENAI: 'https://api.openai.com/v1/chat/completions',
      TOGETHER: 'https://api.together.xyz/v1/chat/completions',
      GROQ: 'https://api.groq.com/openai/v1/chat/completions',
      DEEPSEEK: 'https://api.deepseek.com/v1/chat/completions',
      FIREWORKS: 'https://api.fireworks.ai/inference/v1/chat/completions',
      MISTRAL: 'https://api.mistral.ai/v1/chat/completions',
      COHERE: 'https://api.cohere.com/v1/chat/completions',
      XAI: 'https://api.x.ai/v1/chat/completions',
      PERPLEXITY: 'https://api.perplexity.ai/chat/completions',
      CEREBRAS: 'https://api.cerebras.ai/v1/chat/completions',
      SAMBANOVA: 'https://api.sambanova.ai/v1/chat/completions',
      DARKBLOOM: 'https://api.darkbloom.dev/v1/chat/completions',
      CHUTES: 'https://api.chutes.ai/v1/chat/completions',
      AKASH: 'https://chatapi.akash.network/v1/chat/completions',
      NOSANA: 'https://api.nosana.io/v1/chat/completions',
    };

    const url = PROVIDER_URLS[provider];
    if (!url) {
      throw new Error(`Unsupported provider for dispatch: ${provider}`);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`${provider} API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const universalDispatcher = new UniversalDispatcher();
