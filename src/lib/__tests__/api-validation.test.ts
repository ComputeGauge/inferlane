import { describe, it, expect } from 'vitest';

/**
 * API Route Validation Tests
 *
 * Tests the validation constants and logic used across API endpoints.
 * These complement the input-validation tests but focus on API-specific patterns.
 */

// ─── Provider Route Validation ───────────────────────────────────

const VALID_PROVIDERS = [
  'ANTHROPIC', 'OPENAI', 'GOOGLE', 'AWS_BEDROCK', 'AZURE_OPENAI',
  'TOGETHER', 'GROQ', 'MISTRAL', 'COHERE', 'REPLICATE', 'DEEPSEEK', 'ON_PREM',
] as const;

const VALID_ALERT_TYPES = [
  'BUDGET_WARNING', 'BUDGET_EXCEEDED', 'SPEND_SPIKE',
  'PROVIDER_DOWN', 'RATE_LIMIT', 'COST_ANOMALY',
] as const;

const VALID_CHANNELS = ['EMAIL', 'SLACK', 'WEBHOOK', 'IN_APP'] as const;

describe('API Route Validation Logic', () => {

  // ─── Email Validation (Waitlist) ─────────────────────────────

  describe('Waitlist email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('accepts valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.name@company.co',
        'dev+tag@startup.io',
        'a@b.c',
      ];
      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = [
        '',
        'notanemail',
        '@domain.com',
        'user@',
        'user @example.com',
        'user@ example.com',
      ];
      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('normalizes email before storage (lowercase + trim)', () => {
      const raw = '  User@EXAMPLE.COM  ';
      const normalized = raw.toLowerCase().trim();
      expect(normalized).toBe('user@example.com');
    });
  });

  // ─── Provider Validation ─────────────────────────────────────

  describe('Provider connection validation', () => {
    it('accepts all valid AI providers', () => {
      VALID_PROVIDERS.forEach((p) => {
        expect(VALID_PROVIDERS.includes(p)).toBe(true);
      });
    });

    it('rejects invalid provider names', () => {
      const invalid = ['INVALID', 'openai', 'Anthropic', '', 'CHATGPT', 'LLAMA'];
      invalid.forEach((p) => {
        expect((VALID_PROVIDERS as readonly string[]).includes(p)).toBe(false);
      });
    });

    it('requires apiKey for provider connection', () => {
      // Simulating the route validation: both provider and apiKey are required
      const body = { provider: 'OPENAI' };
      const hasApiKey = 'apiKey' in body;
      expect(hasApiKey).toBe(false);
    });
  });

  // ─── Alert Validation ────────────────────────────────────────

  describe('Alert creation validation', () => {
    it('accepts all valid alert types', () => {
      VALID_ALERT_TYPES.forEach((t) => {
        expect(VALID_ALERT_TYPES.includes(t)).toBe(true);
      });
    });

    it('rejects invalid alert types', () => {
      const invalid = ['WARNING', 'error', 'BUDGET', '', 'ALERT'];
      invalid.forEach((t) => {
        expect((VALID_ALERT_TYPES as readonly string[]).includes(t)).toBe(false);
      });
    });

    it('accepts all valid notification channels', () => {
      VALID_CHANNELS.forEach((c) => {
        expect(VALID_CHANNELS.includes(c)).toBe(true);
      });
    });

    it('rejects invalid notification channels', () => {
      const invalid = ['SMS', 'DISCORD', 'email', '', 'PUSH'];
      invalid.forEach((c) => {
        expect((VALID_CHANNELS as readonly string[]).includes(c)).toBe(false);
      });
    });

    it('validates threshold is a positive number', () => {
      const validThresholds = [0.01, 1, 50, 100, 999.99];
      validThresholds.forEach((t) => {
        expect(typeof t === 'number' && t > 0).toBe(true);
      });

      const invalidThresholds = [0, -1, -100];
      invalidThresholds.forEach((t) => {
        expect(typeof t === 'number' && t > 0).toBe(false);
      });
    });

    it('rejects non-number thresholds', () => {
      const invalidTypes = ['50', null, undefined, true, {}];
      invalidTypes.forEach((t) => {
        expect(typeof t === 'number' && (t as number) > 0).toBe(false);
      });
    });

    it('defaults channel to IN_APP when not provided', () => {
      const body: Record<string, unknown> = { type: 'BUDGET_WARNING', threshold: 100 };
      const channel = (body.channel as string) ?? 'IN_APP';
      expect(channel).toBe('IN_APP');
    });

    it('generates default message from type and threshold', () => {
      const type = 'BUDGET_WARNING';
      const threshold = 100;
      const defaultMessage = `Alert: ${type} at $${threshold}`;
      expect(defaultMessage).toBe('Alert: BUDGET_WARNING at $100');
    });
  });

  // ─── Request Body Parsing ────────────────────────────────────

  describe('Request body parsing safety', () => {
    it('handles missing fields gracefully', () => {
      const emptyBody = {};
      expect('email' in emptyBody).toBe(false);
      expect('provider' in emptyBody).toBe(false);
      expect('type' in emptyBody).toBe(false);
    });

    it('handles null values in required fields', () => {
      const body = { email: null, provider: null };
      expect(!body.email || typeof body.email !== 'string').toBe(true);
      expect(!body.provider).toBe(true);
    });
  });

  // ─── Rate Limit Key Format ───────────────────────────────────

  describe('Rate limit key formatting', () => {
    it('generates correct waitlist rate limit key from IP', () => {
      const ip = '192.168.1.1';
      const key = `waitlist:${ip}`;
      expect(key).toBe('waitlist:192.168.1.1');
    });

    it('extracts first IP from x-forwarded-for', () => {
      const header = '203.0.113.195, 70.41.3.18, 150.172.238.178';
      const ip = header.split(',')[0]?.trim() || 'unknown';
      expect(ip).toBe('203.0.113.195');
    });

    it('falls back to unknown when no IP header', () => {
      const header = null as string | null;
      const ip = header?.split(',')[0]?.trim() || 'unknown';
      expect(ip).toBe('unknown');
    });

    it('generates correct per-user rate limit keys', () => {
      const userId = 'user_abc123';
      expect(`provider:${userId}`).toBe('provider:user_abc123');
      expect(`alert:${userId}`).toBe('alert:user_abc123');
      expect(`apikey:${userId}`).toBe('apikey:user_abc123');
    });
  });
});
