/**
 * @inferlane/sdk — Multi-provider LLM proxy SDK
 *
 * Usage:
 *   const cg = new InferLane({ apiKey: 'il_xxx' });
 *   const response = await cg.chat({ model: 'claude-sonnet-4', messages: [{ role: 'user', content: 'Hello' }] });
 *   const stream = await cg.chat({ model: 'gpt-4o', messages: [...], stream: true });
 */

import type { InferLaneConfig, ChatRequest, ChatCompletion, ChatCompletionChunk, CostEstimate, RoutingStrategy } from './types';

export class InferLane {
  private apiKey: string;
  private baseUrl: string;
  private defaultRouting: RoutingStrategy;
  private timeout: number;

  constructor(config: InferLaneConfig) {
    if (!config.apiKey) throw new Error('InferLane: apiKey is required');
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://inferlane.com').replace(/\/$/, '');
    this.defaultRouting = config.routing || 'direct';
    this.timeout = config.timeout || 30000;
  }

  // Main chat method — non-streaming returns ChatCompletion, streaming returns AsyncIterable
  async chat(request: ChatRequest & { stream: true }): Promise<AsyncIterable<ChatCompletionChunk>>;
  async chat(request: ChatRequest & { stream?: false }): Promise<ChatCompletion>;
  async chat(request: ChatRequest): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>;
  async chat(request: ChatRequest): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    const routing = request.routing || this.defaultRouting;
    const { routing: _r, budget: _b, fallback: _f, ...providerBody } = request;

    // If fallback is requested, use 'fallback' routing strategy
    const effectiveRouting = request.fallback ? 'fallback' : routing;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (effectiveRouting !== 'direct') {
      headers['X-IL-Routing'] = effectiveRouting;
    }
    if (request.budget !== undefined) {
      headers['X-IL-Budget'] = String(request.budget);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(providerBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody: any = await res.json().catch(() => ({}));
        throw new InferLaneError(
          errorBody.error || `Request failed with status ${res.status}`,
          res.status,
          errorBody,
        );
      }

      // Streaming response
      if (request.stream && res.body) {
        return this.parseSSEStream(res.body);
      }

      // Non-streaming response
      return await res.json() as ChatCompletion;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof InferLaneError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new InferLaneError('Request timed out', 408, {});
      }
      throw new InferLaneError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        {},
      );
    }
  }

  // Cost estimation
  async estimate(request: { model: string; messages: Array<{ role: string; content: string }>; max_tokens?: number }): Promise<CostEstimate> {
    const res = await fetch(`${this.baseUrl}/api/v1/estimate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorBody: any = await res.json().catch(() => ({}));
      throw new InferLaneError(
        errorBody.error || 'Estimation failed',
        res.status,
        errorBody,
      );
    }

    return await res.json() as CostEstimate;
  }

  // Parse SSE stream into async iterable
  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<ChatCompletionChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as ChatCompletionChunk;
            // Skip the CG metadata marker (it's internal)
            if (parsed._inferlane === true) continue;
            yield parsed;
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Error class
export class InferLaneError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'InferLaneError';
    this.status = status;
    this.body = body;
  }
}

// Re-exports
export { InferLaneIngest } from './ingest';
export * from './types';
export { createOpenAIClient } from './openai-compat';
