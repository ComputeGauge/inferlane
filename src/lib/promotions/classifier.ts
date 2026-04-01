// ---------------------------------------------------------------------------
// Promotion Classifier (Stream Z1)
// ---------------------------------------------------------------------------
// Fast, regex + heuristic-based classifier for detecting promotions in
// scraped text. No LLM calls — designed to run cheaply in cron.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────

export interface PromotionScanResult {
  provider: string;
  title: string;
  sourceUrl: string;
  type: 'USAGE_BONUS' | 'PRICE_DISCOUNT' | 'FREE_TIER' | 'CREDIT_GRANT' | 'NEW_MODEL_PREVIEW' | 'RATE_LIMIT_BOOST';
  startsAt: Date | null;
  endsAt: Date | null;
  eligiblePlans: string[];
  multiplier: number;
  offPeakOnly: boolean;
  rawDescription: string;
  confidence: number;
}

// ── Keyword patterns ───────────────────────────────────────────────────

const PROMOTION_KEYWORDS = [
  'promotion', 'promo', 'bonus', 'doubled', 'tripled',
  '2x', '3x', '4x', '5x', '10x',
  'free', 'discount', 'off-peak', 'limited time',
  'expires', 'credit', 'credits', 'increased limits',
  'rate limit increase', 'extended', 'complimentary',
  'no charge', 'at no cost', 'introductory', 'launch offer',
  'early access', 'preview', 'beta access', 'free tier',
  'price reduction', 'price cut', 'reduced pricing',
] as const;

const DISCOUNT_KEYWORDS = ['discount', 'off', 'reduced', 'price cut', 'price reduction', 'cheaper', 'reduced pricing'];
const CREDIT_KEYWORDS = ['credit', 'credits', 'grant', 'complimentary', 'at no cost', 'no charge'];
const FREE_TIER_KEYWORDS = ['free tier', 'free plan', 'free access', 'free usage', 'no cost'];
const BONUS_KEYWORDS = ['bonus', 'doubled', 'tripled', '2x', '3x', '4x', '5x', '10x', 'increased', 'boost'];
const RATE_LIMIT_KEYWORDS = ['rate limit', 'rate-limit', 'requests per minute', 'rpm', 'tpm', 'tokens per minute'];
const PREVIEW_KEYWORDS = ['preview', 'early access', 'beta', 'launch', 'new model', 'introducing'];

// ── Plan detection ─────────────────────────────────────────────────────

const PLAN_PATTERNS: Array<{ pattern: RegExp; plan: string }> = [
  { pattern: /\bfree\s+(plan|tier|users?)\b/i, plan: 'Free' },
  { pattern: /\bpro\s+(plan|tier|users?)\b/i, plan: 'Pro' },
  { pattern: /\bmax\s+(plan|tier|users?)\b/i, plan: 'Max' },
  { pattern: /\bteam\s+(plan|tier|users?)\b/i, plan: 'Team' },
  { pattern: /\benterprise\s+(plan|tier|users?)\b/i, plan: 'Enterprise' },
  { pattern: /\bplus\s+(plan|tier|users?)\b/i, plan: 'Plus' },
  { pattern: /\bstarter\s+(plan|tier|users?)\b/i, plan: 'Starter' },
  { pattern: /\ball\s+(plans|tiers|users)\b/i, plan: 'All' },
];

// ── Date parsing ───────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Extract start and end dates from promotional text.
 * Looks for patterns like "March 15, 2026", "2026-03-15", "through April 30", "until May 1st".
 */
