// ---------------------------------------------------------------------------
// Provider health tracker — sliding window with cooldown logic
// ---------------------------------------------------------------------------

const WINDOW_SIZE = 100;
const ENTRY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

interface HealthEntry {
  latencyMs: number;
  statusCode: number;
  timestamp: number;
}

export interface ProviderHealth {
  latencyP50: number;
  latencyP95: number;
  errorRate: number;
  isHealthy: boolean;
  cooldownUntil: number | null;
  totalSamples: number;
}

const SUPPORTED_PROVIDERS = [
  'ANTHROPIC',
  'OPENAI',
  'GOOGLE',
  'TOGETHER',
  'FIREWORKS',
  'REPLICATE',
  'GROQ',
  'DEEPSEEK',
  'MISTRAL',
  'COHERE',
  'XAI',
  'PERPLEXITY',
  'CEREBRAS',
  'SAMBANOVA',
] as const;

type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

class ProviderHealthTracker {
  private windows: Map<string, HealthEntry[]> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private cooldownUntil: Map<string, number> = new Map();

  // Per-model tracking: keys are "PROVIDER:model" composite strings
  private modelWindows: Map<string, HealthEntry[]> = new Map();
  private modelConsecutiveFailures: Map<string, number> = new Map();
  private modelCooldownUntil: Map<string, number> = new Map();

  private static modelKey(provider: string, model: string): string {
    return `${provider.toUpperCase()}:${model}`;
  }

  // -------------------------------------------------------------------------
  // Record a result after every proxy response
  // -------------------------------------------------------------------------

  recordResult(provider: string, latencyMs: number, statusCode: number): void {
    const now = Date.now();
    const key = provider.toUpperCase();

    // Get or create window
    let window = this.windows.get(key);
    if (!window) {
      window = [];
      this.windows.set(key, window);
    }

    // Add entry
    window.push({ latencyMs, statusCode, timestamp: now });

    // Evict stale entries (older than TTL)
    const cutoff = now - ENTRY_TTL_MS;
    while (window.length > 0 && window[0].timestamp < cutoff) {
      window.shift();
    }

    // Trim to max window size (keep most recent)
    while (window.length > WINDOW_SIZE) {
      window.shift();
    }

    // Track consecutive failures
    const isError = statusCode >= 400;
    const is429 = statusCode === 429;

    if (isError) {
      const prevFailures = this.consecutiveFailures.get(key) ?? 0;
      this.consecutiveFailures.set(key, prevFailures + 1);
    } else {
      this.consecutiveFailures.set(key, 0);
    }

    // Cooldown trigger: 3 consecutive failures OR a 429
    const consecutiveNow = this.consecutiveFailures.get(key) ?? 0;
    if (consecutiveNow >= CONSECUTIVE_FAILURE_THRESHOLD || is429) {
      this.cooldownUntil.set(key, now + COOLDOWN_MS);
    }
  }

  // -------------------------------------------------------------------------
  // Record a result for a specific model (per-model cooldown isolation)
  // -------------------------------------------------------------------------

  recordModelResult(
    provider: string,
    model: string,
    latencyMs: number,
    statusCode: number,
  ): void {
    const now = Date.now();
    const key = ProviderHealthTracker.modelKey(provider, model);

    // Get or create model window
    let window = this.modelWindows.get(key);
    if (!window) {
      window = [];
      this.modelWindows.set(key, window);
    }

    // Add entry
    window.push({ latencyMs, statusCode, timestamp: now });

    // Evict stale entries
    const cutoff = now - ENTRY_TTL_MS;
    while (window.length > 0 && window[0].timestamp < cutoff) {
      window.shift();
    }

    // Trim to max window size
    while (window.length > WINDOW_SIZE) {
      window.shift();
    }

    // Track consecutive failures per model
    const isError = statusCode >= 400;
    const is429 = statusCode === 429;

    if (isError) {
      const prevFailures = this.modelConsecutiveFailures.get(key) ?? 0;
      this.modelConsecutiveFailures.set(key, prevFailures + 1);
    } else {
      this.modelConsecutiveFailures.set(key, 0);
    }

    // Cooldown per model (not per provider)
    const consecutiveNow = this.modelConsecutiveFailures.get(key) ?? 0;
    if (consecutiveNow >= CONSECUTIVE_FAILURE_THRESHOLD || is429) {
      this.modelCooldownUntil.set(key, now + COOLDOWN_MS);
    }

    // Also record at the provider level for backward compatibility
    this.recordResult(provider, latencyMs, statusCode);
  }

  // -------------------------------------------------------------------------
  // Query health for a specific model
  // -------------------------------------------------------------------------

