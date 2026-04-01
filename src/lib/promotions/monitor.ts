// ---------------------------------------------------------------------------
// Promotion Monitor Engine (Stream Z1)
// ---------------------------------------------------------------------------
// Scans provider sources for new promotions, detects changes, and checks
// API headers for passive promotion discovery.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { classifyContent, type PromotionScanResult } from './classifier';
import { createHash } from 'crypto';

// ── Provider source registry ───────────────────────────────────────────

interface ProviderSource {
  provider: string;
  url: string;
  label: string;
}

export const PROVIDER_SOURCES: ProviderSource[] = [
  // Anthropic
  { provider: 'anthropic', url: 'https://support.claude.com/en/articles', label: 'Claude Support Articles' },
  { provider: 'anthropic', url: 'https://www.anthropic.com/news', label: 'Anthropic Blog' },
  // OpenAI
  { provider: 'openai', url: 'https://openai.com/blog', label: 'OpenAI Blog' },
  { provider: 'openai', url: 'https://platform.openai.com/docs/changelog', label: 'OpenAI Changelog' },
  // Google
  { provider: 'google', url: 'https://ai.google.dev/changelog', label: 'Google AI Changelog' },
  { provider: 'google', url: 'https://blog.google/technology/ai/', label: 'Google AI Blog' },
  // Together
  { provider: 'together', url: 'https://www.together.ai/blog', label: 'Together Blog' },
  // Groq
  { provider: 'groq', url: 'https://groq.com/news/', label: 'Groq News' },
  // Fireworks
  { provider: 'fireworks', url: 'https://fireworks.ai/blog', label: 'Fireworks Blog' },
];

// ── In-memory hash store (persists across invocations in same process) ──

const hashStore = new Map<string, string>();

// ── Types ──────────────────────────────────────────────────────────────

interface FetchDiffResult {
  changed: boolean;
  content: string;
  newHash: string;
}

interface ScanResult {
  source: ProviderSource;
  changed: boolean;
  promotion: PromotionScanResult | null;
}

// ── HTML text extraction ───────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Core functions ─────────────────────────────────────────────────────

/**
 * Fetch a URL, hash its text content, and compare to the previous hash.
 */
export async function fetchAndDiff(
  url: string,
  lastHash?: string,
): Promise<FetchDiffResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'InferLane-PromotionMonitor/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const content = stripHtml(html);
  const newHash = createHash('sha256').update(content).digest('hex');
  const previousHash = lastHash ?? hashStore.get(url);

  // Update stored hash
  hashStore.set(url, newHash);

  return {
    changed: previousHash !== undefined ? newHash !== previousHash : true,
    content,
    newHash,
  };
}

/**
 * Main entry point: scan all provider sources for new promotions.
 * Called by the cron route.
 */
export async function scanProviderSources(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (const source of PROVIDER_SOURCES) {
    try {
      const diff = await fetchAndDiff(source.url, hashStore.get(source.url));

      if (!diff.changed) {
        results.push({ source, changed: false, promotion: null });
        continue;
      }

      // Content changed — classify it
      const promotion = classifyContent(diff.content, source.url, source.provider);
      results.push({ source, changed: true, promotion });
    } catch (error) {
      console.error(`[PromotionMonitor] Failed to scan ${source.url}:`, error);
      results.push({ source, changed: false, promotion: null });
    }
  }

  return results;
}

// ── Header-based passive detection ─────────────────────────────────────

interface HeaderDetection {
  type: string;
  detail: string;
}

const PROMOTIONAL_HEADERS = [
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-promotion',
  'x-bonus',
  'x-credits-remaining',
  'x-free-tier',
  'x-rate-limit-bonus',
];

/**
 * Passive detection: check API response headers for promotional signals.
 * Called fire-and-forget from the proxy route on every request.
 */
export function checkApiHeaders(
  provider: string,
  headers: Headers,
): HeaderDetection[] {
  const detections: HeaderDetection[] = [];

  for (const headerName of PROMOTIONAL_HEADERS) {
    const value = headers.get(headerName);
    if (!value) continue;

    // Check for unusually high rate limits (potential promotion)
    if (headerName === 'x-ratelimit-limit') {
      const limit = parseInt(value, 10);
      if (!isNaN(limit) && limit > 10_000) {
        detections.push({
          type: 'rate_limit_boost',
          detail: `${provider}: rate limit at ${limit} (unusually high)`,
        });
      }
    }

    // Explicit promotion headers
    if (headerName === 'x-promotion' || headerName === 'x-bonus') {
      detections.push({
        type: 'explicit_promotion',
        detail: `${provider}: ${headerName}=${value}`,
      });
    }

    // Free tier / credits signals
    if (headerName === 'x-credits-remaining' || headerName === 'x-free-tier') {
      detections.push({
        type: 'credit_signal',
        detail: `${provider}: ${headerName}=${value}`,
      });
    }
  }

  return detections;
}

// ── DB query helpers ───────────────────────────────────────────────────

interface ProviderPromotionRecord {
  id: string;
  provider: string;
  title: string;
  type: string;
  sourceUrl: string;
  startsAt: Date;
  endsAt: Date;
  eligiblePlans: string[];
  multiplier: number;
  offPeakOnly: boolean;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  peakTimezone: string | null;
  status: string;
  confidence: number;
}

/**
 * Query DB for all promotions with status ACTIVE and endsAt > now.
 */
export async function getActivePromotions(): Promise<ProviderPromotionRecord[]> {
  const now = new Date();

  const promotions = await prisma.providerPromotion.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: { gt: now },
    },
    orderBy: { endsAt: 'asc' },
  });

  return promotions as unknown as ProviderPromotionRecord[];
}

/**
 * Check if right now is within a promotion's active window,
 * respecting off-peak hours if configured.
 */
export function isInPromotionWindow(promotion: ProviderPromotionRecord): boolean {
  const now = new Date();

  // Basic date range check
  if (now < promotion.startsAt || now > promotion.endsAt) {
    return false;
  }

  // If not off-peak-only, it's always active within the date range
  if (!promotion.offPeakOnly) {
    return true;
  }

  // Off-peak check: must have peak hours defined
  if (!promotion.peakHoursStart || !promotion.peakHoursEnd) {
    // No peak hours defined — treat as always active
    return true;
  }

  // Get current hour in the promotion's timezone
  const tz = promotion.peakTimezone || 'America/Los_Angeles';
  let currentHour: number;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    currentHour = parseInt(formatter.format(now), 10);
  } catch {
    // Invalid timezone — fall back to UTC
    currentHour = now.getUTCHours();
  }

  // Parse peak hours (format: "HH:MM" or just "HH")
  const peakStart = parseInt(promotion.peakHoursStart.split(':')[0], 10);
  const peakEnd = parseInt(promotion.peakHoursEnd.split(':')[0], 10);

  // Off-peak = outside peak hours
  if (peakStart <= peakEnd) {
    // Simple range: peak is e.g. 9-17
    // Off-peak = before peakStart or after peakEnd
    return currentHour < peakStart || currentHour >= peakEnd;
  } else {
    // Wrapped range: peak is e.g. 22-06 (overnight)
    // Peak = 22,23,0,1,2,3,4,5
    // Off-peak = 6..21
    return currentHour >= peakEnd && currentHour < peakStart;
  }
}
