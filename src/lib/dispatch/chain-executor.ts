// ---------------------------------------------------------------------------
// Multi-Provider Chain Executor (Stream D3)
// ---------------------------------------------------------------------------
// Executes sequential multi-step workflows where each step can use a
// different provider/model. Output from one step feeds into the next via
// the {{previous_output}} placeholder.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { routeRequest, type RoutingStrategy } from '@/lib/proxy/router';
import { calculateCost } from '@/lib/pricing/model-prices';
import { sessionManager } from '@/lib/dispatch/session-manager';
import { type AIProvider } from '@/generated/prisma/enums';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainStep {
  prompt: string;
  model?: string;
  provider?: string;
  routing?: string;
  maxTokens?: number;
  systemPrompt?: string;
  transformOutput?: 'raw' | 'extract_code' | 'extract_json' | 'summarize';
}

export interface ChainStepResult {
  stepIndex: number;
  provider: string;
  model: string;
  output: string;
  tokens: { input: number; output: number };
  costUsd: number;
  latencyMs: number;
}

export interface ChainExecution {
  batchId: string;
  steps: ChainStep[];
  currentStep: number;
  results: ChainStepResult[];
  status: 'running' | 'completed' | 'failed';
  totalCostUsd: number;
  sessionId?: string;
}

// Provider API endpoints
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

const PROVIDER_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Output transformers
// ---------------------------------------------------------------------------

function extractCode(text: string): string {
  // Match fenced code blocks (```...```)
  const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }

  return matches.length > 0 ? matches.join('\n\n') : text;
}

function extractJson(text: string): string {
  // Try to find JSON in the text — look for {...} or [...]
  const jsonRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/;
  const match = jsonRegex.exec(text);

  if (match) {
    try {
      // Validate it parses
      JSON.parse(match[1]);
      return match[1];
    } catch {
      // Fall through to return raw text
    }
  }

  return text;
}

function transformOutput(
  text: string,
  transform: ChainStep['transformOutput'],
): string {
  switch (transform) {
    case 'extract_code':
      return extractCode(text);
    case 'extract_json':
      return extractJson(text);
    case 'summarize':
      // Summarize is handled by prepending "Summarize: " to the next step's prompt
      return text;
    case 'raw':
    default:
      return text;
  }
}

// ---------------------------------------------------------------------------
// ChainExecutor
// ---------------------------------------------------------------------------

class ChainExecutor {
  private activeChains = new Map<string, ChainExecution>();

  // ── Execute a full chain ────────────────────────────────────────────────

