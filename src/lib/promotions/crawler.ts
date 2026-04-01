// ---------------------------------------------------------------------------
// Promotion Crawler (Stream Z1)
// ---------------------------------------------------------------------------
// Discovers ad-hoc sales and promotion periods across LLM platforms by
// analysing API response headers, pricing anomalies, time-based patterns,
// and geographic rate limit differences.
//
// Two modes of operation:
// 1. PASSIVE — `recordObservedRateLimits()` is called fire-and-forget from
//    the proxy route after every response, feeding header data into the
//    in-memory baseline tracker.
// 2. ACTIVE — `discoverPromotions()` is called by the cron endpoint every
//    30 minutes, analysing accumulated observations and checking external
//    status pages.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import type { PromotionType } from './types';

// ── Types ──────────────────────────────────────────────────────────────

interface RateLimitObservation {
  provider: string;
  region: string | null;
  timestamp: number;
  rateLimitValue: number;
  rateLimitRemaining: number;
  rateLimitReset: number | null;
  tokensLimitValue: number | null;
  costPerTokenObserved: number | null;
}

interface ProviderBaseline {
  rateLimitMean: number;
  rateLimitSamples: number;
  tokensLimitMean: number | null;
  tokensLimitSamples: number;
  costPerTokenMean: number | null;
  costPerTokenSamples: number;
  /** Per-region baselines for geo detection */
  regionBaselines: Map<string, { rateLimitMean: number; samples: number }>;
  /** Per-hour baselines for time-based detection */
  hourlyBaselines: Map<number, { rateLimitMean: number; samples: number }>;
}

interface DiscoveredPromotion {
  provider: string;
  title: string;
  type: PromotionType;
  sourceUrl: string;
  rawDescription: string;
  confidence: number;
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
  offPeakOnly: boolean;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  peakTimezone: string | null;
  eligiblePlans: string[];
}

// ── Constants ──────────────────────────────────────────────────────────

/** How many observations to keep per provider (sliding window) */
const MAX_OBSERVATIONS = 500;

/** Minimum samples before we start detecting anomalies */
const MIN_BASELINE_SAMPLES = 10;

/** Threshold: observed value must be this much above baseline to flag */
const RATE_LIMIT_BOOST_THRESHOLD = 1.5; // 50% above baseline
const PRICING_ANOMALY_THRESHOLD = 0.7; // 30% below baseline cost
const GEO_BOOST_THRESHOLD = 1.3; // 30% higher than other regions
const TIME_BOOST_THRESHOLD = 1.4; // 40% higher than other hours

/** Status page URLs for each provider */
const STATUS_PAGES: Record<string, string> = {
  anthropic: 'https://status.anthropic.com',
  openai: 'https://status.openai.com',
  google: 'https://status.cloud.google.com',
  together: 'https://status.together.ai',
  groq: 'https://status.groq.com',
};

// ── In-memory state ────────────────────────────────────────────────────

const observations = new Map<string, RateLimitObservation[]>();
const baselines = new Map<string, ProviderBaseline>();

// ── Baseline management ────────────────────────────────────────────────

function getOrCreateBaseline(provider: string): ProviderBaseline {
  const existing = baselines.get(provider);
  if (existing) return existing;

  const baseline: ProviderBaseline = {
    rateLimitMean: 0,
    rateLimitSamples: 0,
    tokensLimitMean: null,
    tokensLimitSamples: 0,
    costPerTokenMean: null,
    costPerTokenSamples: 0,
    regionBaselines: new Map(),
    hourlyBaselines: new Map(),
  };
  baselines.set(provider, baseline);
  return baseline;
}

