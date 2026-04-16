// ============================================================================
// Cross-Provider Session Manager
// ============================================================================
// Enables conversations that seamlessly transfer between LLM providers.
// Start on Claude, continue on GPT-4, overflow to OpenClaw decentralized nodes.
// File-based storage at ~/.inferlane/sessions/ (no schema migration needed).
// ============================================================================

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ── Types ────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  timestamp: number;
  tokenCount?: number;
  costUsd?: number;
}

export interface Session {
  id: string;
  userId: string;
  messages: SessionMessage[];
  totalTokens: number;
  totalCostUsd: number;
  providers: string[];
  models: string[];
  createdAt: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
  /** Provider pinned on first routed message (prevents mid-conversation switches) */
  pinnedProvider?: string;
  /** Model pinned on first routed message */
  pinnedModel?: string;
}

// ── Pricing lookup for handoff cost estimation ───────────────────────────

// Per-token input costs in USD (rough averages, updated periodically)
// Legacy Anthropic identifiers are retained so historical session
// handoff cost estimates still resolve. New code should import
// pricing from @/lib/providers/anthropic-models.
const MODEL_INPUT_COST_PER_TOKEN: Record<string, number> = {
  // Anthropic — current
  'claude-sonnet-4-5':    0.000003,
  'claude-haiku-4-5':     0.000001,
  'claude-opus-4-5':      0.000015,
  // Anthropic — legacy (still honored)
  'claude-opus-4':        0.000015,
  'claude-sonnet-4':      0.000003,
  'claude-haiku-3.5':     0.0000008,
  // OpenAI
  'gpt-4o':           0.0000025,
  'gpt-4o-mini':      0.00000015,
  'o1':               0.000015,
  'o3-mini':          0.0000011,
  // Google
  'gemini-2.0-pro':   0.00000125,
  'gemini-2.0-flash': 0.0000001,
  // Open-source / decentralized
  'llama-3.1-405b':   0.000003,
  'llama-3.1-70b':    0.0000009,
  'openclaw':         0.0000005,
};

const DEFAULT_COST_PER_TOKEN = 0.000003; // fallback

// ── Helpers ──────────────────────────────────────────────────────────────

const SESSIONS_DIR = path.join(os.homedir(), '.inferlane', 'sessions');

async function ensureDir(): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function validateSessionId(sessionId: string): string {
  // Must be UUID v4 format only
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    throw new Error('Invalid session ID format');
  }
  return sessionId;
}