  async executeChain(
    steps: ChainStep[],
    userId: string,
    sessionId?: string,
  ): Promise<ChainExecution> {
    const batchId = crypto.randomUUID();

    const execution: ChainExecution = {
      batchId,
      steps,
      currentStep: 0,
      results: [],
      status: 'running',
      totalCostUsd: 0,
      sessionId,
    };

    this.activeChains.set(batchId, execution);

    let previousOutput = '';

    for (let i = 0; i < steps.length; i++) {
      execution.currentStep = i;

      try {
        const step = steps[i];

        // Replace {{previous_output}} placeholder in prompt
        let prompt = step.prompt;
        if (previousOutput) {
          prompt = prompt.replace(/\{\{previous_output\}\}/g, previousOutput);
        }

        // If previous step had transformOutput=summarize, prepend directive
        if (i > 0 && steps[i - 1].transformOutput === 'summarize') {
          prompt = `Summarize the following, then answer the question.\n\nContent to summarize:\n${previousOutput}\n\nQuestion: ${prompt}`;
        }

        // Resolve provider/model for this step
        const resolved = await this.resolveStepProvider(step, userId);

        // Execute the step
        const start = performance.now();
        const result = await this.executeStep(
          userId,
          resolved.provider,
          resolved.model,
          prompt,
          step.systemPrompt,
          step.maxTokens ?? 4096,
        );
        const latencyMs = Math.round(performance.now() - start);

        const costUsd = calculateCost(
          resolved.model,
          result.inputTokens,
          result.outputTokens,
        );

        const stepResult: ChainStepResult = {
          stepIndex: i,
          provider: resolved.provider,
          model: resolved.model,
          output: result.content,
          tokens: { input: result.inputTokens, output: result.outputTokens },
          costUsd,
          latencyMs,
        };

        execution.results.push(stepResult);
        execution.totalCostUsd += costUsd;

        // Persist step as a ScheduledPrompt for audit trail
        prisma.scheduledPrompt.create({
          data: {
            userId,
            title: `chain:${batchId.slice(0, 8)}:step-${i}`,
            model: resolved.model,
            systemPrompt: step.systemPrompt ?? null,
            messages: [{ role: 'user', content: prompt }] as any,
            parameters: { maxTokens: step.maxTokens ?? 4096, temperature: 0.7 },
            scheduleType: 'IMMEDIATE',
            status: 'COMPLETED',
            executedAt: new Date(),
            response: result.content,
            tokensUsed: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
            costCents: Math.round(costUsd * 100),
            batchId,
            chainIndex: i,
          },
        }).catch((err) => {
          console.error(`[ChainExecutor] Failed to persist step ${i}:`, err);
        });

        // Apply output transform for the next step
        previousOutput = transformOutput(result.content, step.transformOutput);

        // Append to session if tracking
        if (sessionId) {
          sessionManager.addMessage(sessionId, {
            role: 'assistant',
            content: result.content,
            provider: resolved.provider,
            model: resolved.model,
            timestamp: Date.now(),
            tokenCount: result.inputTokens + result.outputTokens,
            costUsd,
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[ChainExecutor] Step ${i} failed:`, err);
        execution.status = 'failed';
        this.activeChains.set(batchId, execution);
        return execution;
      }
    }

    execution.status = 'completed';
    this.activeChains.set(batchId, execution);

    return execution;
  }

  // ── Get chain status ────────────────────────────────────────────────────

  async getChainStatus(batchId: string): Promise<ChainExecution | null> {
    // Check in-memory first
    const cached = this.activeChains.get(batchId);
    if (cached) return cached;

    // Fall back to database — reconstruct from persisted steps
    const steps = await prisma.scheduledPrompt.findMany({
      where: { batchId },
      orderBy: { chainIndex: 'asc' },
    });

    if (steps.length === 0) return null;

    const results: ChainStepResult[] = steps.map((step) => {
      const tokens = step.tokensUsed as Record<string, number> | null;
      const meta = step.parameters as Record<string, unknown> | null;

      return {
        stepIndex: step.chainIndex ?? 0,
        provider: (meta?.resolvedProvider as string) ?? 'unknown',
        model: step.model,
        output: step.response ?? '',
        tokens: {
          input: tokens?.inputTokens ?? 0,
          output: tokens?.outputTokens ?? 0,
        },
        costUsd: (step.costCents ?? 0) / 100,
        latencyMs: 0,
      };
    });

    const allCompleted = steps.every((s) => s.status === 'COMPLETED');
    const anyFailed = steps.some((s) => s.status === 'FAILED');

    return {
      batchId,
      steps: [], // Original step definitions not persisted — only results available
      currentStep: steps.length - 1,
      results,
      status: anyFailed ? 'failed' : allCompleted ? 'completed' : 'running',
      totalCostUsd: results.reduce((sum, r) => sum + r.costUsd, 0),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async resolveStepProvider(
    step: ChainStep,
    userId: string,
  ): Promise<{ provider: string; model: string }> {
    // If both provider and model are explicit, use them directly
    if (step.provider && step.model) {
      return { provider: step.provider.toUpperCase(), model: step.model };
    }

    const model = step.model ?? 'claude-sonnet-4';
    const routing = (step.routing as RoutingStrategy) ?? 'auto';

    const decision = await routeRequest({
      userId,
      model,
      provider: step.provider?.toUpperCase(),
      routing,
    });

    return { provider: decision.provider, model: decision.model };
  }

  private async executeStep(
    userId: string,
    provider: string,
    model: string,
    prompt: string,
    systemPrompt: string | undefined,
    maxTokens: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Get provider credentials
    const connection = await prisma.providerConnection.findFirst({
      where: { userId, provider: provider as AIProvider, isActive: true },
    });

    if (!connection?.encryptedApiKey) {
      throw new Error(`No active API key for provider ${provider}`);
    }

    const apiKey = decrypt(connection.encryptedApiKey);

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    if (provider === 'ANTHROPIC') {
      return this.callAnthropic(apiKey, model, messages, maxTokens);
    }

    return this.callOpenAICompatible(provider, apiKey, model, messages, maxTokens);
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
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

export const chainExecutor = new ChainExecutor();
