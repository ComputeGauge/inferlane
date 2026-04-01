// Stream Z — Promotion Intelligence & Prompt Scheduling Engine
// Type definitions for promotions, scheduled prompts, and templates

// ---------------------------------------------------------------------------
// Enums (const objects for runtime access + type extraction)
// ---------------------------------------------------------------------------

export const PromotionType = {
  USAGE_BONUS: 'USAGE_BONUS',
  PRICE_DISCOUNT: 'PRICE_DISCOUNT',
  FREE_TIER: 'FREE_TIER',
  CREDIT_GRANT: 'CREDIT_GRANT',
  NEW_MODEL_PREVIEW: 'NEW_MODEL_PREVIEW',
  RATE_LIMIT_BOOST: 'RATE_LIMIT_BOOST',
} as const;
export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const PromotionStatus = {
  UPCOMING: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
} as const;
export type PromotionStatus = (typeof PromotionStatus)[keyof typeof PromotionStatus];

export const ScheduledPromptStatus = {
  QUEUED: 'QUEUED',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type ScheduledPromptStatus = (typeof ScheduledPromptStatus)[keyof typeof ScheduledPromptStatus];

export const ScheduleType = {
  IMMEDIATE: 'IMMEDIATE',
  TIME_BASED: 'TIME_BASED',
  PROMOTION_TRIGGERED: 'PROMOTION_TRIGGERED',
  PRICE_TRIGGERED: 'PRICE_TRIGGERED',
  RECURRING: 'RECURRING',
  OPTIMAL_WINDOW: 'OPTIMAL_WINDOW',
} as const;
export type ScheduleType = (typeof ScheduleType)[keyof typeof ScheduleType];

export const PromotionSource = {
  RSS: 'RSS',
  BLOG: 'BLOG',
  SUPPORT_ARTICLE: 'SUPPORT_ARTICLE',
  API_CHANGELOG: 'API_CHANGELOG',
  TWITTER: 'TWITTER',
  HACKERNEWS: 'HACKERNEWS',
  REDDIT: 'REDDIT',
  EMAIL: 'EMAIL',
  API_HEADER: 'API_HEADER',
  MANUAL: 'MANUAL',
} as const;
export type PromotionSource = (typeof PromotionSource)[keyof typeof PromotionSource];

// ---------------------------------------------------------------------------
// Core interfaces (matching Prisma schema)
// ---------------------------------------------------------------------------

export interface ProviderPromotion {
  id: string;
  provider: string;
  title: string;
  type: PromotionType;
  sourceUrl: string;
  detectedAt: Date;
  startsAt: Date;
  endsAt: Date;
  eligiblePlans: string[];
  multiplier: number;
  offPeakOnly: boolean;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  peakTimezone: string | null;
  affectedSurfaces: string[];
  stacksWithOther: boolean;
  rawDescription: string;
  confidence: number;
  status: PromotionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPrompt {
  id: string;
  userId: string;
  title: string;
  status: ScheduledPromptStatus;
  priority: string;
  model: string;
  systemPrompt: string | null;
  messages: Record<string, unknown>[];
  parameters: Record<string, unknown>;
  scheduleType: ScheduleType;
  scheduledAt: Date | null;
  cronExpression: string | null;
  promotionFilter: Record<string, unknown> | null;
  priceThreshold: Record<string, unknown> | null;
  executedAt: Date | null;
  response: string | null;
  tokensUsed: Record<string, unknown> | null;
  costCents: number | null;
  savingsCents: number | null;
  error: string | null;
  batchId: string | null;
  dependsOn: string[];
  chainIndex: number | null;
  promotionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptTemplate {
  id: string;
  userId: string;
  title: string;
  category: string;
  model: string;
  systemPrompt: string | null;
  messages: Record<string, unknown>[];
  parameters: Record<string, unknown>;
  autoQueue: boolean;
  lastUsedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Promotion scanning & detection
// ---------------------------------------------------------------------------

export interface PromotionScanResult {
  source: PromotionSource;
  sourceUrl: string;
  provider: string;
  rawText: string;
  detectedPromotions: Omit<ProviderPromotion, 'id' | 'createdAt' | 'updatedAt'>[];
  scannedAt: Date;
  confidence: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Scheduling conditions & chains
// ---------------------------------------------------------------------------

export interface ScheduleCondition {
  type: ScheduleType;
  /** ISO datetime for TIME_BASED */
  scheduledAt?: string;
  /** Cron expression for RECURRING */
  cronExpression?: string;
  /** Filter criteria for PROMOTION_TRIGGERED */
  promotionFilter?: {
    provider?: string;
    type?: PromotionType;
    minMultiplier?: number;
    eligiblePlan?: string;
  };
  /** Price thresholds for PRICE_TRIGGERED */
  priceThreshold?: {
    provider: string;
    model: string;
    maxInputPricePer1k?: number;
    maxOutputPricePer1k?: number;
  };
  /** Time window constraints for OPTIMAL_WINDOW */
  windowConstraints?: {
    notBefore?: string;
    notAfter?: string;
    preferOffPeak?: boolean;
    maxWaitHours?: number;
  };
}

export interface PromptChain {
  id: string;
  title: string;
  batchId: string;
  userId: string;
  steps: PromptChainStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptChainStep {
  chainIndex: number;
  promptId: string;
  dependsOn: string[];
  /** Template string for injecting prior step outputs, e.g. "{{step_0.response}}" */
  inputTemplate?: string;
  status: ScheduledPromptStatus;
}

// ---------------------------------------------------------------------------
// Optimal window calculation
// ---------------------------------------------------------------------------

export interface WindowOptimization {
  provider: string;
  model: string;
  /** Recommended execution time */
  optimalTime: Date;
  /** Estimated cost at optimal time (cents) */
  estimatedCostCents: number;
  /** Estimated cost at current time (cents) */
  currentCostCents: number;
  /** Estimated savings (cents) */
  savingsCents: number;
  /** Active promotions that apply at the optimal time */
  activePromotions: ProviderPromotion[];
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  reasoning: string;
}
