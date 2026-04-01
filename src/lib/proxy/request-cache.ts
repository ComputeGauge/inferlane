// Adapted from ClawRouter (MIT License) — https://github.com/BlockRunAI/ClawRouter
// Original: src/response-cache.ts

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
  provider: string;
  model: string;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively sort object keys for deterministic JSON serialization.
 */
function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/**
 * Fields to strip before hashing — these vary per-request but don't
 * affect the semantic content of the prompt.
 */
const STRIP_FIELDS = new Set(['stream', 'user', 'request_id']);

/**
 * Rough regex to strip ISO-8601 timestamps from message content so that
 * identical prompts sent seconds apart still deduplicate.
 */
const TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\dZ+-]*/g;

function stripFields(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (STRIP_FIELDS.has(key)) continue;
    if (typeof value === 'string') {
      cleaned[key] = value.replace(TIMESTAMP_RE, '');
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) => {
        if (item && typeof item === 'object') return stripFields(item as Record<string, unknown>);
        if (typeof item === 'string') return item.replace(TIMESTAMP_RE, '');
        return item;
      });
    } else if (value && typeof value === 'object') {
      cleaned[key] = stripFields(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// RequestCache
// ---------------------------------------------------------------------------

export class RequestCache {
  private cache: Map<string, CachedResponse> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private maxItemSize: number;

  constructor(
    maxSize: number = 200,
    defaultTTL: number = 30_000,   // 30 seconds for dedup
    maxItemSize: number = 1_048_576, // 1 MB
  ) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.maxItemSize = maxItemSize;
  }

  // -----------------------------------------------------------------------
  // Key generation
  // -----------------------------------------------------------------------

  generateKey(body: object): string {
    const stripped = stripFields(body as Record<string, unknown>);
    const sorted = sortKeysDeep(stripped);
    const canonical = JSON.stringify(sorted);
    return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  }

  // -----------------------------------------------------------------------
  // Get / Set
  // -----------------------------------------------------------------------

  get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.cachedAt > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, response: CachedResponse): void {
    // Reject oversized entries
    if (response.body.length > this.maxItemSize) return;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    this.cache.set(key, { ...response, cachedAt: Date.now() });
  }

  // -----------------------------------------------------------------------
  // Skip-cache check
  // -----------------------------------------------------------------------

  shouldSkipCache(headers: Headers, body: any): boolean {
    // Cache-Control: no-cache
    const cc = headers.get('cache-control');
    if (cc && cc.toLowerCase().includes('no-cache')) return true;

    // Explicit body flags
    if (body?.cache === false) return true;
    if (body?.no_cache === true) return true;

    return false;
  }

  // -----------------------------------------------------------------------
  // Eviction
  // -----------------------------------------------------------------------

  evict(): void {
    const now = Date.now();

    // First pass: remove all expired entries
    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt > this.defaultTTL) {
        this.cache.delete(key);
      }
    }

    // Second pass: if still at capacity, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = [...this.cache.entries()]
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const toRemove = entries.length - this.maxSize + 1; // free up at least 1 slot
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Stats (useful for debugging / monitoring)
  // -----------------------------------------------------------------------

  get size(): number {
    return this.cache.size;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const requestCache = new RequestCache();
