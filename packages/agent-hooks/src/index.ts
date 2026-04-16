/**
 * @inferlane/agent-hooks
 *
 * Drop-in lifecycle hooks that auto-log cost, tokens, and runtime to InferLane
 * for Claude Agent SDK sessions, Anthropic Managed Agent sessions, and any
 * other agent runtime that exposes PreToolUse / PostToolUse / SessionStart /
 * SessionEnd lifecycle events.
 *
 * Usage with Claude Agent SDK (TypeScript):
 *
 *   import { query } from '@anthropic-ai/claude-agent-sdk';
 *   import { createInferLaneHooks } from '@inferlane/agent-hooks';
 *
 *   const hooks = createInferLaneHooks({
 *     apiKey: process.env.INFERLANE_API_KEY!,
 *     runtime: 'CLAUDE_AGENT_SDK',
 *     agentName: 'my-coding-assistant',
 *     fleetId: 'fleet_abc123', // optional
 *   });
 *
 *   for await (const msg of query({
 *     prompt: 'Refactor the auth module',
 *     options: {
 *       hooks: {
 *         SessionStart: [hooks.sessionStart],
 *         PreToolUse: [hooks.preToolUse],
 *         PostToolUse: [hooks.postToolUse],
 *         SessionEnd: [hooks.sessionEnd],
 *       },
 *     },
 *   })) {
 *     // ... handle agent messages
 *   }
 *
 * That's it. Every tool use, model call, and session completion is automatically
 * logged to InferLane's fleet aggregation API. The dashboard at inferlane.dev
 * shows token cost + runtime cost + web-search cost in real time.
 */

export type FleetRuntime =
  | 'ANTHROPIC_MANAGED'
  | 'CLAUDE_AGENT_SDK'
  | 'CLAUDE_CODE'
  | 'GOOSE'
  | 'SWARMCLAW'
  | 'CUSTOM';

export interface InferLaneHooksOptions {
  /** InferLane API key (Bearer token). Get one at https://inferlane.dev/dashboard/settings */
  apiKey: string;
  /** Which runtime is hosting this agent */
  runtime: FleetRuntime;
  /** Optional: attach to a named fleet for aggregation + budget alerts */
  fleetId?: string;
  /** Optional: human-readable agent name for the dashboard */
  agentName?: string;
  /** Optional: agent definition version */
  agentVersion?: string;
  /** Override the InferLane base URL (default: https://inferlane.dev). Useful for self-hosted deployments. */
  baseUrl?: string;
  /** Set true to log hook activity to console for debugging */
  debug?: boolean;
  /** If the hook fails to reach InferLane, swallow the error (default: true) */
  swallowErrors?: boolean;
}

export interface FleetSessionContext {
  sessionId: string;
  fleetId?: string;
  externalId?: string;
  startedAt: Date;
  activeStartedAt?: Date;
  model?: string;
}

interface HookArgs {
  /** The tool being called or result being returned */
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  /** Usage data if available */
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** Model used for this turn */
  model?: string;
  /** Session metadata from the Agent SDK */
  session_id?: string;
  /** Arbitrary extra data */
  [key: string]: unknown;
}

type HookResult = void | { allow?: boolean; reason?: string };

/**
 * Create a set of InferLane lifecycle hooks. Returns individual hook functions
 * ready to be attached to the Claude Agent SDK's `hooks` option, plus a
 * `flush()` helper for graceful shutdown.
 */
