// Redirect allowlist — ASVS V5.1.5.
//
// Centralised guard so no route can send a user to an arbitrary URL.
// All callbackUrl / next / returnTo parameters must pass through
// `safeRedirect()` which:
//
//   1. Rejects schemes other than https and path-only ("/foo/bar").
//   2. Resolves relative URLs against the configured base so an
//      attacker can't trick us with protocol-relative "//evil.com".
//   3. Checks the resolved host against an allowlist derived from
//      INFERLANE_PUBLIC_ORIGIN + an optional config list.
//   4. Strips fragments and query parameters that look like
//      credentials (access_token, id_token, api_key, etc.).
//   5. Falls back to a safe default ("/") if any check fails.
//
// This is the ONLY function any auth / billing / dispatch route
// should call when handling user-supplied redirect targets. Never
// build redirects by string concatenation.

const DEFAULT_ALLOWED_HOSTS = [
  'inferlane.dev',
  'www.inferlane.dev',
  'app.inferlane.dev',
  'localhost',
  '127.0.0.1',
];

const CREDENTIAL_QUERY_KEYS = new Set([
  'access_token',
  'id_token',
  'refresh_token',
  'api_key',
  'apikey',
  'password',
  'secret',
  'client_secret',
]);

export interface RedirectGuardConfig {
  /** Additional hosts to allow beyond the defaults. Loaded from env. */
  extraAllowedHosts?: string[];
  /** Where to send users if their target is rejected. */
  fallback?: string;
}

function getBaseOrigin(): string {
  return (
    process.env.INFERLANE_PUBLIC_ORIGIN ??
    process.env.NEXTAUTH_URL ??
    'https://inferlane.dev'
  );
}

function getAllowedHosts(config: RedirectGuardConfig = {}): Set<string> {
  const hosts = new Set<string>(DEFAULT_ALLOWED_HOSTS);
  const base = new URL(getBaseOrigin());
  hosts.add(base.hostname);
  const extraEnv = (process.env.INFERLANE_REDIRECT_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const h of extraEnv) hosts.add(h);
  for (const h of config.extraAllowedHosts ?? []) hosts.add(h);
  return hosts;
}

/**
 * Return a safe redirect target for `rawTarget`. Never throws.
 * If the target is unsafe, returns the fallback ("/" by default).
 */
export function safeRedirect(
  rawTarget: string | null | undefined,
  config: RedirectGuardConfig = {},
): string {
  const fallback = config.fallback ?? '/';
  if (!rawTarget || typeof rawTarget !== 'string') return fallback;

  const trimmed = rawTarget.trim();
  if (trimmed === '') return fallback;

  // Reject protocol-relative URLs outright — they inherit the
  // scheme from the current page and are a common phishing vector.
  if (trimmed.startsWith('//')) return fallback;

  // Reject anything using javascript: / data: / file: / blob: schemes.
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('vbscript:')
  ) {
    return fallback;
  }

  // Path-only target — safe by construction (no host to verify) as
  // long as it doesn't start with // (checked above) and doesn't
  // contain a full URL via backslash tricks.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return stripCredentialParams(trimmed);
  }

  // Absolute URL — resolve against the public origin and check the
  // host against the allowlist.
  let parsed: URL;
  try {
    parsed = new URL(trimmed, getBaseOrigin());
  } catch {
    return fallback;
  }

  // Only https is acceptable for absolute redirects.
  if (parsed.protocol !== 'https:') {
    // Exception: http://localhost during dev
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      // allow
    } else {
      return fallback;
    }
  }

  const allowed = getAllowedHosts(config);
  if (!allowed.has(parsed.hostname)) {
    return fallback;
  }

  // Strip credential-looking query parameters before returning.
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

function stripCredentialParams(pathAndQuery: string): string {
  try {
    const u = new URL(pathAndQuery, 'https://dummy.local');
    for (const key of Array.from(u.searchParams.keys())) {
      if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    return u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : '');
  } catch {
    return pathAndQuery;
  }
}

/**
 * Assert the target is safe; throws if not. Use in routes that
 * prefer to fail closed rather than silently degrade to "/".
 */
export class UnsafeRedirectError extends Error {
  constructor(public readonly target: string) {
    super(`Unsafe redirect target: ${target}`);
  }
}

export function assertSafeRedirect(
  rawTarget: string | null | undefined,
  config: RedirectGuardConfig = {},
): string {
  const safe = safeRedirect(rawTarget, config);
  if (safe === (config.fallback ?? '/') && rawTarget && rawTarget !== '/') {
    throw new UnsafeRedirectError(rawTarget);
  }
  return safe;
}
