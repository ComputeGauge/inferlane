/**
 * Helper for using InferLane as an OpenAI-compatible provider.
 *
 * Usage with the official OpenAI SDK:
 * ```typescript
 * import OpenAI from 'openai';
 * import { createOpenAIClient } from '@inferlane/sdk/openai';
 *
 * const config = createOpenAIClient('il_xxx');
 * const openai = new OpenAI(config);
 *
 * // Now use any model from any provider:
 * const response = await openai.chat.completions.create({
 *   model: 'claude-sonnet-4',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function createOpenAIClient(
  cgApiKey: string,
  options?: { baseUrl?: string },
): { baseURL: string; apiKey: string } {
  const base = (options?.baseUrl || 'https://inferlane.com').replace(/\/$/, '');
  return {
    baseURL: `${base}/api/v1`,
    apiKey: cgApiKey,
  };
}