export function parsePromotionDates(text: string): { startsAt: Date | null; endsAt: Date | null } {
  const dates: Date[] = [];

  // Pattern: Month DD, YYYY (e.g. "March 15, 2026")
  const monthDayYear = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/gi;
  let match;
  while ((match = monthDayYear.exec(text)) !== null) {
    const month = MONTH_MAP[match[1].toLowerCase()];
    if (month !== undefined) {
      dates.push(new Date(parseInt(match[3]), month, parseInt(match[2])));
    }
  }

  // Pattern: ISO date YYYY-MM-DD
  const isoDate = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((match = isoDate.exec(text)) !== null) {
    const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(d.getTime())) dates.push(d);
  }

  // Pattern: MM/DD/YYYY
  const slashDate = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((match = slashDate.exec(text)) !== null) {
    const d = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
    if (!isNaN(d.getTime())) dates.push(d);
  }

  // Sort dates chronologically
  dates.sort((a, b) => a.getTime() - b.getTime());

  // Check for "through" / "until" / "ends" patterns for end date
  const endPattern = /(?:through|until|ends?|expires?|valid\s+(?:through|until))\s+(?:the\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/gi;
  let endDate: Date | null = null;
  while ((match = endPattern.exec(text)) !== null) {
    const month = MONTH_MAP[match[1].toLowerCase()];
    const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
    if (month !== undefined) {
      endDate = new Date(year, month, parseInt(match[2]));
    }
  }

  if (dates.length === 0) {
    return { startsAt: null, endsAt: endDate };
  }
  if (dates.length === 1) {
    return { startsAt: dates[0], endsAt: endDate ?? null };
  }
  return { startsAt: dates[0], endsAt: endDate ?? dates[dates.length - 1] };
}

// ── Plan parsing ───────────────────────────────────────────────────────

/**
 * Extract which plans/tiers are eligible for the promotion.
 */
export function parseEligiblePlans(text: string): string[] {
  const plans = new Set<string>();

  for (const { pattern, plan } of PLAN_PATTERNS) {
    if (pattern.test(text)) {
      plans.add(plan);
    }
  }

  // If "All" is detected, return just ["All"]
  if (plans.has('All')) return ['All'];

  return Array.from(plans);
}

// ── Multiplier parsing ─────────────────────────────────────────────────

/**
 * Extract usage multiplier (2x, doubled, etc.) from text.
 * Returns 1.0 if no multiplier found.
 */
export function parseMultiplier(text: string): number {
  // Explicit multiplier: 2x, 3x, 4x, 5x, 10x
  const explicitMatch = text.match(/\b(\d+(?:\.\d+)?)\s*x\b/i);
  if (explicitMatch) return parseFloat(explicitMatch[1]);

  // Word multipliers
  if (/\bdoubled?\b/i.test(text)) return 2;
  if (/\btripled?\b/i.test(text)) return 3;
  if (/\bquadrupled?\b/i.test(text)) return 4;

  // Percentage increase: "50% more", "100% increase"
  const pctMatch = text.match(/(\d+)%\s+(?:more|increase|bonus|extra)/i);
  if (pctMatch) return 1 + parseInt(pctMatch[1]) / 100;

  return 1.0;
}

// ── Confidence scoring ─────────────────────────────────────────────────

/**
 * Score 0-1 based on how many fields were successfully extracted.
 * More extracted fields = higher confidence that this is a real promotion.
 */
export function calculateConfidence(result: PromotionScanResult): number {
  let score = 0;
  let factors = 0;

  // Has a recognized type (always true if we got here, but weight it)
  factors++;
  score += 1;

  // Has dates
  factors++;
  if (result.startsAt) score += 0.5;
  if (result.endsAt) score += 0.5;

  // Has eligible plans
  factors++;
  if (result.eligiblePlans.length > 0) score += 1;

  // Has a meaningful multiplier
  factors++;
  if (result.multiplier > 1) score += 1;

  // Raw description length (longer = more detail = higher confidence)
  factors++;
  if (result.rawDescription.length > 200) score += 1;
  else if (result.rawDescription.length > 50) score += 0.5;

  return Math.min(1, score / factors);
}

// ── Value estimation ───────────────────────────────────────────────────

/**
 * Rough estimate of dollar value for an average user.
 * Based on typical compute spend of ~$50/month.
 */
