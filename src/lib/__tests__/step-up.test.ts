// Unit tests for the step-up token primitives (ASVS V4.3.2).
//
// These exercise the HMAC signing path, scope binding, userId binding,
// expiry, and the requireStepUp error throwing.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  issueStepUpToken,
  verifyStepUpToken,
  requireStepUp,
  StepUpRequiredError,
} from '@/lib/security/step-up';

beforeAll(() => {
  // Step-up token derivation needs ENCRYPTION_KEY set.
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'test-key-for-stepup-' + 'x'.repeat(48);
  }
});

describe('step-up tokens', () => {
  it('round-trips a valid token', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    const payload = verifyStepUpToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('user_abc');
    expect(payload?.scope).toBe('dispute.resolve');
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects a token signed with a tampered payload', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    const [payload, sig] = token.split('.');
    // Flip one character in the payload — the sig will no longer match.
    const tampered = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A') + '.' + sig;
    expect(verifyStepUpToken(tampered)).toBeNull();
  });

  it('rejects a token with a forged signature', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    const [payload] = token.split('.');
    const forged = payload + '.AAAA';
    expect(verifyStepUpToken(forged)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyStepUpToken('')).toBeNull();
    expect(verifyStepUpToken('a.b.c')).toBeNull();
    expect(verifyStepUpToken('a')).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
      ttlMs: -1_000,  // already expired
    });
    expect(verifyStepUpToken(token)).toBeNull();
  });
});

describe('requireStepUp', () => {
  it('passes when userId + scope match', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    const payload = requireStepUp(token, 'user_abc', 'dispute.resolve');
    expect(payload.userId).toBe('user_abc');
  });

  it('throws when scope mismatches', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    expect(() => requireStepUp(token, 'user_abc', 'payout.adjust')).toThrow(StepUpRequiredError);
  });

  it('throws when userId mismatches', () => {
    const token = issueStepUpToken({
      userId: 'user_abc',
      scope: 'dispute.resolve',
    });
    expect(() => requireStepUp(token, 'user_other', 'dispute.resolve')).toThrow(StepUpRequiredError);
  });

  it('throws on missing token', () => {
    expect(() => requireStepUp(null, 'user_abc', 'dispute.resolve')).toThrow(StepUpRequiredError);
    expect(() => requireStepUp(undefined, 'user_abc', 'dispute.resolve')).toThrow(StepUpRequiredError);
    expect(() => requireStepUp('', 'user_abc', 'dispute.resolve')).toThrow(StepUpRequiredError);
  });
});