function updateBaseline(provider: string, obs: RateLimitObservation): void {
  const b = getOrCreateBaseline(provider);

  // Update overall rate limit baseline (exponential moving average)
  if (obs.rateLimitValue > 0) {
    if (b.rateLimitSamples === 0) {
      b.rateLimitMean = obs.rateLimitValue;
    } else {
      const alpha = Math.min(0.1, 1 / b.rateLimitSamples);
      b.rateLimitMean = b.rateLimitMean * (1 - alpha) + obs.rateLimitValue * alpha;
    }
    b.rateLimitSamples++;
  }

  // Update tokens limit baseline
  if (obs.tokensLimitValue != null && obs.tokensLimitValue > 0) {
    if (b.tokensLimitSamples === 0) {
      b.tokensLimitMean = obs.tokensLimitValue;
    } else {
      const alpha = Math.min(0.1, 1 / b.tokensLimitSamples);
      b.tokensLimitMean = b.tokensLimitMean! * (1 - alpha) + obs.tokensLimitValue * alpha;
    }
    b.tokensLimitSamples++;
  }

  // Update cost baseline
  if (obs.costPerTokenObserved != null && obs.costPerTokenObserved > 0) {
    if (b.costPerTokenSamples === 0) {
      b.costPerTokenMean = obs.costPerTokenObserved;
    } else {
      const alpha = Math.min(0.1, 1 / b.costPerTokenSamples);
      b.costPerTokenMean = b.costPerTokenMean! * (1 - alpha) + obs.costPerTokenObserved * alpha;
    }
    b.costPerTokenSamples++;
  }

  // Update region baseline
  if (obs.region) {
    const regionKey = obs.region;
    const existing = b.regionBaselines.get(regionKey);
    if (!existing) {
      b.regionBaselines.set(regionKey, { rateLimitMean: obs.rateLimitValue, samples: 1 });
    } else {
      const alpha = Math.min(0.1, 1 / existing.samples);
      existing.rateLimitMean = existing.rateLimitMean * (1 - alpha) + obs.rateLimitValue * alpha;
      existing.samples++;
    }
  }

  // Update hourly baseline
  const hour = new Date(obs.timestamp).getUTCHours();
  const hourEntry = b.hourlyBaselines.get(hour);
  if (!hourEntry) {
    b.hourlyBaselines.set(hour, { rateLimitMean: obs.rateLimitValue, samples: 1 });
  } else {
    const alpha = Math.min(0.1, 1 / hourEntry.samples);
    hourEntry.rateLimitMean = hourEntry.rateLimitMean * (1 - alpha) + obs.rateLimitValue * alpha;
    hourEntry.samples++;
  }
}

// ── Header extraction ──────────────────────────────────────────────────

function extractRateLimitHeaders(headers: Headers): {
  limit: number;
  remaining: number;
  reset: number | null;
  tokensLimit: number | null;
} {
  // Standard rate limit headers (used by most providers)
  const limit = parseInt(headers.get('x-ratelimit-limit-requests') || headers.get('x-ratelimit-limit') || '0', 10);
  const remaining = parseInt(headers.get('x-ratelimit-remaining-requests') || headers.get('x-ratelimit-remaining') || '0', 10);
  const resetStr = headers.get('x-ratelimit-reset-requests') || headers.get('x-ratelimit-reset');
  const reset = resetStr ? parseInt(resetStr, 10) : null;

  // Token-based rate limits
  const tokensLimit = parseInt(headers.get('x-ratelimit-limit-tokens') || '0', 10) || null;

  return { limit, remaining, reset, tokensLimit };
}

// ── Promotion Crawler class ────────────────────────────────────────────

export class PromotionCrawler {
  /**
   * Main entry point — check all sources for promotions.
   * Called by the cron endpoint every 30 minutes.
   */
  async discoverPromotions(): Promise<DiscoveredPromotion[]> {
    const discovered: DiscoveredPromotion[] = [];

    // 1. Analyse accumulated header observations for anomalies
    const headerPromotions = this.analyseObservations();
    discovered.push(...headerPromotions);

    // 2. Check provider-specific API signals
    const anthropicPromos = await this.checkAnthropicPromotions();
    discovered.push(...anthropicPromos);

    const openaiPromos = await this.checkOpenAIPromotions();
    discovered.push(...openaiPromos);

    // 3. Check status pages for announcements
    const statusPromos = await this.checkStatusPages();
    discovered.push(...statusPromos);

    // 4. Check for geo-specific promotions
    const geoPromos = this.detectAllGeoPromotions();
    discovered.push(...geoPromos);

    // 5. Persist discovered promotions to DB
    let stored = 0;
    for (const promo of discovered) {
      try {
        await this.upsertPromotion(promo);
        stored++;
      } catch (err) {
        console.error(`[Crawler] Failed to store promotion "${promo.title}":`, err);
      }
    }

    console.log(`[Crawler] Discovered ${discovered.length} promotions, stored ${stored}`);
    return discovered;
  }

