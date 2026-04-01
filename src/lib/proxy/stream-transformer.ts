/**
 * SSE Stream Transformer for InferLane Multi-Provider Proxy
 *
 * Normalizes provider-specific SSE formats to OpenAI-compatible
 * chat completion chunk format and tracks token usage for billing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamAccumulator {
  inputTokens: number;
  outputTokens: number;
  model: string;
  finishReason: string | null;
}

interface SSEMessage {
  event?: string;
  data: string;
}

// Providers whose SSE output is already OpenAI-compatible (pass-through).
const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "openai",
  "together",
  "groq",
  "fireworks",
  "deepseek",
  "mistral",
  "xai",
  "perplexity",
  "cerebras",
  "sambanova",
]);

// ---------------------------------------------------------------------------
// SSE line parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw SSE text block into structured messages.
 * SSE messages are separated by blank lines (`\n\n`).
 * Each message may contain `event:` and `data:` fields.
 */
export function parseSSELines(chunk: string): SSEMessage[] {
  const messages: SSEMessage[] = [];
  // Split on double-newline to separate individual SSE messages.
  const rawMessages = chunk.split(/\n\n/);

  for (const raw of rawMessages) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let event: string | undefined;
    const dataLines: string[] = [];

    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
      // Ignore comments (`:`) and other fields.
    }

    if (dataLines.length > 0) {
      messages.push({ event, data: dataLines.join("\n") });
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(
  id: string,
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
): string {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
      },
    ],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// ---------------------------------------------------------------------------
// Provider-specific transformers
// ---------------------------------------------------------------------------

function handleOpenAICompatible(
  msg: SSEMessage,
  acc: InternalAccumulator,
  _id: string,
): string | null {
  if (msg.data === "[DONE]") return null; // handled by caller

  try {
    const parsed = JSON.parse(msg.data);

    // Capture model if present.
    if (parsed.model) acc.model = parsed.model;

    // Capture finish_reason.
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason) acc.finishReason = choice.finish_reason;

    // Capture usage if the provider includes it (stream_options.include_usage).
    if (parsed.usage) {
      if (parsed.usage.prompt_tokens != null) acc.inputTokens = parsed.usage.prompt_tokens;
      if (parsed.usage.completion_tokens != null) acc.outputTokens = parsed.usage.completion_tokens;
    }

    // Track content length for estimation fallback.
    const content = choice?.delta?.content;
    if (typeof content === "string") {
      acc._contentLength = (acc._contentLength ?? 0) + content.length;
    }
  } catch {
    // Non-JSON data line; pass through as-is.
  }

  // Already in the right format -- pass through verbatim.
  return `data: ${msg.data}\n\n`;
}