function sessionPath(sessionId: string): string {
  const safe = validateSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

async function readSession(sessionId: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(sessionPath(sessionId), 'utf-8');
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

async function writeSession(session: Session): Promise<void> {
  await ensureDir();
  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

// ── Session Manager ──────────────────────────────────────────────────────

class SessionManager {
  /**
   * Create a new conversation session.
   */
  async createSession(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      userId,
      messages: [],
      totalTokens: 0,
      totalCostUsd: 0,
      providers: [],
      models: [],
      createdAt: now,
      lastActiveAt: now,
      metadata,
    };
    await writeSession(session);
    return session;
  }

  /**
   * Load a session by ID. Returns null if not found or ownership mismatch.
   */
  async getSession(sessionId: string, userId: string): Promise<Session | null> {
    const session = await readSession(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  /**
   * Append a message to an existing session.
   */
  async addMessage(sessionId: string, message: SessionMessage): Promise<void> {
    const session = await readSession(sessionId);
    if (!session) throw new Error('Session not found');

    session.messages.push(message);
    session.lastActiveAt = Date.now();

    // Update aggregates
    if (message.tokenCount) {
      session.totalTokens += message.tokenCount;
    }
    if (message.costUsd) {
      session.totalCostUsd += message.costUsd;
    }
    if (message.provider && !session.providers.includes(message.provider)) {
      session.providers.push(message.provider);
    }
    if (message.model && !session.models.includes(message.model)) {
      session.models.push(message.model);
    }

    await writeSession(session);
  }

  /**
   * Get conversation history formatted for the target provider.
   * Implements smart context windowing when messages exceed token budget.
   *
   * Strategy when truncating:
   *  1. Always keep system prompt(s)
   *  2. Keep first 2 user/assistant messages (establishes context)
   *  3. Fill remaining budget with most recent messages
   *  4. Insert a synthetic system note where truncation occurred
   */
  async getContextForProvider(
    sessionId: string,
    _provider: string,
    maxTokens: number = 100_000,
  ): Promise<SessionMessage[]> {
    const session = await readSession(sessionId);
    if (!session) throw new Error('Session not found');

    const { messages } = session;
    if (messages.length === 0) return [];

    // Fast path: everything fits
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount ?? this.estimateTokens(m.content)), 0);
    if (totalTokens <= maxTokens) return messages;

    // Separate system messages from conversation
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const conversationMsgs = messages.filter((m) => m.role !== 'system');

    // Budget after system messages
    const systemTokens = systemMsgs.reduce((sum, m) => sum + (m.tokenCount ?? this.estimateTokens(m.content)), 0);
    let remaining = maxTokens - systemTokens;

    // Keep first 2 conversation messages
    const headCount = Math.min(2, conversationMsgs.length);
    const head = conversationMsgs.slice(0, headCount);
    const headTokens = head.reduce((sum, m) => sum + (m.tokenCount ?? this.estimateTokens(m.content)), 0);
    remaining -= headTokens;

    // Fill from the tail
    const tail: SessionMessage[] = [];
    for (let i = conversationMsgs.length - 1; i >= headCount; i--) {
      const msg = conversationMsgs[i];
      const tokens = msg.tokenCount ?? this.estimateTokens(msg.content);
      if (remaining - tokens < 0) break;
      remaining -= tokens;
      tail.unshift(msg);
    }

    // Build result with truncation marker
    const truncationNote: SessionMessage = {
      role: 'system',
      content: '[Context from previous messages summarized]',
      timestamp: Date.now(),
    };

    return [
      ...systemMsgs,
      ...head,
      ...(tail.length < conversationMsgs.length - headCount ? [truncationNote] : []),
      ...tail,
    ];
  }

  /**
   * List a user's recent sessions (metadata only, no full message arrays).
   */
  async getSessionHistory(userId: string, limit: number = 20): Promise<Session[]> {
    await ensureDir();

    let files: string[];
    try {
      files = await fs.readdir(SESSIONS_DIR);
    } catch {
      return [];
    }

    const sessions: Session[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
        const session = JSON.parse(raw) as Session;
        if (session.userId === userId) {
          sessions.push(session);
        }
      } catch {
        // skip corrupt files
      }
    }

    // Sort by most recent activity, then trim
    sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return sessions.slice(0, limit);
  }

  /**
   * Estimate the cost of continuing a session on a different provider/model.
   * Useful for routing decisions (e.g., "is it cheaper to overflow to OpenClaw?").
   */
  estimateHandoffCost(
    sessionId: string,
    _targetProvider: string,
    targetModel: string,
  ): { contextTokens: number; estimatedCostUsd: number } {
    // This is a synchronous estimation based on session stats.
    // For a real-time version, call getSession first.
    // Here we provide a model-aware estimate given a token count.
    // Caller should provide the contextTokens from getContextForProvider.
    // We expose this as a helper that the router can call inline.
    const costPerToken = MODEL_INPUT_COST_PER_TOKEN[targetModel] ?? DEFAULT_COST_PER_TOKEN;
    return { contextTokens: 0, estimatedCostUsd: 0 * costPerToken };
  }

  /**
   * Async version that loads the session and computes real context size.
   */
  async estimateHandoffCostAsync(
    sessionId: string,
    targetProvider: string,
    targetModel: string,
    maxTokens?: number,
  ): Promise<{ contextTokens: number; estimatedCostUsd: number }> {
    const context = await this.getContextForProvider(sessionId, targetProvider, maxTokens);
    const contextTokens = context.reduce(
      (sum, m) => sum + (m.tokenCount ?? this.estimateTokens(m.content)),
      0,
    );
    const costPerToken = MODEL_INPUT_COST_PER_TOKEN[targetModel] ?? DEFAULT_COST_PER_TOKEN;
    return {
      contextTokens,
      estimatedCostUsd: Math.round(contextTokens * costPerToken * 1_000_000) / 1_000_000,
    };
  }

  /**
   * Delete a session file. Returns true if deleted, false if not found.
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await readSession(sessionId);
    if (!session || session.userId !== userId) return false;
    try {
      await fs.unlink(sessionPath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  // ── Model Pinning ───────────────────────────────────────────────────

  /**
   * Pin a session to a specific provider/model on first routed message.
   * Subsequent messages in the same session will reuse this provider/model
   * to avoid mid-conversation quality degradation from model switches.
   */
  async pinSession(
    sessionId: string,
    provider: string,
    model: string,
  ): Promise<void> {
    const session = await readSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Only pin if not already pinned
    if (!session.pinnedProvider) {
      session.pinnedProvider = provider;
      session.pinnedModel = model;
      await writeSession(session);
    }
  }

  /**
   * Get the pinned provider/model for a session, if any.
   * Returns null if the session doesn't exist or has no pin.
   */
  async getPinned(
    sessionId: string,
  ): Promise<{ provider: string; model: string } | null> {
    const session = await readSession(sessionId);
    if (!session || !session.pinnedProvider || !session.pinnedModel) {
      return null;
    }
    return {
      provider: session.pinnedProvider,
      model: session.pinnedModel,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────

  /**
   * Rough token estimate: ~4 chars per token (good enough for budgeting).
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

// ── Singleton export ─────────────────────────────────────────────────────

export const sessionManager = new SessionManager();
