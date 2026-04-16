// Unit tests for the redirect allowlist (ASVS V5.1.5).
//
// Every branch of the safeRedirect classifier deserves a regression
// test. These tests use process.env overrides to simulate different
// allowed-host configurations without touching real config.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRedirect, assertSafeRedirect, UnsafeRedirectError } from '@/lib/security/redirect-guard';

const originalPublicOrigin = process.env.INFERLANE_PUBLIC_ORIGIN;
const originalAllowed = process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS;

beforeEach(() => {
  process.env.INFERLANE_PUBLIC_ORIGIN = 'https://inferlane.dev';
  process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS = '';
});

afterEach(() => {
  if (originalPublicOrigin) process.env.INFERLANE_PUBLIC_ORIGIN = originalPublicOrigin;
  else delete process.env.INFERLANE_PUBLIC_ORIGIN;
  if (originalAllowed !== undefined) process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS = originalAllowed;
  else delete process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS;
});

describe('safeRedirect — accepts', () => {
  it('allows path-only redirects', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
    expect(safeRedirect('/dashboard/wallet')).toBe('/dashboard/wallet');
  });

  it('allows full https URLs to the public origin', () => {
    expect(safeRedirect('https://inferlane.dev/settings')).toBe('https://inferlane.dev/settings');
  });

  it('allows localhost http for dev', () => {
    expect(safeRedirect('http://localhost:3000/dashboard')).toBe('http://localhost:3000/dashboard');
  });

  it('allows extra hosts from env', () => {
    process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS = 'partner.example.com';
    expect(safeRedirect('https://partner.example.com/x')).toBe('https://partner.example.com/x');
  });
});

describe('safeRedirect — rejects', () => {
  it('rejects protocol-relative URLs', () => {
    expect(safeRedirect('//evil.com/phish')).toBe('/');
  });

  it('rejects javascript: scheme', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/');
  });

  it('rejects data: scheme', () => {
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/');
  });

  it('rejects file: / blob: / vbscript:', () => {
    expect(safeRedirect('file:///etc/passwd')).toBe('/');
    expect(safeRedirect('blob:https://inferlane.dev/xxx')).toBe('/');
    expect(safeRedirect('vbscript:msgbox')).toBe('/');
  });

  it('rejects absolute URL to an unlisted host', () => {
    expect(safeRedirect('https://evil.com/drop')).toBe('/');
  });

  it('rejects non-https absolute URL (non-localhost)', () => {
    expect(safeRedirect('http://inferlane.dev/x')).toBe('/');
  });

  it('rejects empty, null, or non-string input', () => {
    expect(safeRedirect(null)).toBe('/');
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect('')).toBe('/');
    expect(safeRedirect('   ')).toBe('/');
  });

  it('rejects backslash-tricks meant to bypass path check', () => {
    expect(safeRedirect('/\\\\evil.com/phish')).toBe('/');
  });
});

describe('safeRedirect — credential stripping', () => {
  it('strips access_token / id_token / api_key query params', () => {
    const url = safeRedirect('/dashboard?access_token=abc&id_token=xyz&foo=bar');
    expect(url).not.toContain('access_token');
    expect(url).not.toContain('id_token');
    expect(url).toContain('foo=bar');
  });

  it('strips credential params from absolute URLs too', () => {
    const url = safeRedirect('https://inferlane.dev/x?password=secret&keep=me');
    expect(url).not.toContain('password');
    expect(url).toContain('keep=me');
  });
});

describe('assertSafeRedirect', () => {
  it('returns the target when it is safe', () => {
    expect(assertSafeRedirect('/dashboard')).toBe('/dashboard');
  });

  it('throws UnsafeRedirectError for unsafe targets', () => {
    expect(() => assertSafeRedirect('https://evil.com')).toThrow(UnsafeRedirectError);
  });
});