export function estimatePromotionValue(promotion: {
  type: string;
  multiplier: number;
  startsAt: Date | null;
  endsAt: Date | null;
}): number {
  const avgMonthlySpend = 50; // $50/month baseline

  // Duration in days (default 30 if unknown)
  let durationDays = 30;
  if (promotion.startsAt && promotion.endsAt) {
    durationDays = Math.max(1, Math.round(
      (promotion.endsAt.getTime() - promotion.startsAt.getTime()) / (1000 * 60 * 60 * 24),
    ));
  }
  const durationFraction = durationDays / 30;

  switch (promotion.type) {
    case 'USAGE_BONUS':
      // Extra tokens/usage at multiplier rate
      return avgMonthlySpend * (promotion.multiplier - 1) * durationFraction;

    case 'PRICE_DISCOUNT':
      // Direct price savings
      return avgMonthlySpend * (1 - 1 / Math.max(1, promotion.multiplier)) * durationFraction;

    case 'FREE_TIER':
      // Full cost savings
      return avgMonthlySpend * durationFraction;

    case 'CREDIT_GRANT':
      // Typically a fixed amount; estimate based on multiplier as $ value
      return promotion.multiplier > 1 ? promotion.multiplier * 10 : 25;

    case 'RATE_LIMIT_BOOST':
      // Value is in throughput, not direct $; estimate at 20% of spend
      return avgMonthlySpend * 0.2 * durationFraction;

    case 'NEW_MODEL_PREVIEW':
      // Hard to value; nominal
      return 10;

    default:
      return 0;
  }
}

// ── Main classifier ────────────────────────────────────────────────────

/**
 * Analyse text to determine if it contains a promotion.
 * Uses pattern matching and keyword detection (no LLM calls).
 * Returns null if no promotion is detected.
 */
export function classifyContent(
  content: string,
  sourceUrl: string,
  provider: string,
): PromotionScanResult | null {
  const lowerContent = content.toLowerCase();

  // Count keyword hits
  let keywordHits = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of PROMOTION_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      keywordHits++;
      matchedKeywords.push(keyword);
    }
  }

  // Need at least 2 keyword hits to consider it promotional
  if (keywordHits < 2) return null;

  // Determine promotion type
  const type = inferPromotionType(lowerContent);

  // Extract structured data
  const { startsAt, endsAt } = parsePromotionDates(content);
  const eligiblePlans = parseEligiblePlans(content);
  const multiplier = parseMultiplier(content);
  const offPeakOnly = /\boff[\s-]?peak\b/i.test(content);

  // Extract a title — first sentence containing a keyword, capped at 120 chars
  const title = extractTitle(content, matchedKeywords) || `${provider} promotion detected`;

  // Build the raw description — relevant sentences containing keywords
  const rawDescription = extractRelevantSentences(content, matchedKeywords);

  const result: PromotionScanResult = {
    provider,
    title,
    sourceUrl,
    type,
    startsAt,
    endsAt,
    eligiblePlans,
    multiplier,
    offPeakOnly,
    rawDescription,
    confidence: 0,
  };

  result.confidence = calculateConfidence(result);

  // Only return if confidence is above threshold
  if (result.confidence < 0.2) return null;

  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────

function inferPromotionType(
  text: string,
): PromotionScanResult['type'] {
  // Check in priority order
  if (RATE_LIMIT_KEYWORDS.some((k) => text.includes(k))) return 'RATE_LIMIT_BOOST';
  if (FREE_TIER_KEYWORDS.some((k) => text.includes(k))) return 'FREE_TIER';
  if (CREDIT_KEYWORDS.some((k) => text.includes(k))) return 'CREDIT_GRANT';
  if (DISCOUNT_KEYWORDS.some((k) => text.includes(k))) return 'PRICE_DISCOUNT';
  if (PREVIEW_KEYWORDS.some((k) => text.includes(k))) return 'NEW_MODEL_PREVIEW';
  if (BONUS_KEYWORDS.some((k) => text.includes(k))) return 'USAGE_BONUS';

  // Default
  return 'USAGE_BONUS';
}

function extractTitle(content: string, keywords: string[]): string | null {
  // Split into sentences
  const sentences = content.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
    }
  }

  return null;
}

function extractRelevantSentences(content: string, keywords: string[]): string {
  const sentences = content.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const relevant: string[] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      relevant.push(sentence);
      if (relevant.length >= 5) break; // Cap at 5 sentences
    }
  }

  return relevant.join('. ') || content.slice(0, 500);
}