function handleAnthropic(
  msg: SSEMessage,
  acc: InternalAccumulator,
  id: string,
): string | null {
  try {
    const parsed = JSON.parse(msg.data);

    switch (msg.event) {
      case "message_start": {
        const message = parsed.message;
        if (message?.model) acc.model = message.model;
        if (message?.usage?.input_tokens != null) {
          acc.inputTokens = message.usage.input_tokens;
        }
        // Emit a role chunk so clients know the assistant is speaking.
        return makeChunk(id, acc.model, { role: "assistant" });
      }

      case "content_block_delta": {
        const delta = parsed.delta;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          acc._contentLength = (acc._contentLength ?? 0) + delta.text.length;
          return makeChunk(id, acc.model, { content: delta.text });
        }
        return null;
      }

      case "message_delta": {
        if (parsed.delta?.stop_reason) {
          acc.finishReason = parsed.delta.stop_reason === "end_turn" ? "stop" : parsed.delta.stop_reason;
        }
        if (parsed.usage?.output_tokens != null) {
          acc.outputTokens = parsed.usage.output_tokens;
        }
        return makeChunk(id, acc.model, {}, acc.finishReason);
      }

      case "message_stop":
        // Signal end; caller will emit [DONE].
        return null;

      case "content_block_start":
      case "content_block_stop":
      case "ping":
        return null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

function handleGoogle(
  msg: SSEMessage,
  acc: InternalAccumulator,
  id: string,
): string | null {
  if (msg.data === "[DONE]") return null;

  try {
    const parsed = JSON.parse(msg.data);

    // Extract text from Google's candidates array.
    const candidate = parsed.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (parsed.modelVersion) acc.model = parsed.modelVersion;

    // Capture usage metadata if present.
    if (parsed.usageMetadata) {
      if (parsed.usageMetadata.promptTokenCount != null) {
        acc.inputTokens = parsed.usageMetadata.promptTokenCount;
      }
      if (parsed.usageMetadata.candidatesTokenCount != null) {
        acc.outputTokens = parsed.usageMetadata.candidatesTokenCount;
      }
    }

    // Capture finish reason.
    if (candidate?.finishReason) {
      acc.finishReason = candidate.finishReason === "STOP" ? "stop" : candidate.finishReason.toLowerCase();
    }

    if (typeof text === "string") {
      acc._contentLength = (acc._contentLength ?? 0) + text.length;
      return makeChunk(id, acc.model, { content: text }, candidate?.finishReason === "STOP" ? "stop" : null);
    }

    return null;
  } catch {
    return null;
  }
}

function handleCohere(
  msg: SSEMessage,
  acc: InternalAccumulator,
  id: string,
): string | null {
  try {
    const parsed = JSON.parse(msg.data);

    switch (msg.event) {
      case "text-generation": {
        if (typeof parsed.text === "string") {
          acc._contentLength = (acc._contentLength ?? 0) + parsed.text.length;
          return makeChunk(id, acc.model, { content: parsed.text });
        }
        return null;
      }

      case "stream-end": {
        acc.finishReason = parsed.finish_reason === "COMPLETE" ? "stop" : (parsed.finish_reason?.toLowerCase() ?? "stop");
        if (parsed.response?.meta?.tokens) {
          const tokens = parsed.response.meta.tokens;
          if (tokens.input_tokens != null) acc.inputTokens = tokens.input_tokens;
          if (tokens.output_tokens != null) acc.outputTokens = tokens.output_tokens;
        }
        return makeChunk(id, acc.model, {}, acc.finishReason);
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

// Extend accumulator with internal tracking fields (not exposed to callers).
interface InternalAccumulator extends StreamAccumulator {
  _contentLength?: number;
}

export function createStreamTransformer(provider: string): {
  stream: TransformStream;
  getAccumulator: () => StreamAccumulator;
} {
  const id = `il-${Date.now()}`;
  const normalizedProvider = provider.toLowerCase();

  const acc: InternalAccumulator = {
    inputTokens: 0,
    outputTokens: 0,
    model: "",
    finishReason: null,
    _contentLength: 0,
  };

  const decoder = new TextDecoder();
  let buffer = "";

  const isOpenAICompatible = OPENAI_COMPATIBLE_PROVIDERS.has(normalizedProvider);

  const dispatch = (msg: SSEMessage): string | null => {
    if (isOpenAICompatible) return handleOpenAICompatible(msg, acc, id);
    switch (normalizedProvider) {
      case "anthropic":
        return handleAnthropic(msg, acc, id);
      case "google":
        return handleGoogle(msg, acc, id);
      case "cohere":
        return handleCohere(msg, acc, id);
      default:
        // Unknown provider -- treat as OpenAI-compatible best-effort.
        return handleOpenAICompatible(msg, acc, id);
    }
  };

  const encoder = new TextEncoder();

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete SSE messages (terminated by \n\n).
      // Keep any trailing partial message in the buffer.
      const lastDoubleNewline = buffer.lastIndexOf("\n\n");
      if (lastDoubleNewline === -1) return; // no complete message yet

      const complete = buffer.slice(0, lastDoubleNewline + 2);
      buffer = buffer.slice(lastDoubleNewline + 2);

      const messages = parseSSELines(complete);

      for (const msg of messages) {
        // Detect provider [DONE] signals.
        if (msg.data === "[DONE]") {
          // Append CG metadata chunk before the [DONE].
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ _inferlane: true })}\n\n`),
          );
          // Pass through [DONE].
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          continue;
        }

        const transformed = dispatch(msg);
        if (transformed) {
          controller.enqueue(encoder.encode(transformed));
        }
      }
    },

    flush(controller) {
      // Process any remaining buffered data.
      if (buffer.trim()) {
        const messages = parseSSELines(buffer);
        for (const msg of messages) {
          if (msg.data === "[DONE]") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ _inferlane: true })}\n\n`),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            continue;
          }

          const transformed = dispatch(msg);
          if (transformed) {
            controller.enqueue(encoder.encode(transformed));
          }
        }
      }

      // Estimate output tokens if the provider didn't report them.
      if (acc.outputTokens === 0 && (acc._contentLength ?? 0) > 0) {
        acc.outputTokens = Math.ceil(acc._contentLength! / 4);
      }
    },
  });

  const getAccumulator = (): StreamAccumulator => {
    // Ensure estimation is applied even if flush hasn't run yet.
    if (acc.outputTokens === 0 && (acc._contentLength ?? 0) > 0) {
      acc.outputTokens = Math.ceil(acc._contentLength! / 4);
    }
    return {
      inputTokens: acc.inputTokens,
      outputTokens: acc.outputTokens,
      model: acc.model,
      finishReason: acc.finishReason,
    };
  };

  return { stream, getAccumulator };
}
