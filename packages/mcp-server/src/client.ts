/**
 * Lightweight HTTP client for InferLane API.
 * Used by the MCP server to fetch data from the platform.
 */

export class InferLaneClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || 'https://inferlane.dev').replace(/\/$/, '');
  }

  private async request(path: string, options?: { method?: string; body?: any; captureHeaders?: boolean }): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errBody.error?.message || errBody.error || `Request failed: ${res.status}`);
    }

    const json = await res.json() as Record<string, unknown>;

    // Optionally merge response headers into the JSON result
    // (headers are lost in .json() — we need them for routing metadata)
    if (options?.captureHeaders) {
      for (const key of ['x-il-routed-to', 'x-il-routing-reason', 'x-il-cost', 'x-il-request-id', 'x-il-savings', 'x-il-fallback', 'x-il-fallback-from', 'x-il-fallback-to', 'x-il-alternative']) {
        const val = res.headers.get(key);
        if (val) {
          // Convert x-il-routed-to → _il_routed_to
          const prop = key.replace(/^x-/, '_').replace(/-/g, '_');
          json[prop] = val;
        }
      }
    }

    return json;
  }

  async estimateCost(model: string, inputTokens: number, outputTokens: number) {
    // Send token counts directly — the estimate endpoint accepts them
    // Avoid sending fake content strings that could be multi-MB for large token counts
    return this.request('/api/v1/estimate', {
      method: 'POST',
      body: {
        model,
        estimated_input_tokens: inputTokens,
        estimated_output_tokens: outputTokens,
      },
    });
  }

  async getSpendSummary(period: string = 'month') {
    return this.request('/api/mcp/spend-summary', {
      method: 'POST',
      body: { period },
    });
  }

  async getBudgetStatus() {
    return this.request('/api/mcp/budget-status', {
      method: 'POST',
    });
  }

  async getPromotions() {
    return this.request('/api/promotions');
  }

  async chatCompletion(model: string, messages: any[], options?: { routing?: string; budget?: number; max_tokens?: number }) {
    return this.request('/api/v1/chat/completions', {
      method: 'POST',
      captureHeaders: true, // Capture X-IL-* routing metadata
      body: {
        model,
        messages,
        max_tokens: options?.max_tokens || 1024,
        il_routing: options?.routing || 'cheapest',
        il_budget: options?.budget,
      },
    });
  }
}