  /**
   * Check Anthropic API response headers for bonus signals.
   */
  async checkAnthropicPromotions(): Promise<DiscoveredPromotion[]> {
    const promos: DiscoveredPromotion[] = [];
    const providerObs = observations.get('ANTHROPIC') || [];
    if (providerObs.length < MIN_BASELINE_SAMPLES) return promos;

    const baseline = baselines.get('ANTHROPIC');
    if (!baseline) return promos;

    // Check recent observations (last 30 minutes) for spikes
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const recent = providerObs.filter((o) => o.timestamp > thirtyMinAgo);

    if (recent.length === 0) return promos;

    const avgRecentLimit = recent.reduce((s, o) => s + o.rateLimitValue, 0) / recent.length;

    if (baseline.rateLimitMean > 0 && avgRecentLimit / baseline.rateLimitMean > RATE_LIMIT_BOOST_THRESHOLD) {
      promos.push({
        provider: 'anthropic',
        title: `Anthropic rate limit boost detected (${Math.round(avgRecentLimit / baseline.rateLimitMean * 100 - 100)}% increase)`,
        type: 'RATE_LIMIT_BOOST',
        sourceUrl: 'header_detection:anthropic',
        rawDescription: `Rate limit increased from baseline ${Math.round(baseline.rateLimitMean)} to ${Math.round(avgRecentLimit)} requests. Detected via API response header analysis.`,
        confidence: Math.min(0.9, 0.4 + (recent.length / 50) * 0.5),
        multiplier: avgRecentLimit / baseline.rateLimitMean,
        startsAt: new Date(recent[0].timestamp),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // assume 24h window
        offPeakOnly: false,
        peakHoursStart: null,
        peakHoursEnd: null,
        peakTimezone: null,
        eligiblePlans: ['All'],
      });
    }

    return promos;
  }

  /**
   * Check OpenAI API response headers for bonus signals.
   */
  async checkOpenAIPromotions(): Promise<DiscoveredPromotion[]> {
    const promos: DiscoveredPromotion[] = [];
    const providerObs = observations.get('OPENAI') || [];
    if (providerObs.length < MIN_BASELINE_SAMPLES) return promos;

    const baseline = baselines.get('OPENAI');
    if (!baseline) return promos;

    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const recent = providerObs.filter((o) => o.timestamp > thirtyMinAgo);

    if (recent.length === 0) return promos;

    const avgRecentLimit = recent.reduce((s, o) => s + o.rateLimitValue, 0) / recent.length;

    if (baseline.rateLimitMean > 0 && avgRecentLimit / baseline.rateLimitMean > RATE_LIMIT_BOOST_THRESHOLD) {
      promos.push({
        provider: 'openai',
        title: `OpenAI rate limit boost detected (${Math.round(avgRecentLimit / baseline.rateLimitMean * 100 - 100)}% increase)`,
        type: 'RATE_LIMIT_BOOST',
        sourceUrl: 'header_detection:openai',
        rawDescription: `Rate limit increased from baseline ${Math.round(baseline.rateLimitMean)} to ${Math.round(avgRecentLimit)} requests. Detected via API response header analysis.`,
        confidence: Math.min(0.9, 0.4 + (recent.length / 50) * 0.5),
        multiplier: avgRecentLimit / baseline.rateLimitMean,
        startsAt: new Date(recent[0].timestamp),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offPeakOnly: false,
        peakHoursStart: null,
        peakHoursEnd: null,
        peakTimezone: null,
        eligiblePlans: ['All'],
      });
    }

    // Check for pricing anomalies
    if (
      baseline.costPerTokenMean != null &&
      baseline.costPerTokenSamples >= MIN_BASELINE_SAMPLES
    ) {
      const recentWithCost = recent.filter((o) => o.costPerTokenObserved != null && o.costPerTokenObserved! > 0);
      if (recentWithCost.length > 3) {
        const avgCost = recentWithCost.reduce((s, o) => s + o.costPerTokenObserved!, 0) / recentWithCost.length;
        if (avgCost / baseline.costPerTokenMean < PRICING_ANOMALY_THRESHOLD) {
          promos.push({
            provider: 'openai',
            title: `OpenAI pricing anomaly detected (${Math.round((1 - avgCost / baseline.costPerTokenMean) * 100)}% cheaper)`,
            type: 'PRICE_DISCOUNT',
            sourceUrl: 'pricing_detection:openai',
            rawDescription: `Observed cost per token dropped from baseline $${baseline.costPerTokenMean.toFixed(8)} to $${avgCost.toFixed(8)}. May indicate a promotion or price adjustment.`,
            confidence: Math.min(0.8, 0.3 + (recentWithCost.length / 30) * 0.5),
            multiplier: baseline.costPerTokenMean / avgCost,
            startsAt: new Date(recentWithCost[0].timestamp),
            endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            offPeakOnly: false,
            peakHoursStart: null,
            peakHoursEnd: null,
            peakTimezone: null,
            eligiblePlans: ['All'],
          });
        }
      }
    }

    return promos;
  }