  getModelHealth(provider: string, model: string): ProviderHealth {
    const now = Date.now();
    const key = ProviderHealthTracker.modelKey(provider, model);

    const window = this.modelWindows.get(key);
    if (!window || window.length === 0) {
      return {
        latencyP50: 0,
        latencyP95: 0,
        errorRate: 0,
        isHealthy: true,
        cooldownUntil: null,
        totalSamples: 0,
      };
    }

    const cutoff = now - ENTRY_TTL_MS;
    const active = window.filter((e) => e.timestamp >= cutoff);

    if (active.length === 0) {
      return {
        latencyP50: 0,
        latencyP95: 0,
        errorRate: 0,
        isHealthy: true,
        cooldownUntil: null,
        totalSamples: 0,
      };
    }

    const successLatencies = active
      .filter((e) => e.statusCode >= 200 && e.statusCode < 400)
      .map((e) => e.latencyMs)
      .sort((a, b) => a - b);

    const latencyP50 = percentile(successLatencies, 0.5);
    const latencyP95 = percentile(successLatencies, 0.95);

    const errorCount = active.filter((e) => e.statusCode >= 400).length;
    const errorRate = errorCount / active.length;

    const cooldown = this.modelCooldownUntil.get(key);
    const inCooldown = cooldown !== undefined && cooldown > now;

    return {
      latencyP50,
      latencyP95,
      errorRate,
      isHealthy: !inCooldown,
      cooldownUntil: inCooldown ? cooldown : null,
      totalSamples: active.length,
    };
  }

  // -------------------------------------------------------------------------
  // Query health for a single provider (aggregated across all its models)
  // -------------------------------------------------------------------------

  getProviderHealth(provider: string): ProviderHealth {
    const now = Date.now();
    const key = provider.toUpperCase();

    const window = this.windows.get(key);
    if (!window || window.length === 0) {
      return {
        latencyP50: 0,
        latencyP95: 0,
        errorRate: 0,
        isHealthy: true,
        cooldownUntil: null,
        totalSamples: 0,
      };
    }

    // Filter to non-stale entries
    const cutoff = now - ENTRY_TTL_MS;
    const active = window.filter((e) => e.timestamp >= cutoff);

    if (active.length === 0) {
      return {
        latencyP50: 0,
        latencyP95: 0,
        errorRate: 0,
        isHealthy: true,
        cooldownUntil: null,
        totalSamples: 0,
      };
    }

    // Latency percentiles (only from successful requests)
    const successLatencies = active
      .filter((e) => e.statusCode >= 200 && e.statusCode < 400)
      .map((e) => e.latencyMs)
      .sort((a, b) => a - b);

    const latencyP50 = percentile(successLatencies, 0.5);
    const latencyP95 = percentile(successLatencies, 0.95);

    // Error rate
    const errorCount = active.filter(
      (e) => e.statusCode >= 400,
    ).length;
    const errorRate = errorCount / active.length;

    // Cooldown check
    const cooldown = this.cooldownUntil.get(key);
    const inCooldown = cooldown !== undefined && cooldown > now;

    return {
      latencyP50,
      latencyP95,
      errorRate,
      isHealthy: !inCooldown,
      cooldownUntil: inCooldown ? cooldown : null,
      totalSamples: active.length,
    };
  }

  // -------------------------------------------------------------------------
  // Query health for all tracked providers
  // -------------------------------------------------------------------------

  getAllHealth(): Record<string, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};

    // Always include all supported providers
    for (const provider of SUPPORTED_PROVIDERS) {
      result[provider] = this.getProviderHealth(provider);
    }

    // Also include any extra providers that have been recorded
    for (const key of this.windows.keys()) {
      if (!(key in result)) {
        result[key] = this.getProviderHealth(key);
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Traffic shares — percentage of total recorded requests per provider
  // Used by Amdahl's law weighting in routeAuto().
  // -------------------------------------------------------------------------

  getTrafficShares(): Record<string, number> {
    const now = Date.now();
    const cutoff = now - ENTRY_TTL_MS;
    const shares: Record<string, number> = {};
    let totalActive = 0;

    // Count active (non-stale) samples per provider
    for (const [provider, window] of this.windows.entries()) {
      const activeCount = window.filter((e) => e.timestamp >= cutoff).length;
      shares[provider] = activeCount;
      totalActive += activeCount;
    }

    // Convert counts to percentages (0-1)
    if (totalActive === 0) return shares;

    for (const provider of Object.keys(shares)) {
      shares[provider] = shares[provider] / totalActive;
    }

    return shares;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const healthTracker = new ProviderHealthTracker();