export function createInferLaneHooks(options: InferLaneHooksOptions) {
  const baseUrl = (options.baseUrl ?? process.env.INFERLANE_BASE_URL ?? 'https://inferlane.dev').replace(/\/$/, '');
  const swallow = options.swallowErrors ?? true;
  const log = (msg: string, extra?: unknown) => {
    if (options.debug) console.log(`[inferlane-hooks] ${msg}`, extra ?? '');
  };

  // Per-invocation session context. Mutated by sessionStart / sessionEnd.
  const state: { context: FleetSessionContext | null } = { context: null };

  async function api(method: string, path: string, body?: unknown): Promise<unknown> {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '<no body>');
        throw new Error(`InferLane API ${res.status}: ${text}`);
      }
      return await res.json().catch(() => null);
    } catch (err) {
      if (swallow) {
        log('API error (swallowed)', err instanceof Error ? err.message : err);
        return null;
      }
      throw err;
    }
  }

  async function sessionStart(args: HookArgs): Promise<HookResult> {
    log('sessionStart', args.session_id);
    const response = (await api('POST', '/api/fleet/sessions', {
      runtime: options.runtime,
      fleetId: options.fleetId,
      agentName: options.agentName,
      agentVersion: options.agentVersion,
      externalId: args.session_id,
      model: args.model,
      metadata: { source: '@inferlane/agent-hooks' },
    })) as { session?: { id: string } } | null;

    if (response?.session) {
      state.context = {
        sessionId: response.session.id,
        fleetId: options.fleetId,
        externalId: args.session_id,
        startedAt: new Date(),
        activeStartedAt: new Date(),
        model: args.model,
      };
      log('Session registered', state.context);
    }
  }

  async function preToolUse(args: HookArgs): Promise<HookResult> {
    if (!state.context) return;
    // Start the active-runtime clock for this tool call
    state.context.activeStartedAt = new Date();
    log('preToolUse', args.tool_name);
    await api(
      'POST',
      `/api/fleet/sessions/${state.context.sessionId}/events`,
      {
        type: 'TOOL_USE',
        payload: { tool_name: args.tool_name, tool_input: args.tool_input },
      },
    );
  }

  async function postToolUse(args: HookArgs): Promise<HookResult> {
    if (!state.context) return;
    // Compute how long this tool call was active
    const now = new Date();
    const activeMs = state.context.activeStartedAt
      ? now.getTime() - state.context.activeStartedAt.getTime()
      : 0;
    state.context.activeStartedAt = undefined;

    const isWebSearch = args.tool_name === 'web_search' || args.tool_name === 'WebSearch';

    log('postToolUse', { tool: args.tool_name, activeMs });
    await api(
      'POST',
      `/api/fleet/sessions/${state.context.sessionId}/events`,
      {
        type: 'TOOL_RESULT',
        payload: { tool_name: args.tool_name, tool_result: args.tool_result },
        activeRuntimeMs: activeMs,
        webSearchCount: isWebSearch ? 1 : 0,
        inputTokens: args.usage?.input_tokens ?? 0,
        outputTokens: args.usage?.output_tokens ?? 0,
        cachedTokens: args.usage?.cache_read_input_tokens ?? 0,
        model: args.model ?? state.context.model,
      },
    );
  }

  async function modelCall(args: HookArgs): Promise<HookResult> {
    // Optional hook: call this manually after any direct model.messages.create()
    // if you're not using the Agent SDK's native tool loop.
    if (!state.context) return;
    log('modelCall', args.model);
    await api(
      'POST',
      `/api/fleet/sessions/${state.context.sessionId}/events`,
      {
        type: 'MODEL_CALL',
        payload: { model: args.model },
        inputTokens: args.usage?.input_tokens ?? 0,
        outputTokens: args.usage?.output_tokens ?? 0,
        cachedTokens: args.usage?.cache_read_input_tokens ?? 0,
        model: args.model ?? state.context.model,
      },
    );
  }

  async function sessionEnd(_args: HookArgs): Promise<HookResult> {
    if (!state.context) return;
    log('sessionEnd', state.context.sessionId);
    await api('PATCH', `/api/fleet/sessions/${state.context.sessionId}`, {
      status: 'COMPLETED',
    });
    state.context = null;
  }

  /**
   * Force-flush any pending work and close the active session.
   * Call this during graceful shutdown (SIGTERM handler, etc.)
   */
  async function flush(): Promise<void> {
    if (state.context) {
      await sessionEnd({});
    }
  }

  return {
    sessionStart,
    preToolUse,
    postToolUse,
    modelCall,
    sessionEnd,
    flush,
    /** Access the current session context (read-only) */
    getContext: () => (state.context ? { ...state.context } : null),
  };
}

// ---------------------------------------------------------------------------
// Convenience: wire up hooks directly into a ClaudeAgentOptions hooks object
// ---------------------------------------------------------------------------

/**
 * Returns an object ready to spread into `ClaudeAgentOptions.hooks` for the
 * Claude Agent SDK. This is the 1-liner integration path.
 *
 *   import { claudeAgentHooks } from '@inferlane/agent-hooks';
 *
 *   for await (const m of query({
 *     prompt: '...',
 *     options: {
 *       hooks: claudeAgentHooks({ apiKey, runtime: 'CLAUDE_AGENT_SDK' }),
 *     },
 *   })) { ... }
 */
export function claudeAgentHooks(options: InferLaneHooksOptions) {
  const h = createInferLaneHooks(options);
  return {
    SessionStart: [h.sessionStart],
    PreToolUse: [h.preToolUse],
    PostToolUse: [h.postToolUse],
    SessionEnd: [h.sessionEnd],
  };
}
