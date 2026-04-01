/**
 * Vercel AI SDK provider integration for InferLane.
 *
 * No runtime dependency on the `ai` package -- implements the
 * LanguageModelV1 interface manually so it plugs straight into
 * `generateText`, `streamText`, and friends.
 *
 * @example
 * ```typescript
 * import { createInferLane } from '@inferlane/sdk/vercel-ai';
 * import { generateText, streamText } from 'ai';
 *
 * const cg = createInferLane({ apiKey: 'il_xxx' });
 *
 * const result = await generateText({
 *   model: cg('claude-sonnet-4'),
 *   prompt: 'Hello',
 * });
 *
 * const stream = await streamText({
 *   model: cg('claude-sonnet-4'),
 *   prompt: 'Hello',
 * });
 * ```
 */

// ---------------------------------------------------------------------------
// Minimal type surface that mirrors LanguageModelV1 without importing `ai`
// ---------------------------------------------------------------------------

export interface LanguageModelV1 {
  specificationVersion: 'v1';
  provider: string;
  modelId: string;
  defaultObjectGenerationMode?: 'json' | 'tool' | 'grammar';

  doGenerate(options: LanguageModelV1GenerateOptions): PromiseLike<LanguageModelV1GenerateResult>;
  doStream(options: LanguageModelV1StreamOptions): PromiseLike<LanguageModelV1StreamResult>;
}

export interface LanguageModelV1GenerateOptions {
  inputFormat: 'prompt' | 'messages';
  mode: { type: 'regular' } | { type: 'object-json' } | { type: 'object-tool'; tool?: any };
  prompt: any[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface LanguageModelV1GenerateResult {
  text: string | undefined;
  toolCalls?: any[];
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
  usage: { promptTokens: number; completionTokens: number };
  rawCall: { rawPrompt: any; rawSettings: Record<string, any> };
  rawResponse?: { headers?: Record<string, string> };
  warnings?: any[];
}

export interface LanguageModelV1StreamOptions {
  inputFormat: 'prompt' | 'messages';
  mode: { type: 'regular' } | { type: 'object-json' } | { type: 'object-tool'; tool?: any };
  prompt: any[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface LanguageModelV1StreamResult {
  stream: ReadableStream<LanguageModelV1StreamChunk>;
  rawCall: { rawPrompt: any; rawSettings: Record<string, any> };
  rawResponse?: { headers?: Record<string, string> };
  warnings?: any[];
}

export type LanguageModelV1StreamChunk =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolCallType: 'function'; toolCallId: string; toolName: string; args: string }
  | { type: 'tool-call-delta'; toolCallType: 'function'; toolCallId: string; toolName: string; argsTextDelta: string }
  | { type: 'finish'; finishReason: string; usage: { promptTokens: number; completionTokens: number } }
  | { type: 'error'; error: unknown };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface InferLaneProviderConfig {
  apiKey: string;
  baseUrl?: string;
  routing?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert Vercel AI SDK prompt items into OpenAI-compatible messages.
 * The SDK already uses a very similar shape, so this is largely pass-through.
 */
function toOpenAIMessages(prompt: any[]): any[] {
  return prompt.map((msg) => {
    // If the prompt is already in OpenAI message format, return as-is.
    if (msg.role && msg.content !== undefined) return msg;

    // Vercel wraps system/user/assistant messages with a `role` + `content` array.
    // Flatten content parts when they are simple text.
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
      return { role: msg.role, content: textParts };
    }

    return msg;
  });
}

function mapFinishReason(reason: string | undefined | null): LanguageModelV1GenerateResult['finishReason'] {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool-calls';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Model implementation
// ---------------------------------------------------------------------------

class InferLaneLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider = 'inferlane';
  readonly defaultObjectGenerationMode = 'json' as const;

  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly routing: string;

  constructor(modelId: string, config: InferLaneProviderConfig) {
    this.modelId = modelId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://inferlane.com').replace(/\/$/, '');
    this.routing = config.routing || 'cheapest';
  }

  // -- doGenerate -----------------------------------------------------------

  async doGenerate(options: LanguageModelV1GenerateOptions): Promise<LanguageModelV1GenerateResult> {
    const messages = toOpenAIMessages(options.prompt);

    const body: Record<string, any> = {
      model: this.modelId,
      messages,
      il_routing: this.routing,
    };
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.topP != null) body.top_p = options.topP;
    if (options.frequencyPenalty != null) body.frequency_penalty = options.frequencyPenalty;
    if (options.presencePenalty != null) body.presence_penalty = options.presencePenalty;
    if (options.seed != null) body.seed = options.seed;

    if (options.mode.type === 'object-json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`InferLane request failed (${res.status}): ${errorBody}`);
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content ?? undefined,
      toolCalls: choice?.message?.tool_calls,
      finishReason: mapFinishReason(choice?.finish_reason),
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
      rawCall: { rawPrompt: messages, rawSettings: body },
      rawResponse: { headers: Object.fromEntries(res.headers.entries()) },
      warnings: [],
    };
  }

  // -- doStream -------------------------------------------------------------

  async doStream(options: LanguageModelV1StreamOptions): Promise<LanguageModelV1StreamResult> {
    const messages = toOpenAIMessages(options.prompt);

    const body: Record<string, any> = {
      model: this.modelId,
      messages,
      stream: true,
      il_routing: this.routing,
    };
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.topP != null) body.top_p = options.topP;

    const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`InferLane stream failed (${res.status}): ${errorBody}`);
    }

    if (!res.body) {
      throw new Error('InferLane stream response has no body');
    }

    const responseHeaders = Object.fromEntries(res.headers.entries());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: string = 'unknown';

    const stream = new ReadableStream<LanguageModelV1StreamChunk>({
      async pull(controller) {
        let buffer = '';

        // Keep reading until we enqueue at least one chunk or the stream ends.
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: { promptTokens, completionTokens },
            });
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              controller.enqueue({
                type: 'finish',
                finishReason,
                usage: { promptTokens, completionTokens },
              });
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta;
              const reason = parsed.choices?.[0]?.finish_reason;

              if (reason) finishReason = mapFinishReason(reason);
              if (parsed.usage) {
                promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
                completionTokens = parsed.usage.completion_tokens ?? completionTokens;
              }

              if (delta?.content) {
                controller.enqueue({ type: 'text-delta', textDelta: delta.content });
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
      },
    });

    return {
      stream,
      rawCall: { rawPrompt: messages, rawSettings: body },
      rawResponse: { headers: responseHeaders },
      warnings: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create a InferLane provider for the Vercel AI SDK.
 *
 * ```typescript
 * const cg = createInferLane({ apiKey: 'il_xxx' });
 * const result = await generateText({ model: cg('claude-sonnet-4'), prompt: 'Hi' });
 * ```
 */
export function createInferLane(
  config: InferLaneProviderConfig,
): (modelId: string) => LanguageModelV1 {
  return (modelId: string) => new InferLaneLanguageModel(modelId, config);
}
