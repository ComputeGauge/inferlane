import { describe, it, expect } from 'vitest';

// Extract the same regex used in the waitlist API route
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe('email validation (waitlist)', () => {
  it('accepts valid emails', () => {
    const validEmails = [
      'user@example.com',
      'user.name@company.co',
      'user+tag@domain.io',
      'test@sub.domain.com',
      'a@b.co',
    ];

    for (const email of validEmails) {
      expect(emailRegex.test(email), `Expected ${email} to be valid`).toBe(true);
    }
  });

  it('rejects invalid emails', () => {
    const invalidEmails = [
      '',
      'notanemail',
      '@domain.com',
      'user@',
      'user @domain.com',
      'user@domain',
      'user@.com',
    ];

    for (const email of invalidEmails) {
      expect(emailRegex.test(email), `Expected "${email}" to be invalid`).toBe(false);
    }
  });

  it('normalizes email to lowercase and trimmed', () => {
    const input = '  User@Example.COM  ';
    const normalized = input.toLowerCase().trim();

    expect(normalized).toBe('user@example.com');
    expect(emailRegex.test(normalized)).toBe(true);
  });
});
