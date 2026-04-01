// ---------------------------------------------------------------------------
// Prompt Scheduler — Core Engine (Stream Z2)
// ---------------------------------------------------------------------------
// Checks executable prompts on cron ticks, runs them against provider APIs,
// records results, and manages chain progression.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { calculateCost, findModelPrice } from '@/lib/pricing/model-prices';
import { getCurrentCostMultiplier } from '@/lib/scheduler/optimizer';
import { evaluateQueuedPrompts } from '@/lib/scheduler/smart-queue';
import { promptAwareScheduler, type QueueItem } from '@/lib/scheduler/prompt-aware';

// -- Inline types (no generated Prisma imports) --

interface ScheduledPrompt {
  id: string;
  userId: string;
  title: string;
  status: string;
  priority: string;
  model: string;
  systemPrompt: string | null;
  messages: any;
  parameters: any;
  scheduleType: string;
  scheduledAt: Date | null;
  cronExpression: string | null;
  promotionFilter: any;
  priceThreshold: any;
  executedAt: Date | null;
  response: string | null;
  tokensUsed: any;
  costCents: number | null;
  savingsCents: number | null;
  error: string | null;
  batchId: string | null;
  dependsOn: string[];
  chainIndex: number | null;
  promotionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProviderPromotion {
  id: string;
  provider: string;
  title: string;
  multiplier: number;
  offPeakOnly: boolean;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  peakTimezone: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

// ---------------------------------------------------------------------------
// 1. Check which scheduled prompts are ready to execute
// ---------------------------------------------------------------------------

export async function checkExecutablePrompts(): Promise<ScheduledPrompt[]> {
  // Cross-platform price scan: evaluate PRICE_TRIGGERED and OPTIMAL_WINDOW
  // prompts against ALL connected providers before the standard trigger checks.
  // This may promote some QUEUED prompts to SCHEDULED if a cheap path is found.
  try {
    await evaluateQueuedPrompts();
  } catch (err) {
    // Non-fatal — fall through to standard trigger logic
    console.error('[SmartQueue] Cross-platform evaluation error:', err);
  }

  const prompts = await prisma.scheduledPrompt.findMany({
    where: { status: { in: ['QUEUED', 'SCHEDULED'] } },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  const now = new Date();
  const executable: ScheduledPrompt[] = [];

  for (const prompt of prompts) {
    const ready = await isExecutionReady(prompt, now);
    if (ready) {
      executable.push(prompt as ScheduledPrompt);
    }
  }

  // PARS: reorder executable batch by Shortest-Job-First priority
  if (executable.length > 1) {
    const queueItems: QueueItem[] = executable.map((p) => {
      const msgs = p.messages as any[];
      const promptText = Array.isArray(msgs)
        ? msgs.map((m: any) => (typeof m.content === 'string' ? m.content : '')).join(' ')
        : '';

      return {
        id: p.id,
        prompt: promptText,
        model: p.model,
        queuedAt: p.createdAt,
        isPremium: p.priority === 'premium',
        deadline: p.scheduledAt ?? undefined,
      };
    });

    const ranked = promptAwareScheduler.rankQueue(queueItems);
    const idOrder = new Map(ranked.map((item, idx) => [item.id, idx]));

    executable.sort(
      (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
    );

    // Attach workload estimates to prompt metadata for downstream consumers
    for (const item of ranked) {
      const prompt = executable.find((p) => p.id === item.id);
      if (prompt) {
        const params = (prompt.parameters as Record<string, any>) || {};
        params._workloadEstimate = {
          estimatedTokens: item.estimatedTokens,
          estimatedLatencyMs: item.estimatedLatencyMs,
        };
        (prompt as any).parameters = params;
      }
    }
  }

  return executable;
}

async function isExecutionReady(prompt: any, now: Date): Promise<boolean> {
  switch (prompt.scheduleType) {
    case 'IMMEDIATE':
      return true;

    case 'TIME_BASED':
      return prompt.scheduledAt != null && now >= prompt.scheduledAt;

    case 'PROMOTION_TRIGGERED':
      return await checkPromotionTrigger(prompt);

    case 'PRICE_TRIGGERED':
      return checkPriceTrigger(prompt);

    case 'RECURRING':
      return prompt.cronExpression
        ? simpleCronMatch(prompt.cronExpression, now)
        : false;

    case 'OPTIMAL_WINDOW':
      return await checkOptimalWindow(prompt);

    default:
      return false;
  }
}

async function checkPromotionTrigger(prompt: any): Promise<boolean> {
  const filter = prompt.promotionFilter as Record<string, any> | null;
  if (!filter) return false;

  const now = new Date();
  const where: any = {
    status: 'ACTIVE',
    startsAt: { lte: now },
    endsAt: { gte: now },
  };

  if (filter.provider) where.provider = filter.provider;
  if (filter.minMultiplier) where.multiplier = { gte: filter.minMultiplier };

  const promotion = await prisma.providerPromotion.findFirst({ where });
  return promotion != null;
}

function checkPriceTrigger(prompt: any): boolean {
  const threshold = prompt.priceThreshold as Record<string, any> | null;
  if (!threshold) return false;

  const price = findModelPrice(prompt.model);
  if (!price) return false;

  // threshold: { maxInputPerMToken?: number, maxOutputPerMToken?: number }
  if (threshold.maxInputPerMToken && price.inputPerMToken > threshold.maxInputPerMToken) {
    return false;
  }
  if (threshold.maxOutputPerMToken && price.outputPerMToken > threshold.maxOutputPerMToken) {
    return false;
  }

  return true;
}

async function checkOptimalWindow(prompt: any): Promise<boolean> {
  const provider = getProviderFromModel(prompt.model);

  // Use optimizer to check if current cost multiplier indicates a deal
  const multiplier = await getCurrentCostMultiplier(provider);
  if (multiplier.multiplier > 1) return true; // Promotion active — bonus multiplier means cheaper

  // Also check off-peak window (outside 8AM-6PM ET)
  const hour = getHourInTimezone(new Date(), 'America/New_York');
  return hour < 8 || hour >= 18;
}

// ---------------------------------------------------------------------------
// 2. Execute a single scheduled prompt
// ---------------------------------------------------------------------------

export async function executePrompt(promptId: string): Promise<{
  success: boolean;
  error?: string;
  tokensUsed?: { input: number; output: number };
  costCents?: number;
  savingsCents?: number;
}> {
  // Mark as RUNNING
  const prompt = await prisma.scheduledPrompt.update({
    where: { id: promptId },
    data: { status: 'RUNNING' },
  });

  try {
    // Check dependency chain
    if (prompt.dependsOn.length > 0) {
      const deps = await prisma.scheduledPrompt.findMany({
        where: { id: { in: prompt.dependsOn } },
        select: { id: true, status: true },
      });

      const allCompleted = deps.every((d: any) => d.status === 'COMPLETED');
      if (!allCompleted) {
        // Revert to SCHEDULED — dependencies not met yet
        await prisma.scheduledPrompt.update({
          where: { id: promptId },
          data: { status: 'SCHEDULED' },
        });
        return { success: false, error: 'Dependencies not yet completed' };
      }
    }

    // Build messages — inject previous chain step response if chainIndex > 0
    let messages = prompt.messages as any[];
    if (prompt.chainIndex != null && prompt.chainIndex > 0 && prompt.dependsOn.length > 0) {
      const previousStep = await prisma.scheduledPrompt.findFirst({
        where: {
          id: { in: prompt.dependsOn },
          status: 'COMPLETED',
        },
        orderBy: { chainIndex: 'desc' },
        select: { response: true },
      });

      if (previousStep?.response) {
        const { injectPreviousResponse } = await import('./chains');
        messages = injectPreviousResponse(messages, previousStep.response);
      }
    }

    // Get provider connection + API key
    const provider = getProviderFromModel(prompt.model);
    const connection = await prisma.providerConnection.findFirst({
      where: {
        userId: prompt.userId,
        provider: provider as any,
        isActive: true,
        encryptedApiKey: { not: null },
      },
    });

    if (!connection || !connection.encryptedApiKey) {
      throw new Error(`No active ${provider} connection found for user`);
    }

    const apiKey = decrypt(connection.encryptedApiKey);
    const params = prompt.parameters as Record<string, any>;

    // Make API call
    const endpoint = getProviderEndpoint(prompt.model);
    const startTime = Date.now();
    const apiResponse = await callProviderAPI(
      provider,
      endpoint,
      apiKey,
      prompt.model,
      prompt.systemPrompt,
      messages,
      params,
    );
    const latencyMs = Date.now() - startTime;

    // Extract tokens
    const inputTokens = apiResponse.inputTokens || 0;
    const outputTokens = apiResponse.outputTokens || 0;
    const costUsd = calculateCost(prompt.model, inputTokens, outputTokens);
    const costCents = costUsd * 100;

    // Check for active promotion to calculate savings
    const now = new Date();
    const activePromo = await prisma.providerPromotion.findFirst({
      where: {
        provider,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    const savingsCents = calculateSavings(costCents, activePromo as ProviderPromotion | null);

    // Update prompt with results
    await prisma.scheduledPrompt.update({
      where: { id: promptId },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
        response: apiResponse.content,
        tokensUsed: { input: inputTokens, output: outputTokens },
        costCents,
        savingsCents,
        promotionId: activePromo?.id || null,
      },
    });

    // Check if next chain step is ready
    if (prompt.batchId && prompt.chainIndex != null) {
      const nextStep = await prisma.scheduledPrompt.findFirst({
        where: {
          batchId: prompt.batchId,
          chainIndex: prompt.chainIndex + 1,
          status: { in: ['QUEUED', 'SCHEDULED'] },
        },
      });

      if (nextStep) {
        await prisma.scheduledPrompt.update({
          where: { id: nextStep.id },
          data: { status: 'SCHEDULED' },
        });
      }
    }

    return {
      success: true,
      tokensUsed: { input: inputTokens, output: outputTokens },
      costCents,
      savingsCents,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await prisma.scheduledPrompt.update({
      where: { id: promptId },
      data: {
        status: 'FAILED',
        error: errMsg.slice(0, 1000),
        executedAt: new Date(),
      },
    });
    return { success: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// 3. Provider endpoint mapping
// ---------------------------------------------------------------------------

export function getProviderEndpoint(model: string): string {
  const m = model.toLowerCase();

  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) {
    return 'https://api.openai.com/v1/chat/completions';
  }
  if (m.startsWith('gemini-')) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }
  if (m.startsWith('deepseek-')) {
    return 'https://api.deepseek.com/v1/chat/completions';
  }
  if (m.startsWith('grok-')) {
    return 'https://api.x.ai/v1/chat/completions';
  }
  if (m.startsWith('mistral-')) {
    return 'https://api.mistral.ai/v1/chat/completions';
  }
  if (m.startsWith('command-')) {
    return 'https://api.cohere.com/v1/chat';
  }
  if (m.startsWith('llama-') || m.startsWith('mixtral-')) {
    return 'https://api.together.xyz/v1/chat/completions';
  }
  if (m.startsWith('sonar')) {
    return 'https://api.perplexity.ai/chat/completions';
  }

  // Default: Anthropic (claude-*)
  return 'https://api.anthropic.com/v1/messages';
}

export function getProviderFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith('claude-')) return 'ANTHROPIC';
  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) return 'OPENAI';
  if (m.startsWith('gemini-')) return 'GOOGLE';
  if (m.startsWith('deepseek-')) return 'DEEPSEEK';
  if (m.startsWith('grok-')) return 'XAI';
  if (m.startsWith('mistral-')) return 'MISTRAL';
  if (m.startsWith('command-')) return 'COHERE';
  if (m.startsWith('sonar')) return 'PERPLEXITY';
  if (m.startsWith('llama-') || m.startsWith('mixtral-')) return 'TOGETHER';
  return 'ANTHROPIC';
}

// ---------------------------------------------------------------------------
// 4. Provider API call
// ---------------------------------------------------------------------------

async function callProviderAPI(
  provider: string,
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string | null,
  messages: any[],
  params: Record<string, any>,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const maxTokens = params.maxTokens || 4096;
  const temperature = params.temperature ?? 1.0;

  if (provider === 'ANTHROPIC') {
    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data.content?.map((c: any) => c.text).join('') || '';
    return {
      content,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  }

  if (provider === 'GOOGLE') {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}key=${apiKey}`;

    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: any = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google API error ${res.status}: ${errBody.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    return {
      content,
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  // OpenAI-compatible (OpenAI, DeepSeek, Together, Groq, xAI, Mistral, Perplexity, etc.)
  const oaiMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const body = {
    model,
    messages: oaiMessages,
    max_tokens: maxTokens,
    temperature,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${provider} API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

// ---------------------------------------------------------------------------
// 5. Savings calculation
// ---------------------------------------------------------------------------

export function calculateSavings(
  costCents: number,
  promotion: ProviderPromotion | null,
): number {
  if (!promotion || promotion.multiplier <= 1) return 0;

  // If we ran during a promotion with multiplier > 1 (e.g., 2x credits),
  // the effective cost saving is: costCents - (costCents / multiplier)
  const effectiveCost = costCents / promotion.multiplier;
  return Math.round((costCents - effectiveCost) * 100) / 100;
}

// ---------------------------------------------------------------------------
// 6. Simple 5-field cron parser (min hour dom month dow)
// ---------------------------------------------------------------------------

export function simpleCronMatch(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const checks = [
    { field: fields[0], value: date.getMinutes() },
    { field: fields[1], value: date.getHours() },
    { field: fields[2], value: date.getDate() },
    { field: fields[3], value: date.getMonth() + 1 },
    { field: fields[4], value: date.getDay() },
  ];

  return checks.every(({ field, value }) => cronFieldMatches(field, value));
}

function cronFieldMatches(field: string, value: number): boolean {
  // Wildcard
  if (field === '*') return true;

  // Step: */N
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return false;
    return value % step === 0;
  }

  // List: 1,3,5
  if (field.includes(',')) {
    return field.split(',').some(part => cronFieldMatches(part.trim(), value));
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end)) return false;
    return value >= start && value <= end;
  }

  // Exact number
  const num = parseInt(field, 10);
  if (isNaN(num)) return false;
  return value === num;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatted = date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatted, 10);
  } catch {
    // Fallback to UTC
    return date.getUTCHours();
  }
}
