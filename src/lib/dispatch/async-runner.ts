// ---------------------------------------------------------------------------
// Async Task Runner (Stream D2)
// ---------------------------------------------------------------------------
// Processes queued dispatch tasks (IMMEDIATE and OPTIMAL_WINDOW). Called by
// the process-dispatch cron endpoint. Handles webhook delivery with retries.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { routeRequest, type RoutingStrategy } from '@/lib/proxy/router';
import { calculateCost } from '@/lib/pricing/model-prices';
import { sessionManager } from '@/lib/dispatch/session-manager';
import { type AIProvider } from '@/generated/prisma/enums';
import { isAllowedWebhookUrl } from '@/lib/security/ssrf-guard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskExecution {
  taskId: string;
  prompt: string;
  systemPrompt?: string;
  model: string;
  provider: string;
  maxTokens: number;
  temperature: number;
  sessionId?: string;
  webhookUrl?: string;
  routing: string;
  userId: string;
}

// Provider API endpoints (OpenAI-compatible format)
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
};

const MAX_PER_RUN = 10;
const PROVIDER_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// AsyncTaskRunner
// ---------------------------------------------------------------------------

class AsyncTaskRunner {
  // ── Process IMMEDIATE queue ─────────────────────────────────────────────

  async processQueue(): Promise<{ processed: number; failed: number }> {
    const tasks = await prisma.scheduledPrompt.findMany({
      where: {
        scheduleType: 'IMMEDIATE',
        status: 'QUEUED',
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_PER_RUN,
    });

    let processed = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        // Claim the task — set to PROCESSING to prevent double-pickup
        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: { status: 'RUNNING' },
        });

        const execution = await this.buildExecution(task);
        const result = await this.executeTask(execution);

