// Step-up re-authentication — ASVS V4.3.2.
//
// Sensitive operations (dispute resolution, payout adjustments,
// manual ledger corrections, API key rotation, admin actions) require
// a recent re-authentication beyond the standard session. This module
// implements a short-lived server-side token that the UI must attach
// to the request via an `X-Step-Up-Token` header.
//
// Flow:
//   1. User starts a sensitive action in the dashboard.
//   2. UI calls POST /api/auth/step-up with their password or MFA
//      code. The route verifies and calls issueStepUpToken() which
//      returns a server-signed token tied to (userId, scope, exp).
//   3. UI attaches the token to subsequent sensitive requests.
//   4. Each sensitive route calls requireStepUp() which verifies
//      the signature, expiry, and scope match.
//
// Tokens are short-lived (5 minutes default) and scope-bound so a
// token issued for "dispute.resolve" cannot be used for
// "payout.adjust".
//
// The token is HMAC-SHA-256 over a JSON payload, signed with a key
// derived from the master ENCRYPTION_KEY via HKDF. Never log the
// token itself — only the scope + userId for audit.

import { createHmac, randomBytes, timingSafeEqual, hkdfSync } from 'crypto';
import { logger } from '@/lib/telemetry';

export type StepUpScope =
  | 'dispute.resolve'
  | 'payout.adjust'
  | 'ledger.adjust'
  | 'api-key.create'
  | 'api-key.revoke'
  | 'admin.role.change'
  | 'settings.delete_account';

interface StepUpPayload {
  userId: string;
  scope: StepUpScope;
  issuedAt: number;      // epoch ms
  expiresAt: number;     // epoch ms
  nonce: string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;   // 5 minutes

function deriveHmacKey(): Buffer {
  const master = process.env.ENCRYPTION_KEY;
  if (!master) throw new Error('ENCRYPTION_KEY not set');
  const derived = hkdfSync(
    'sha256',
    Buffer.from(master, 'utf8'),
    Buffer.from('inferlane-stepup-salt-v1', 'utf8'),
    Buffer.from('inferlane/stepup/v1', 'utf8'),
    32,
  );
  return Buffer.from(derived);
}

function b64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Issue a new step-up token for the given user + scope. Valid for
 * `ttlMs` milliseconds (default 5 minutes). Returns the full token
 * string the UI should attach as `X-Step-Up-Token`.
 */
export function issueStepUpToken(params: {
  userId: string;
  scope: StepUpScope;
  ttlMs?: number;
}): string {
  const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const payload: StepUpPayload = {
    userId: params.userId,
    scope: params.scope,
    issuedAt: now,
    expiresAt: now + ttl,
    nonce: randomBytes(16).toString('hex'),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64url(Buffer.from(payloadJson, 'utf8'));
  const sig = createHmac('sha256', deriveHmacKey()).update(payloadB64).digest();
  const sigB64 = b64url(sig);

  logger.info('stepup.issued', {
    userId: params.userId,
    scope: params.scope,
    ttlMs: ttl,
  });

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a step-up token and return its payload if valid. Returns
 * null on any failure (signature mismatch, expired, malformed).
 */
export function verifyStepUpToken(token: string): StepUpPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  const expectedSig = createHmac('sha256', deriveHmacKey()).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: StepUpPayload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.userId || !payload.scope || !payload.expiresAt) return null;
  if (payload.expiresAt < Date.now()) return null;

  return payload;
}

/**
 * Assert that a request has a valid step-up token for the given
 * userId + scope. Returns the payload on success, throws otherwise.
 * Use in sensitive route handlers as:
 *
 *   const token = req.headers.get('x-step-up-token');
 *   const payload = requireStepUp(token, auth.userId, 'dispute.resolve');
 *   // ... proceed
 */
export class StepUpRequiredError extends Error {
  constructor(public readonly scope: StepUpScope) {
    super(`Step-up authentication required for scope: ${scope}`);
  }
}

export function requireStepUp(
  token: string | null | undefined,
  userId: string,
  scope: StepUpScope,
): StepUpPayload {
  if (!token) throw new StepUpRequiredError(scope);
  const payload = verifyStepUpToken(token);
  if (!payload) throw new StepUpRequiredError(scope);
  if (payload.userId !== userId) throw new StepUpRequiredError(scope);
  if (payload.scope !== scope) throw new StepUpRequiredError(scope);
  return payload;
}
