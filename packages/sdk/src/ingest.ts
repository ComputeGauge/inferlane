/**
 * @inferlane/sdk/ingest — Legacy Ingest Client
 *
 * Thin HTTP wrapper for partners (OpenClaw, LiteLLM, Portkey, etc.)
 * to send LLM usage data to InferLane's ingest rail.
 *
 * Usage:
 *   import { InferLaneIngest } from '@inferlane/sdk/ingest';
 *   const cg = new InferLaneIngest({ apiKey: 'ilp_...' });
 *   await cg.ingest([{ userRef: 'user@example.com', provider: 'OPENAI', model: 'gpt-4o', inputTokens: 500, outputTokens: 200 }]);
 */

import type { UsageRecord, IngestResponse, PartnerStats } from './types';

export interface IngestConfig {
  /** Partner callback API key (starts with ilp_) */
  apiKey: string;
  /** Base URL — defaults to https://inferlane.com */
  baseUrl?: string;
  /** Request timeout in ms — defaults to 30000 */
  timeout?: number;
}

export class InferLaneIngest {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: IngestConfig) {
    if (!config.apiKey) throw new Error('InferLaneIngest: apiKey is required');
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://inferlane.com').replace(/\/$/, '');
    this.timeout = config.timeout || 30_000;
  }

  /**
   * Send usage records to InferLane.
   * Max 1000 records per call. For larger batches, use ingestAll().
   */
  async ingest(records: UsageRecord[]): Promise<IngestResponse> {
    if (records.length === 0) throw new Error('InferLaneIngest: records array cannot be empty');
    if (records.length > 1000) throw new Error('InferLaneIngest: max 1000 records per request');

    const res = await this.fetch('/api/integrations/ingest', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`InferLaneIngest ingest failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<IngestResponse>;
  }

  /**
   * Get partner stats: referred users, usage volume, commission earned.
   */
  async stats(): Promise<PartnerStats> {
    const res = await this.fetch('/api/partners/stats', { method: 'GET' });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`InferLaneIngest stats failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<PartnerStats>;
  }

  /**
   * Convenience: batch-ingest with automatic chunking for large arrays.
   */
  async ingestAll(records: UsageRecord[]): Promise<IngestResponse> {
    const chunkSize = 1000;
    let totalAccepted = 0;
    let totalRejected = 0;
    const allErrors: string[] = [];
    const costSummary: Record<string, number> = {};

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const result = await this.ingest(chunk);
      totalAccepted += result.accepted;
      totalRejected += result.rejected;
      if (result.errors) allErrors.push(...result.errors);
      for (const [provider, cost] of Object.entries(result.costSummary || {})) {
        costSummary[provider] = (costSummary[provider] || 0) + cost;
      }
    }

    return {
      accepted: totalAccepted,
      rejected: totalRejected,
      errors: allErrors,
      costSummary,
    };
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await globalThis.fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.headers || {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