  /**
   * Fetch provider status pages for promotional announcements.
   */
  async checkStatusPages(): Promise<DiscoveredPromotion[]> {
    const promos: DiscoveredPromotion[] = [];

    for (const [provider, url] of Object.entries(STATUS_PAGES)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'InferLane-PromotionCrawler/1.0',
            Accept: 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) continue;

        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        // Look for promotion-related keywords on status pages
        const promoKeywords = ['bonus', 'increased capacity', 'rate limit increase', 'promotion', 'free credits', 'doubled', 'tripled'];
        const matched = promoKeywords.filter((kw) => text.includes(kw));

        if (matched.length >= 2) {
          promos.push({
            provider,
            title: `${provider} status page indicates potential promotion (${matched.join(', ')})`,
            type: 'USAGE_BONUS',
            sourceUrl: url,
            rawDescription: `Status page at ${url} contains promotion keywords: ${matched.join(', ')}. Manual verification recommended.`,
            confidence: 0.3,
            multiplier: 1.0,
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            offPeakOnly: false,
            peakHoursStart: null,
            peakHoursEnd: null,
            peakTimezone: null,
            eligiblePlans: ['All'],
          });
        }
      } catch {
        // Status page fetch failures are expected and non-critical
      }
    }

    return promos;
  }

  /**
   * Check for region-specific promotions by comparing rate limits
   * across different geographic regions.
   */
  detectGeoPromotions(region: string): DiscoveredPromotion[] {
    const promos: DiscoveredPromotion[] = [];

    for (const [provider, baseline] of baselines.entries()) {
      if (baseline.rateLimitSamples < MIN_BASELINE_SAMPLES) continue;

      const regionData = baseline.regionBaselines.get(region);
      if (!regionData || regionData.samples < 5) continue;

      // Compare this region's rate limit to the overall baseline
      if (baseline.rateLimitMean > 0 && regionData.rateLimitMean / baseline.rateLimitMean > GEO_BOOST_THRESHOLD) {
        promos.push({
          provider: provider.toLowerCase(),
          title: `${provider} geo promotion: ${region} has ${Math.round(regionData.rateLimitMean / baseline.rateLimitMean * 100 - 100)}% higher rate limits`,
          type: 'RATE_LIMIT_BOOST',
          sourceUrl: `geo_detection:${provider.toLowerCase()}:${region}`,
          rawDescription: `Region ${region} shows rate limit of ${Math.round(regionData.rateLimitMean)} vs global baseline of ${Math.round(baseline.rateLimitMean)}. This may indicate a geographic promotion or regional capacity increase.`,
          confidence: Math.min(0.7, 0.3 + (regionData.samples / 30) * 0.4),
          multiplier: regionData.rateLimitMean / baseline.rateLimitMean,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          offPeakOnly: false,
          peakHoursStart: null,
          peakHoursEnd: null,
          peakTimezone: null,
          eligiblePlans: ['All'],
        });
      }
    }

    return promos;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Detect all geo promotions across all known regions.
   */
  private detectAllGeoPromotions(): DiscoveredPromotion[] {
    const allPromos: DiscoveredPromotion[] = [];
    const allRegions = new Set<string>();

    for (const baseline of baselines.values()) {
      for (const region of baseline.regionBaselines.keys()) {
        allRegions.add(region);
      }
    }

    for (const region of allRegions) {
      allPromos.push(...this.detectGeoPromotions(region));
    }

    return allPromos;
  }

  /**
   * Analyse all accumulated observations for time-based patterns.
   * Detects if certain hours consistently have higher rate limits.
   */
  private analyseObservations(): DiscoveredPromotion[] {
    const promos: DiscoveredPromotion[] = [];

    for (const [provider, baseline] of baselines.entries()) {
      if (baseline.rateLimitSamples < MIN_BASELINE_SAMPLES) continue;

      // Find hours with significantly higher rate limits
      const boostedHours: number[] = [];

      for (const [hour, hourData] of baseline.hourlyBaselines.entries()) {
        if (hourData.samples < 5) continue;
        if (baseline.rateLimitMean > 0 && hourData.rateLimitMean / baseline.rateLimitMean > TIME_BOOST_THRESHOLD) {
          boostedHours.push(hour);
        }
      }

      if (boostedHours.length > 0 && boostedHours.length < 12) {
        // Only flag if it's a subset of hours (not all-day boost)
        boostedHours.sort((a, b) => a - b);
        const startHour = boostedHours[0];
        const endHour = boostedHours[boostedHours.length - 1] + 1;

        promos.push({
          provider: provider.toLowerCase(),
          title: `${provider} off-peak rate limit boost detected (${startHour}:00-${endHour}:00 UTC)`,
          type: 'RATE_LIMIT_BOOST',
          sourceUrl: `time_detection:${provider.toLowerCase()}`,
          rawDescription: `Rate limits are ${Math.round((boostedHours.reduce((sum, h) => {
            const hd = baseline.hourlyBaselines.get(h);
            return sum + (hd ? hd.rateLimitMean : 0);
          }, 0) / boostedHours.length / baseline.rateLimitMean - 1) * 100)}% higher during hours ${boostedHours.join(', ')} UTC. Likely off-peak capacity increase.`,
          confidence: Math.min(0.8, 0.4 + (boostedHours.length * 0.05)),
          multiplier: boostedHours.reduce((sum, h) => {
            const hd = baseline.hourlyBaselines.get(h);
            return sum + (hd ? hd.rateLimitMean : baseline.rateLimitMean);
          }, 0) / boostedHours.length / baseline.rateLimitMean,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // recurring pattern
          offPeakOnly: true,
          peakHoursStart: `${endHour}:00`,
          peakHoursEnd: `${startHour}:00`,
          peakTimezone: 'UTC',
          eligiblePlans: ['All'],
        });
      }

      // Check for pricing anomalies across all providers
      if (
        baseline.costPerTokenMean != null &&
        baseline.costPerTokenSamples >= MIN_BASELINE_SAMPLES
      ) {
        const providerObs = observations.get(provider) || [];
        const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
        const recentWithCost = providerObs.filter(
          (o) => o.timestamp > thirtyMinAgo && o.costPerTokenObserved != null && o.costPerTokenObserved! > 0,
        );

        if (recentWithCost.length > 3) {
          const avgCost = recentWithCost.reduce((s, o) => s + o.costPerTokenObserved!, 0) / recentWithCost.length;
          if (avgCost / baseline.costPerTokenMean < PRICING_ANOMALY_THRESHOLD) {
            promos.push({
              provider: provider.toLowerCase(),
              title: `${provider} pricing anomaly: ${Math.round((1 - avgCost / baseline.costPerTokenMean) * 100)}% below baseline`,
              type: 'PRICE_DISCOUNT',
              sourceUrl: `pricing_detection:${provider.toLowerCase()}`,
              rawDescription: `Observed cost per token is $${avgCost.toFixed(8)} vs baseline $${baseline.costPerTokenMean.toFixed(8)}.`,
              confidence: Math.min(0.7, 0.3 + (recentWithCost.length / 20) * 0.4),
              multiplier: baseline.costPerTokenMean / avgCost,
              startsAt: new Date(recentWithCost[0].timestamp),
              endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              offPeakOnly: false,
              peakHoursStart: null,
              peakHoursEnd: null,
              peakTimezone: null,
              eligiblePlans: ['All'],
            });
          }
        }
      }
    }

    return promos;
  }

  /**
   * Upsert a discovered promotion into the database.
   */
  private async upsertPromotion(promo: DiscoveredPromotion): Promise<void> {
    const existing = await prisma.providerPromotion.findFirst({
      where: {
        provider: promo.provider,
        sourceUrl: promo.sourceUrl,
        status: { in: ['ACTIVE', 'UPCOMING'] },
      },
    });

    if (existing) {
      // Update if we have higher confidence or new data
      if (promo.confidence > existing.confidence || promo.multiplier !== existing.multiplier) {
        await prisma.providerPromotion.update({
          where: { id: existing.id },
          data: {
            title: promo.title,
            rawDescription: promo.rawDescription,
            confidence: Math.max(promo.confidence, existing.confidence),
            multiplier: promo.multiplier,
            offPeakOnly: promo.offPeakOnly,
            peakHoursStart: promo.peakHoursStart,
            peakHoursEnd: promo.peakHoursEnd,
            peakTimezone: promo.peakTimezone,
          },
        });
      }
    } else {
      await prisma.providerPromotion.create({
        data: {
          provider: promo.provider,
          title: promo.title,
          type: promo.type,
          sourceUrl: promo.sourceUrl,
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
          eligiblePlans: promo.eligiblePlans,
          multiplier: promo.multiplier,
          offPeakOnly: promo.offPeakOnly,
          peakHoursStart: promo.peakHoursStart,
          peakHoursEnd: promo.peakHoursEnd,
          peakTimezone: promo.peakTimezone,
          affectedSurfaces: [],
          rawDescription: promo.rawDescription,
          confidence: promo.confidence,
          status: promo.startsAt <= new Date() ? 'ACTIVE' : 'UPCOMING',
        },
      });
    }
  }
}

