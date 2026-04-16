// Central source of truth for Anthropic model identifiers.
//
// Why this file exists: hardcoding `claude-sonnet-4-20250514`
// across the codebase means every Anthropic deprecation triggers a
// 20+ file rewrite. Instead, every caller imports from here and the
// successor is a one-line change.
//
// When Anthropic deprecates a model, update the LATEST_* constants
// below and leave the legacy aliases in place for 90 days so
// integration tests and in-flight code still work against named
// references before they're removed.
//
// Pricing lives in ./anthropic-pricing.ts and is keyed on the same
// identifiers so they move together.

/**
 * Current latest generally-available Sonnet model.
 *
 * History:
 *   - `claude-sonnet-4-20250514` — GA May 2025, DEPRECATED
 *   - `claude-sonnet-4-5` — GA September 2025, CURRENT LATEST
 *
 * The alias without a date suffix always points at the current
 * latest public release.
 */
export const LATEST_SONNET = 'claude-sonnet-4-5';

/**
 * Current latest generally-available Haiku model.
 */
export const LATEST_HAIKU = 'claude-haiku-4-5';

/**
 * Current latest generally-available Opus model. Expensive; the
 * benchmark we ran suggests it's rarely the right choice for
 * coding tasks, so we surface it as an explicit opt-in rather than
 * routing to it by default.
 */
export const LATEST_OPUS = 'claude-opus-4-5';

/**
 * Opaque aliases we use in routing and scheduling. Callers that
 * just want "the default Sonnet" should import `DEFAULT_ANTHROPIC`
 * rather than picking a specific model.
 */
export const DEFAULT_ANTHROPIC = LATEST_SONNET;

/**
 * Legacy model identifiers that we still honor for backwards
 * compatibility. When Anthropic removes one of these from their
 * API, decrypt any in-flight data using the old model name and
 * remap to the latest. Do NOT delete from this map for at least
 * 90 days after Anthropic's deprecation notice.
 */
export const LEGACY_TO_LATEST: Record<string, string> = {
  'claude-sonnet-4-20250514': LATEST_SONNET,
  'claude-sonnet-4': LATEST_SONNET,
  'claude-haiku-4-5-20250514': LATEST_HAIKU,
  'claude-opus-4-20250514': LATEST_OPUS,
};

/**
 * Normalize a user-supplied or stored model identifier to the
 * current preferred model. Returns the input unchanged if it's
 * already current; returns the latest-equivalent for deprecated
 * names.
 *
 * Use this anywhere a model id crosses a serialization boundary
 * (DB read, API request deserialization, scheduled task payload
 * replay) so that stored identifiers are gracefully upgraded.
 */
export function normalizeAnthropicModel(model: string): string {
  return LEGACY_TO_LATEST[model] ?? model;
}

/**
 * Published pricing for the current latest Anthropic models, in
 * USD per million tokens. Sourced from anthropic.com/pricing.
 * Update alongside the LATEST_* constants whenever Anthropic
 * revises prices or deprecates a model.
 */
export const ANTHROPIC_PRICING: Record<
  string,
  { input: number; output: number; cachedInput?: number }
> = {
  [LATEST_SONNET]: { input: 3, output: 15, cachedInput: 0.3 },
  [LATEST_HAIKU]: { input: 1, output: 5, cachedInput: 0.1 },
  [LATEST_OPUS]: { input: 15, output: 75, cachedInput: 1.5 },

  // Legacy entries retained for historical ProxyRequest cost
  // calculations. Pricing matches what we would have charged when
  // the request was originally served.
  'claude-sonnet-4-20250514': { input: 3, output: 15, cachedInput: 0.3 },
  'claude-sonnet-4': { input: 3, output: 15, cachedInput: 0.3 },
  'claude-opus-4-20250514': { input: 15, output: 75, cachedInput: 1.5 },
  'claude-haiku-4-5-20250514': { input: 1, output: 5, cachedInput: 0.1 },
};
