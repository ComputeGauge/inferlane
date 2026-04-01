import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Redis-backed rate limiting (Upstash) with in-memory fallback
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Cache Ratelimit instances so we reuse the same limiter for identical configs
const limiterCache = new Map<string, Ratelimit>();

function getRedisLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (limiter) return limiter;

  const window = msToUpstashWindow(windowMs);
  limiter = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/** Map milliseconds to the closest Upstash duration string. */
function msToUpstashWindow(ms: number): `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}` {
  if (ms <= 0) return '1 s';
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / 86_400_000)} d`;
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when Upstash env vars are not set)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// Clean up expired in-memory entries periodically
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);
if (typeof cleanup.unref === 'function') cleanup.unref();

// ---------------------------------------------------------------------------
// Public API — same signature regardless of backend
// ---------------------------------------------------------------------------

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number }> {
  if (redis) {
    const limiter = getRedisLimiter(limit, windowMs);
    const result = await limiter.limit(key);
    return { success: result.success, remaining: result.remaining };
  }

  return inMemoryRateLimit(key, limit, windowMs);
}