        // Record result
        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            executedAt: new Date(),
            response: result.content,
            tokensUsed: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
            costCents: Math.round(result.costUsd * 100),
          },
        });

        // Fire webhook if configured
        if (execution.webhookUrl) {
          this.fireWebhook(execution.webhookUrl, {
            taskId: task.id,
            status: 'completed',
            result: {
              content: result.content,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: result.costUsd,
              latencyMs: result.latencyMs,
            },
          }).catch((err) => {
            console.error(`[AsyncRunner] Webhook delivery failed for ${task.id}:`, err);
          });
        }

        // Append to session if sessionId present
        if (execution.sessionId) {
          try {
            await sessionManager.addMessage(execution.sessionId, {
              role: 'assistant',
              content: result.content,
              provider: execution.provider,
              model: execution.model,
              timestamp: Date.now(),
              tokenCount: result.inputTokens + result.outputTokens,
              costUsd: result.costUsd,
            });
          } catch {
            // Session append is best-effort
          }
        }

        processed++;
      } catch (err) {
        console.error(`[AsyncRunner] Task ${task.id} failed:`, err);

        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch(() => {});

        // Fire failure webhook if configured
        const meta = task.parameters as Record<string, unknown> | null;
        const webhookUrl = (meta as any)?.webhookUrl as string | undefined;
        if (!webhookUrl) {
          const taskMeta = task.parameters as Record<string, unknown> | null;
          const metaWebhook = taskMeta?.webhookUrl as string | undefined;
          if (metaWebhook) {
            this.fireWebhook(metaWebhook, {
              taskId: task.id,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            }).catch(() => {});
          }
        }

        failed++;
      }
    }

    return { processed, failed };
  }

  // ── Process OPTIMAL_WINDOW queue ────────────────────────────────────────

  async processBatchQueue(): Promise<{ processed: number }> {
    // Check if conditions are favorable for batch execution
    const now = new Date();
    const utcHour = now.getUTCHours();
    const isOffPeak = utcHour >= 0 && utcHour <= 8;

    // Check for active promotions
    const activePromotions = await prisma.providerPromotion.findMany({
      where: { status: 'ACTIVE' },
    });

    const hasActivePromotion = activePromotions.length > 0;

    // Only execute if off-peak or promotions available
    if (!isOffPeak && !hasActivePromotion) {
      return { processed: 0 };
    }

    const tasks = await prisma.scheduledPrompt.findMany({
      where: {
        scheduleType: 'OPTIMAL_WINDOW',
        status: 'QUEUED',
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_PER_RUN,
    });

    let processed = 0;

    for (const task of tasks) {
      try {
        // Check if a matching promotion exists for this task's model/provider
        const meta = task.parameters as Record<string, unknown> | null;
        const resolvedProvider = meta?.resolvedProvider as string | undefined;

        if (!isOffPeak && resolvedProvider) {
          const matchingPromotion = activePromotions.find(
            (p) => p.provider === resolvedProvider,
          );
          if (!matchingPromotion) continue; // Skip — no favorable pricing for this provider
        }

        // Claim and execute
        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: { status: 'RUNNING' },
        });

        const execution = await this.buildExecution(task);
        const result = await this.executeTask(execution);

        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            executedAt: new Date(),
            response: result.content,
            tokensUsed: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
            costCents: Math.round(result.costUsd * 100),
          },
        });

        // Fire webhook if configured
        if (execution.webhookUrl) {
          this.fireWebhook(execution.webhookUrl, {
            taskId: task.id,
            status: 'completed',
            result: {
              content: result.content,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: result.costUsd,
              latencyMs: result.latencyMs,
            },
          }).catch(() => {});
        }

        processed++;
      } catch (err) {
        console.error(`[AsyncRunner] Batch task ${task.id} failed:`, err);

        await prisma.scheduledPrompt.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch(() => {});
      }
    }

    return { processed };
  }

  // ── Webhook delivery with retries ───────────────────────────────────────

  async fireWebhook(url: string, payload: unknown): Promise<boolean> {
    if (!isAllowedWebhookUrl(url)) {
      console.warn(`[AsyncRunner] Blocked webhook to disallowed URL: ${url}`);
      return false;
    }

    const BACKOFF = [1000, 2000, 4000];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) return true;

        console.warn(
          `[AsyncRunner] Webhook attempt ${attempt + 1} failed: HTTP ${res.status}`,
        );
      } catch (err) {
        console.warn(
          `[AsyncRunner] Webhook attempt ${attempt + 1} error:`,
          err instanceof Error ? err.message : String(err),
        );
      }

      // Wait before retry (skip wait on last attempt)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
      }
    }

    return false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async buildExecution(task: any): Promise<TaskExecution> {
    const params = task.parameters as Record<string, unknown> | null;
    const meta = (task as any).metadata as Record<string, unknown> | null;

    // Resolve provider if not already known
    let provider = (meta?.resolvedProvider as string) ?? '';
    let model = task.model;

    if (!provider) {
      const routing = (meta?.dispatchRouting as RoutingStrategy) ?? 'auto';
      const decision = await routeRequest({
        userId: task.userId,
        model,
        routing,
      });
      provider = decision.provider;
      model = decision.model;
    }

    // Extract prompt from messages
    const messages = task.messages as Array<{ role: string; content: string }> | null;
    const userMessage = messages?.findLast((m) => m.role === 'user');
    const prompt = userMessage?.content ?? '';

    return {
      taskId: task.id,
      prompt,
      systemPrompt: task.systemPrompt ?? undefined,
      model,
      provider,
      maxTokens: (params?.maxTokens as number) ?? 4096,
      temperature: (params?.temperature as number) ?? 0.7,
      sessionId: meta?.sessionId as string | undefined,
      webhookUrl: meta?.webhookUrl as string | undefined,
      routing: (meta?.dispatchRouting as string) ?? 'auto',
      userId: task.userId,
    };
  }

  private async executeTask(
    execution: TaskExecution,
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  }> {
    const start = performance.now();

    // Get provider credentials
    const connection = await prisma.providerConnection.findFirst({
      where: {
        userId: execution.userId,
        provider: execution.provider as AIProvider,
        isActive: true,
      },
    });

    if (!connection?.encryptedApiKey) {
      throw new Error(`No active API key for provider ${execution.provider}`);
    }

    const apiKey = decrypt(connection.encryptedApiKey);

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];
    if (execution.systemPrompt) {
      messages.push({ role: 'system', content: execution.systemPrompt });
    }
    messages.push({ role: 'user', content: execution.prompt });

    // Call the provider
    const result =
      execution.provider === 'ANTHROPIC'
        ? await this.callAnthropic(apiKey, execution.model, messages, execution.maxTokens, execution.temperature)
        : await this.callOpenAICompatible(execution.provider, apiKey, execution.model, messages, execution.maxTokens, execution.temperature);

    const latencyMs = Math.round(performance.now() - start);
    const costUsd = calculateCost(execution.model, result.inputTokens, result.outputTokens);

    return { ...result, costUsd, latencyMs };
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    temperature: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
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
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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
    const url = PROVIDER_URLS[provider];
    if (!url) {
      throw new Error(`Unsupported provider: ${provider}`);
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
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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

export const asyncTaskRunner = new AsyncTaskRunner();
