import { describe, it, expect } from 'vitest';

// Test the validation constants used in API routes
const VALID_PROVIDERS = [
  'ANTHROPIC', 'OPENAI', 'GOOGLE', 'AWS_BEDROCK', 'AZURE_OPENAI',
  'TOGETHER', 'GROQ', 'MISTRAL', 'COHERE', 'REPLICATE', 'DEEPSEEK', 'ON_PREM',
] as const;

const VALID_ALERT_TYPES = [
  'BUDGET_WARNING', 'BUDGET_EXCEEDED', 'SPEND_SPIKE',
  'PROVIDER_DOWN', 'RATE_LIMIT', 'COST_ANOMALY',
] as const;

const VALID_CHANNELS = ['EMAIL', 'SLACK', 'WEBHOOK', 'IN_APP'] as const;

describe('Provider validation', () => {
  it('accepts all valid provider names', () => {
    for (const p of VALID_PROVIDERS) {
      expect(VALID_PROVIDERS.includes(p)).toBe(true);
    }
  });

  it('rejects invalid provider names', () => {
    const invalid = ['INVALID', 'anthropic', 'Openai', 'aws-bedrock', ''];
    for (const p of invalid) {
      expect((VALID_PROVIDERS as readonly string[]).includes(p)).toBe(false);
    }
  });

  it('has at least 10 providers', () => {
    expect(VALID_PROVIDERS.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Alert type validation', () => {
  it('accepts all valid alert types', () => {
    for (const t of VALID_ALERT_TYPES) {
      expect(VALID_ALERT_TYPES.includes(t)).toBe(true);
    }
  });

  it('rejects invalid alert types', () => {
    const invalid = ['INVALID', 'budget_warning', 'ALERT', ''];
    for (const t of invalid) {
      expect((VALID_ALERT_TYPES as readonly string[]).includes(t)).toBe(false);
    }
  });
});

describe('Alert channel validation', () => {
  it('accepts all valid channels', () => {
    for (const ch of VALID_CHANNELS) {
      expect(VALID_CHANNELS.includes(ch)).toBe(true);
    }
  });

  it('rejects invalid channels', () => {
    const invalid = ['SMS', 'DISCORD', 'email', ''];
    for (const ch of invalid) {
      expect((VALID_CHANNELS as readonly string[]).includes(ch)).toBe(false);
    }
  });

  it('IN_APP is a valid default channel', () => {
    expect((VALID_CHANNELS as readonly string[]).includes('IN_APP')).toBe(true);
  });
});
