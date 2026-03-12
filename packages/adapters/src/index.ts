// ============================================================================
// @computegauge/adapters — AI Provider Cost Tracking Adapters
// License: Apache-2.0
// ============================================================================

// Core types
export type {
  ProviderName,
  DateRange,
  ProviderCredentials,
  UsageData,
  ModelUsage,
  SpendSummary,
  ModelInfo,
  PricingInfo,
  Invoice,
  SpendLimit,
  SpendAlert,
  PricingChange,
  RateLimitInfo,
  HealthCheckResult,
  ComputeGaugeAdapter,
  AdapterRegistry,
} from './types.js';

// Registry
export { DefaultAdapterRegistry, registry } from './registry.js';

// Provider adapters
export { AnthropicAdapter } from './providers/anthropic.js';
export { OpenAIAdapter } from './providers/openai.js';
