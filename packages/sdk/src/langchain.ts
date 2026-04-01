/**
 * LangChain-compatible LLM wrapper for InferLane.
 *
 * No runtime dependency on `@langchain/core` -- implements the expected
 * interface pattern (invoke / stream / batch) so it works standalone or
 * inside LangChain chains.
 *
 * @example
 * ```typescript
 * import { InferLaneLLM } from '@inferlane/sdk/langchain';
 *
 * const model = new InferLaneLLM({
 *   apiKey: 'il_xxx',
 *   model: 'claude-sonnet-4',
 *   routing: 'cheapest',
 * });
 *
 * // Simple invocation
 * const result = await model.invoke('Hello');
 *
 * // Streaming
 * for await (const chunk of model.stream('Hello')) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Batch
 * const results = await model.batch(['Hello', 'World']);
 *
 * // Inside a LangChain chain (when @langchain/core is installed)
 * const chain = prompt.pipe(model).pipe(outputParser);
 * ```
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface InferLaneLLMConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  routing?: string;
  temperature?: number;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class InferLaneLLM {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private routing: string;
  private temperature: number;
  private maxTokens: number;

  /** LangChain serialisation metadata */
  lc_serializable = true;
  /** LangChain namespace */
  lc_namespace = ['inferlane'];

  constructor(config: InferLaneLLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || 'https://inferlane.com').replace(/\/$/, '');
    this.routing = config.routing || 'cheapest';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  // -- invoke ---------------------------------------------------------------

  /**
   * Send a single request and return the completed response text.
   *
   * Accepts either a plain string (wrapped as a user message) or an array of
   * `{ role, content }` message objects.
   */
  async invoke(input: string | Array<{ role: string; content: string }>): Promise<string> {
    const messages =
      typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : input;

    const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        il_routing: this.routing,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`InferLane request failed (${res.status}): ${errorBody}`);
    }

    const data: any = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // -- stream ---------------------------------------------------------------

  /**
   * Stream the response token-by-token as an async generator of strings.
   */
  async *stream(
    input: string | Array<{ role: string; content: string }>,
  ): AsyncGenerator<string, void, undefined> {
    const messages =
      typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : input;

    const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
        il_routing: this.routing,
      }),
    });

    if (!res.ok || !res.body) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`InferLane stream failed (${res.status}): ${errorBody}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }

  // -- batch ----------------------------------------------------------------

  /**
   * Run multiple inputs concurrently and return all results.
   */
  async batch(inputs: string[]): Promise<string[]> {
    return Promise.all(inputs.map((input) => this.invoke(input)));
  }

  // -- pipe support ---------------------------------------------------------

  /**
   * Minimal pipe() support so the instance can participate in LangChain-style
   * `a.pipe(b).pipe(c)` chains without importing `@langchain/core`.
   *
   * Returns an object with its own `invoke` that runs this model first, then
   * feeds the output into `next.invoke()`.
   */
  pipe(next: { invoke: (input: any) => Promise<any> }): { invoke: (input: any) => Promise<any> } {
    const self = this;
    return {
      invoke: async (input: any) => {
        const intermediate = await self.invoke(input);
        return next.invoke(intermediate);
      },
    };
  }
}
