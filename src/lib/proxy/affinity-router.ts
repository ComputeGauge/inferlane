// ---------------------------------------------------------------------------
// Affinity-Based Session Routing — deterministic session→provider affinity
// using LRU cache with TTL, inspired by mesh-llm's network/affinity.rs
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AffinityEntry {
  provider: string;
  model: string;
  lastUsed: Date;
  hitCount: number;
  sessionHash: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 4096;
const TTL_MS = 20 * 60 * 1000; // 20 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// AffinityRouter
// ---------------------------------------------------------------------------

class AffinityRouter {
  private cache = new Map<string, AffinityEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  // ── Deterministic hash combining prefix + user for stable routing ──

  hashCombine(prefixHash: string, userHash: string): string {
    return createHash('sha256')
      .update(`${prefixHash}:${userHash}`)
      .digest('hex')
      .slice(0, 16);
  }

  // ── Get sticky routing for a session ──

  getSticky(sessionId: string, model?: string): AffinityEntry | null {
    const key = model ? `${sessionId}:${model}` : sessionId;
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.lastUsed.getTime() > TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    entry.lastUsed = new Date();
    entry.hitCount++;
    return entry;
  }

  // ── Set sticky routing after first request in a session ──

  setSticky(sessionId: string, provider: string, model: string): void {
    const key = `${sessionId}:${model}`;
    this.cache.set(key, {
      provider,
      model,
      lastUsed: new Date(),
      hitCount: 1,
      sessionHash: sessionId,
    });
    this.evictIfNeeded();
  }

  // ── Get affinity by system prompt hash (shared system prompts across sessions) ──

  getByPrefix(systemPromptHash: string, model: string): AffinityEntry | null {
    const key = `prefix:${systemPromptHash}:${model}`;
    return this.getSticky(key, model);
  }

  setByPrefix(systemPromptHash: string, provider: string, model: string): void {
    const key = `prefix:${systemPromptHash}:${model}`;
    this.setSticky(key, provider, model);
  }

  // ── Deterministic fallback when no cache entry exists ──

  deterministicSelect(sessionId: string, providers: string[]): string {
    if (providers.length === 0) throw new Error('No providers available');
    const hash = createHash('sha256').update(sessionId).digest();
    const index = hash.readUInt32BE(0) % providers.length;
    return providers[index];
  }

  // ── LRU eviction ──

  private evictIfNeeded(): void {
    if (this.cache.size <= MAX_ENTRIES) return;
    // Evict oldest entries
    const entries = [...this.cache.entries()].sort(
      (a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime(),
    );
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    for (const [key] of toRemove) this.cache.delete(key);
  }

  // ── Periodic TTL cleanup ──

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.lastUsed.getTime() > TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  // ── Stats ──

  getStats(): { size: number; hitRate: number } {
    return { size: this.cache.size, hitRate: 0 }; // hitRate tracked separately
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const affinityRouter = new AffinityRouter();