// ── Singleton & passive integration ────────────────────────────────────

/** Singleton crawler instance */
export const promotionCrawler = new PromotionCrawler();

/**
 * Record observed rate limits from a proxy response.
 * Called fire-and-forget from the proxy route after each response.
 * Feeds data into the passive promotion detection pipeline.
 */
export function recordObservedRateLimits(
  provider: string,
  headers: Headers,
  region?: string,
  costPerTokenObserved?: number,
): void {
  try {
    const { limit, remaining, reset, tokensLimit } = extractRateLimitHeaders(headers);

    // Skip if no rate limit data available
    if (limit === 0 && remaining === 0) return;

    const obs: RateLimitObservation = {
      provider: provider.toUpperCase(),
      region: region || null,
      timestamp: Date.now(),
      rateLimitValue: limit,
      rateLimitRemaining: remaining,
      rateLimitReset: reset,
      tokensLimitValue: tokensLimit,
      costPerTokenObserved: costPerTokenObserved ?? null,
    };

    // Store observation (sliding window)
    const key = provider.toUpperCase();
    const providerObs = observations.get(key) || [];
    providerObs.push(obs);

    // Trim to max window size
    if (providerObs.length > MAX_OBSERVATIONS) {
      providerObs.splice(0, providerObs.length - MAX_OBSERVATIONS);
    }
    observations.set(key, providerObs);

    // Update baseline
    updateBaseline(key, obs);
  } catch {
    // Never fail a proxy request over rate limit recording
  }
}
