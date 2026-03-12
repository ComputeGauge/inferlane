// ============================================================================
// @computegauge/adapters — Core Type Definitions
// The open-source interface for AI provider cost tracking
// License: Apache-2.0
// ============================================================================

/** Supported AI providers */
export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'aws-bedrock'
  | 'azure-openai'
  | 'together'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'replicate'
  | 'deepseek'
  | 'on-prem';

/** Date range for queries */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Credentials to connect to a provider */
export interface ProviderCredentials {
  apiKey?: string;
  organizationId?: string;
  projectId?: string;
  region?: string;
  /** For OAuth-based providers */
  accessToken?: string;
  refreshToken?: string;
  /** For AWS */
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Arbitrary provider-specific config */
  metadata?: Record<string, unknown>;
}

/** Usage data for a period */
export interface UsageData {
  provider: ProviderName;
  period: DateRange;
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  currency: string;
  models: ModelUsage[];
}

/** Per-model usage breakdown */
export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  requests: number;
  avgLatencyMs?: number;
}

/** Current spend summary */
export interface SpendSummary {
  provider: ProviderName;
  currentPeriod: string; // "2026-02"
  totalSpendUsd: number;
  budgetLimitUsd?: number;
  budgetUsedPercent?: number;
  dailyAverage: number;
  projectedMonthEnd: number;
  topModel: string;
  topModelSpend: number;
}

/** Model info from a provider */
export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  inputPricePerMToken: number;  // $ per million tokens
  outputPricePerMToken: number;
  contextWindow: number;
  maxOutputTokens?: number;
  category: 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'code';
  isDeprecated?: boolean;
  capabilities?: string[];
}

/** Pricing info */
export interface PricingInfo {
  model: string;
  provider: ProviderName;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  effectiveDate: Date;
  /** Batch/volume discount tiers */
  volumeDiscounts?: Array<{
    minTokens: number;
    discountPercent: number;
  }>;
}

/** Invoice/billing record */
export interface Invoice {
  id: string;
  provider: ProviderName;
  period: string;
  amountUsd: number;
  status: 'paid' | 'pending' | 'overdue';
  pdfUrl?: string;
  lineItems?: Array<{
    description: string;
    amount: number;
  }>;
}

/** Budget/spend limit */
export interface SpendLimit {
  monthlyLimitUsd: number;
  hardLimit: boolean; // true = cut off, false = warn only
  alertThresholds: number[]; // percentages, e.g. [50, 80, 90, 100]
}

/** Alert triggered by spend threshold */
export interface SpendAlert {
  provider: ProviderName;
  type: 'budget_warning' | 'budget_exceeded' | 'spend_spike' | 'rate_limit';
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
}

/** Pricing change notification */
export interface PricingChange {
  provider: ProviderName;
  model: string;
  oldInputPrice: number;
  newInputPrice: number;
  oldOutputPrice: number;
  newOutputPrice: number;
  effectiveDate: Date;
}

/** Rate limit info */
export interface RateLimitInfo {
  provider: ProviderName;
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsUsed: number;
  tokensUsed: number;
  resetsAt: Date;
}

/** Health check result */
export interface HealthCheckResult {
  provider: ProviderName;
  healthy: boolean;
  latencyMs: number;
  message?: string;
  checkedAt: Date;
}

// ============================================================================
// ADAPTER INTERFACE — The contract every provider adapter must implement
// ============================================================================

export interface ComputeGaugeAdapter {
  /** Provider identifier */
  readonly provider: ProviderName;
  /** Adapter version */
  readonly version: string;

  // --- Required Methods ---

  /** Connect to the provider with credentials */
  connect(credentials: ProviderCredentials): Promise<void>;
  /** Disconnect and clean up */
  disconnect(): Promise<void>;
  /** Health check — is the provider API reachable? */
  healthCheck(): Promise<HealthCheckResult>;
  /** Get usage data for a date range */
  getUsage(period: DateRange): Promise<UsageData>;
  /** Get current billing period spend summary */
  getCurrentSpend(): Promise<SpendSummary>;
  /** List available models */
  getModels(): Promise<ModelInfo[]>;
  /** Get current pricing for all models */
  getPricing(): Promise<PricingInfo[]>;

  // --- Optional Methods ---

  /** Get invoice/billing history */
  getInvoices?(period: DateRange): Promise<Invoice[]>;
  /** Set spend limit/budget */
  setSpendLimit?(limit: SpendLimit): Promise<void>;
  /** Get rate limit status */
  getRateLimits?(): Promise<RateLimitInfo>;

  // --- Event Hooks ---

  /** Register callback for spend threshold alerts */
  onSpendThreshold?(callback: (alert: SpendAlert) => void): void;
  /** Register callback for pricing changes */
  onPricingChange?(callback: (change: PricingChange) => void): void;
}

// ============================================================================
// ADAPTER REGISTRY — For discovering and managing adapters
// ============================================================================

export interface AdapterRegistry {
  /** Register an adapter */
  register(adapter: ComputeGaugeAdapter): void;
  /** Get adapter by provider name */
  get(provider: ProviderName): ComputeGaugeAdapter | undefined;
  /** List all registered adapters */
  list(): ComputeGaugeAdapter[];
  /** Get all connected (healthy) adapters */
  getConnected(): Promise<ComputeGaugeAdapter[]>;
}
