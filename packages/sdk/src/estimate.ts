import type { CostEstimate } from './types';

/**
 * Standalone cost estimation function (no class instantiation needed).
 */
export async function estimateCost(
  apiKey: string,
  request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
  },
  baseUrl?: string,
): Promise<CostEstimate> {
  const base = (baseUrl || 'https://inferlane.com').replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/estimate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Estimation failed: ${res.status}`);
  }

  return await res.json() as CostEstimate;
}
