// ---------------------------------------------------------------------------
// Prefix-Cache-Aware Routing — track which OpenClaw nodes have conversation
// prefixes cached to avoid re-prefill on follow-up requests.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry {
  nodeId: string;
  prefixHash: string;          // SHA-256 of first N messages
  model: string;
  tokensCached: number;
  createdAt: Date;
  lastAccessedAt: Date;
  hitCount: number;
  estimatedVramMb: number;     // tokensCached * 0.5 bytes * 2 (K+V) / 1024 / 1024
}

export interface CacheRoutingDecision {
  hasCachedPrefix: boolean;
  cacheNodeId?: string;
  tokensSaved?: number;
  estimatedSavingsMs?: number;  // skip prefill time
  estimatedSavingsUsd?: number; // skip prefill cost
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60 * 1000;         // 30 minutes
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes
const PREFILL_SPEED_TOKENS_PER_MS = 50;       // ~50 tokens/ms prefill speed estimate
const PREFILL_COST_PER_M_TOKEN = 0.10;        // approximate cost savings for skipped prefill

// ---------------------------------------------------------------------------
// Prefix Cache class
// ---------------------------------------------------------------------------

class PrefixCache {
  /** Map from prefixHash to cache entry */
  private cache = new Map<string, CacheEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start eviction timer
    this.evictionTimer = setInterval(() => this.evictExpired(), EVICTION_INTERVAL_MS);
    if (typeof this.evictionTimer.unref === 'function') {
      this.evictionTimer.unref();
    }
  }

  // ── Hash computation ──

  /**
   * Hash the first N messages (excluding the last user message) to create
   * a prefix identifier. Uses SHA-256 of JSON.stringify of messages[0...-1].
   */
  computePrefixHash(messages: Array<{ role: string; content: string }>): string {
    if (!messages || messages.length <= 1) {
      return '';
    }

    // Take all messages except the last one (the new user message)
    const prefixMessages = messages.slice(0, -1);

    const payload = JSON.stringify(prefixMessages);
    return createHash('sha256').update(payload).digest('hex');
  }

  // ── Cache recording ──

  /**
   * After routing a request to an OpenClaw node, record what prefix is now
   * cached there.
   */
  recordCache(
    nodeId: string,
    messages: Array<{ role: string; content: string }>,
    model: string,
  ): void {
    if (!messages || messages.length === 0) return;

    const prefixHash = this.computePrefixHash(messages);
    if (!prefixHash) return;

    // Estimate tokens from message content
    const tokensCached = messages.reduce(
      (sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 4),
      0,
    );

    // Estimate VRAM: tokensCached * 0.5 bytes * 2 (K+V) / 1024 / 1024
    const estimatedVramMb = (tokensCached * 0.5 * 2) / (1024 * 1024);

    const existing = this.cache.get(prefixHash);
    if (existing && existing.nodeId === nodeId) {
      // Update existing entry
      existing.lastAccessedAt = new Date();
      existing.hitCount += 1;
      existing.tokensCached = tokensCached;
      existing.estimatedVramMb = estimatedVramMb;
    } else {
      // New entry (or different node now has this prefix)
      this.cache.set(prefixHash, {
        nodeId,
        prefixHash,
        model,
        tokensCached,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        hitCount: 0,
        estimatedVramMb,
      });
    }
  }

  // ── Cache lookup ──

  /**
   * Look up whether any node has the conversation prefix cached.
   * Returns routing decision with savings estimates.
   */
  findCachedNode(
    messages: Array<{ role: string; content: string }>,
    model: string,
  ): CacheRoutingDecision {
    if (!messages || messages.length <= 1) {
      return { hasCachedPrefix: false };
    }

    const prefixHash = this.computePrefixHash(messages);
    if (!prefixHash) {
      return { hasCachedPrefix: false };
    }

    const entry = this.cache.get(prefixHash);
    if (!entry) {
      return { hasCachedPrefix: false };
    }

    // Check TTL
    const age = Date.now() - entry.lastAccessedAt.getTime();
    if (age > CACHE_TTL_MS) {
      this.cache.delete(prefixHash);
      return { hasCachedPrefix: false };
    }

    // Check model match
    if (entry.model !== model) {
      return { hasCachedPrefix: false };
    }

    // Update access time and hit count
    entry.lastAccessedAt = new Date();
    entry.hitCount += 1;

    // Estimate savings
    const estimatedSavingsMs = entry.tokensCached / PREFILL_SPEED_TOKENS_PER_MS;
    const estimatedSavingsUsd =
      (entry.tokensCached * PREFILL_COST_PER_M_TOKEN) / 1_000_000;

    return {
      hasCachedPrefix: true,
      cacheNodeId: entry.nodeId,
      tokensSaved: entry.tokensCached,
      estimatedSavingsMs: Math.round(estimatedSavingsMs),
      estimatedSavingsUsd,
    };
  }

  // ── Eviction ──

  /**
   * Remove entries older than 30 minutes or with hitCount 0.
   * Runs automatically every 5 minutes.
   */
  evictExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [hash, entry] of this.cache.entries()) {
      const age = now - entry.lastAccessedAt.getTime();
      if (age > CACHE_TTL_MS || (entry.hitCount === 0 && age > CACHE_TTL_MS / 2)) {
        toDelete.push(hash);
      }
    }

    for (const hash of toDelete) {
      this.cache.delete(hash);
    }

    if (toDelete.length > 0) {
      console.log(`[PrefixCache] Evicted ${toDelete.length} expired entries. Active: ${this.cache.size}`);
    }
  }

  // ── Stats ──

  getStats(): { size: number; totalHits: number; totalTokensCached: number } {
    let totalHits = 0;
    let totalTokensCached = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalTokensCached += entry.tokensCached;
    }

    return { size: this.cache.size, totalHits, totalTokensCached };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const prefixCache = new PrefixCache();
