// ---------------------------------------------------------------------------
// Darkbloom Provider Adapter — Decentralized Apple Silicon inference network
// ---------------------------------------------------------------------------
// Routes inference requests to Darkbloom's idle Mac fleet.
// Pricing: flat-rate per model (e.g. $0.20/Mtok output for Gemma 4 26B).
// Privacy tier: BEST_EFFORT (OS hardening only, no verifiable TEE).
//
// Darkbloom API is OpenAI-compatible: POST /v1/chat/completions
// ---------------------------------------------------------------------------

import { healthTracker } from './health-tracker';

export interface DarkbloomConfig {
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://api.darkbloom.dev';
const PROVIDER_ID = 'DARKBLOOM';

// Models available on Darkbloom's network with their flat-rate pricing
export const DARKBLOOM_MODELS = [
  {
    model: 'gemma-4-27b',
    inputPerMToken: 0.06,
    outputPerMToken: 0.20,
    contextWindow: 128_000,
    qualityScore: 72,
    latencyClass: 'medium' as const,
  },
  {
    model: 'gemma-4-12b',
    inputPerMToken: 0.03,
    outputPerMToken: 0.10,
    contextWindow: 128_000,
    qualityScore: 65,
    latencyClass: 'fast' as const,
  },
  {
    model: 'flux-2-klein-4b',
    inputPerMToken: 0.02,
    outputPerMToken: 0.08,
    contextWindow: 8_192,
    qualityScore: 60,
    latencyClass: 'fast' as const,
  },
  {
    model: 'flux-2-klein-9b',
    inputPerMToken: 0.04,
    outputPerMToken: 0.15,
    contextWindow: 8_192,
    qualityScore: 68,
    latencyClass: 'medium' as const,
  },
] as const;

export interface DarkbloomChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface DarkbloomChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DarkbloomAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: DarkbloomConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async chatCompletion(
    request: DarkbloomChatRequest,
  ): Promise<DarkbloomChatResponse> {
    const start = Date.now();
    let statusCode = 0;

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.max_tokens ?? 1024,
          temperature: request.temperature ?? 0.7,
          stream: false,
        }),
      });

      statusCode = res.status;
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        healthTracker.recordResult(PROVIDER_ID, latencyMs, statusCode);
        const errBody = await res.text().catch(() => '');
        throw new Error(
          `Darkbloom API error ${statusCode}: ${errBody.slice(0, 200)}`,
        );
      }

      const data: DarkbloomChatResponse = await res.json();
      healthTracker.recordResult(PROVIDER_ID, latencyMs, statusCode);
      return data;
    } catch (err) {
      if (statusCode === 0) {
        healthTracker.recordResult(PROVIDER_ID, Date.now() - start, 503);
      }
      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Returns model equivalence entries for Darkbloom models,
   * suitable for insertion into the EQUIVALENCE_TIERS system.
   */
  static getEquivalenceEntries() {
    return DARKBLOOM_MODELS.map((m) => ({
      provider: PROVIDER_ID,
      ...m,
    }));
  }

  /**
   * Privacy metadata — Darkbloom is BEST_EFFORT only.
   * No hardware TEE, no verifiable confidentiality.
   */
  static readonly PRIVACY_TIER = 'BEST_EFFORT' as const;
  static readonly PROVIDER_ID = PROVIDER_ID;
}

/**
 * Factory: create adapter from env vars or explicit config.
 */
export function createDarkbloomAdapter(
  config?: Partial<DarkbloomConfig>,
): DarkbloomAdapter | null {
  const apiKey = config?.apiKey || process.env.DARKBLOOM_API_KEY;
  if (!apiKey) return null;

  return new DarkbloomAdapter({
    apiKey,
    baseUrl: config?.baseUrl || process.env.DARKBLOOM_BASE_URL || DEFAULT_BASE_URL,
  });
}
