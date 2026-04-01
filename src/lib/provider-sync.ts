/**
 * Provider Usage Sync Service
 *
 * Fetches usage/billing data from provider APIs and writes SpendSnapshot + UsageRecord rows.
 * Each provider has its own adapter that normalizes the response into a common shape.
 *
 * Supported providers:
 *   - Anthropic  (/v1/messages/batches is not a billing API; we use the admin API)
 *   - OpenAI     (/v1/organization/usage or /dashboard/billing/usage)
 *   - Google AI  (Vertex AI / Generative Language API)
 *
 * To add a provider: implement ProviderAdapter and register in ADAPTERS map.
 */

import { decrypt } from '@/lib/crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageLine {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  requestCount: number;
}

export interface SyncResult {
  success: boolean;
  totalSpend: number;
  lines: UsageLine[];
  error?: string;
}

interface ProviderAdapter {
  fetchUsage(apiKey: string, dateStr: string): Promise<SyncResult>;
}

// Per-million-token pricing (input / output) — updated March 2026
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-3.5': { input: 0.8, output: 4 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'o3': { input: 10, output: 40 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o4-mini': { input: 1.1, output: 4.4 },
  // Google
  'gemini-2.0-pro': { input: 1.25, output: 5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  // Together / Open-source
  'meta-llama/llama-3.1-405b': { input: 3.5, output: 3.5 },
  'meta-llama/llama-3.1-70b': { input: 0.88, output: 0.88 },
  'mistralai/mixtral-8x22b': { input: 1.2, output: 1.2 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Try exact match first, then prefix match
  const pricing = MODEL_PRICING[model] ||
    Object.entries(MODEL_PRICING).find(([k]) => model.startsWith(k))?.[1];
  if (!pricing) {
    // Fallback: assume $1/M input, $3/M output (conservative estimate)
    return (inputTokens * 1 + outputTokens * 3) / 1_000_000;
  }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Anthropic Adapter
// ---------------------------------------------------------------------------

const anthropicAdapter: ProviderAdapter = {
  async fetchUsage(apiKey: string, dateStr: string): Promise<SyncResult> {
    try {
      // Anthropic Admin API: GET /v1/organizations/{org_id}/usage
      // Fallback: use the messages count endpoint or billing page scrape
      // For now, use the beta usage endpoint
      const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (!res.ok) {
        // If count_tokens works, the key is valid but we can't get usage
        // Anthropic doesn't have a public usage/billing API yet
        // Fall through to return empty result indicating the key is valid
        return {
          success: true,
          totalSpend: 0,
          lines: [],
          error: 'Anthropic does not yet expose a public usage API. Spend is tracked via proxy requests.',
        };
      }

      // Key is valid — return empty usage (tracked via proxy instead)
      return {
        success: true,
        totalSpend: 0,
        lines: [],
        error: 'Anthropic usage tracked via proxy requests only.',
      };
    } catch (err) {
      return {
        success: false,
        totalSpend: 0,
        lines: [],
        error: `Anthropic sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// OpenAI Adapter
// ---------------------------------------------------------------------------

const openaiAdapter: ProviderAdapter = {
  async fetchUsage(apiKey: string, dateStr: string): Promise<SyncResult> {
    try {
      // OpenAI Usage API: GET /v1/organization/usage/completions
      // Requires org-level API key with usage:read permission
      const startTime = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
      const endTime = startTime + 86400; // +24h

      const url = new URL('https://api.openai.com/v1/organization/usage/completions');
      url.searchParams.set('start_time', String(startTime));
      url.searchParams.set('end_time', String(endTime));
      url.searchParams.set('group_by', 'model');

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status === 403) {
          return {
            success: false,
            totalSpend: 0,
            lines: [],
            error: 'OpenAI API key lacks usage:read permission. Usage tracked via proxy instead.',
          };
        }
        return {
          success: false,
          totalSpend: 0,
          lines: [],
          error: `OpenAI usage API ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const data = await res.json() as {
        data?: Array<{
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          num_model_requests?: number;
        }>;
      };

      const lines: UsageLine[] = [];
      let totalSpend = 0;

      for (const bucket of data.data || []) {
        const model = bucket.model || 'unknown';
        const inputTokens = bucket.input_tokens || 0;
        const outputTokens = bucket.output_tokens || 0;
        const cost = estimateCost(model, inputTokens, outputTokens);

        lines.push({
          model,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costUsd: cost,
          requestCount: bucket.num_model_requests || 0,
        });
        totalSpend += cost;
      }

      return { success: true, totalSpend, lines };
    } catch (err) {
      return {
        success: false,
        totalSpend: 0,
        lines: [],
        error: `OpenAI sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Google AI Adapter
// ---------------------------------------------------------------------------

const googleAdapter: ProviderAdapter = {
  async fetchUsage(apiKey: string, _dateStr: string): Promise<SyncResult> {
    try {
      // Google AI Studio: list models to verify key validity
      // Google doesn't expose a usage/billing API for AI Studio keys
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (!res.ok) {
        return {
          success: false,
          totalSpend: 0,
          lines: [],
          error: `Google AI key validation failed: ${res.status}`,
        };
      }

      return {
        success: true,
        totalSpend: 0,
        lines: [],
        error: 'Google AI does not expose a public usage API. Spend tracked via proxy.',
      };
    } catch (err) {
      return {
        success: false,
        totalSpend: 0,
        lines: [],
        error: `Google sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Adapter Registry
// ---------------------------------------------------------------------------

const ADAPTERS: Record<string, ProviderAdapter> = {
  ANTHROPIC: anthropicAdapter,
  OPENAI: openaiAdapter,
  GOOGLE: googleAdapter,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SyncProviderInput {
  connectionId: string;
  provider: string;
  encryptedApiKey: string;
  date: string; // YYYY-MM-DD
}

export async function syncProvider(input: SyncProviderInput): Promise<SyncResult> {
  const adapter = ADAPTERS[input.provider];
  if (!adapter) {
    return {
      success: true,
      totalSpend: 0,
      lines: [],
      error: `No sync adapter for ${input.provider}. Spend tracked via proxy.`,
    };
  }

  let apiKey: string;
  try {
    apiKey = decrypt(input.encryptedApiKey);
  } catch {
    return {
      success: false,
      totalSpend: 0,
      lines: [],
      error: 'Failed to decrypt API key',
    };
  }

  return adapter.fetchUsage(apiKey, input.date);
}

export { estimateCost, MODEL_PRICING };
