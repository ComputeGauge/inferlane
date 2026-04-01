// ---------------------------------------------------------------------------
// Shamir's Secret Sharing — (k, n) Threshold Scheme
// ---------------------------------------------------------------------------
// Splits a secret (AES-256 key) into n shares where any k shares can
// reconstruct the original, but k-1 shares reveal nothing.
//
// Used in Tier 1 (Blind Routing) to ensure no single node can decrypt
// the full prompt. InferLane holds the reconstruction capability;
// individual nodes only receive their share.
//
// Implementation uses GF(256) — Galois Field arithmetic over single bytes.
// This avoids big-integer math and works naturally with Buffer/Uint8Array.
// ---------------------------------------------------------------------------

import { randomBytes } from 'crypto';
import type { ShamirShare, ShamirConfig, EncryptedPayload } from './types';
import { createCipheriv, createDecipheriv } from 'crypto';

// --- GF(256) Arithmetic ---
// Galois Field with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B)
// Same field used by AES itself.

const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

// Pre-compute exp and log tables for GF(256)
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = x ^ (x << 1);           // multiply by generator (3)
    if (x >= 256) x ^= 0x11b;   // reduce by irreducible polynomial
  }
  // Extend exp table for convenience (avoids modular indexing)
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();

/** Multiply two elements in GF(256) */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/** Divide a by b in GF(256). b must be non-zero. */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(256)');
  if (a === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
}

/** Add/subtract in GF(256) — both are XOR */
function gfAdd(a: number, b: number): number {
  return a ^ b;
}

// --- Polynomial Evaluation ---

/**
 * Evaluate a polynomial at point x in GF(256).
 * coefficients[0] is the constant term (the secret).
 */
function evaluatePolynomial(coefficients: Uint8Array, x: number): number {
  if (x === 0) throw new Error('Cannot evaluate at x=0 (reserved for secret)');

  let result = 0;
  // Horner's method
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gfAdd(gfMul(result, x), coefficients[i]);
  }
  return result;
}

// --- Lagrange Interpolation ---

/**
 * Reconstruct the secret (polynomial value at x=0) from k shares
 * using Lagrange interpolation in GF(256).
 */
function lagrangeInterpolate(shares: Array<{ x: number; y: number }>): number {
  let secret = 0;

  for (let i = 0; i < shares.length; i++) {
    let numerator = 1;
    let denominator = 1;

    for (let j = 0; j < shares.length; j++) {
      if (i === j) continue;
      // numerator *= (0 - shares[j].x) = shares[j].x (since subtraction = XOR = addition in GF(256))
      numerator = gfMul(numerator, shares[j].x);
      // denominator *= (shares[i].x - shares[j].x) = shares[i].x ^ shares[j].x
      denominator = gfMul(denominator, gfAdd(shares[i].x, shares[j].x));
    }

    const lagrangeCoeff = gfDiv(numerator, denominator);
    secret = gfAdd(secret, gfMul(shares[i].y, lagrangeCoeff));
  }

  return secret;
}

// --- Public API ---

/**
 * Split a secret into n shares where any k can reconstruct it.
 *
 * @param secret - The secret bytes to split (e.g., a 32-byte AES key)
 * @param k - Threshold: minimum shares needed to reconstruct
 * @param n - Total shares to generate (must be <= 255 for GF(256))
 * @returns Array of n shares, each the same length as the secret
 */
export function splitSecret(
  secret: Buffer,
  k: number,
  n: number,
): ShamirShare[] {
  if (k < 2) throw new Error('Threshold k must be at least 2');
  if (n < k) throw new Error('Total shares n must be >= threshold k');
  if (n > 255) throw new Error('Maximum 255 shares (GF(256) constraint)');
  if (secret.length === 0) throw new Error('Secret cannot be empty');

  const shares: ShamirShare[] = [];

  // Initialize share buffers
  for (let i = 0; i < n; i++) {
    shares.push({
      index: i + 1,  // 1-indexed (x=0 is reserved for the secret)
      value: Buffer.alloc(secret.length),
    });
  }

  // For each byte of the secret, create a random polynomial and evaluate at each share point
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // Random polynomial of degree k-1 with secret byte as constant term
    const coefficients = new Uint8Array(k);
    coefficients[0] = secret[byteIdx];

    // Random coefficients for x^1 through x^(k-1)
    const randomCoeffs = randomBytes(k - 1);
    for (let c = 1; c < k; c++) {
      coefficients[c] = randomCoeffs[c - 1];
    }

    // Evaluate polynomial at each share point (x = 1, 2, ..., n)
    for (let i = 0; i < n; i++) {
      shares[i].value[byteIdx] = evaluatePolynomial(coefficients, i + 1);
    }
  }

  return shares;
}

/**
 * Reconstruct a secret from k or more shares.
 *
 * @param shares - At least k shares from the original split
 * @param secretLength - Expected length of the reconstructed secret
 * @returns The reconstructed secret
 */
export function reconstructSecret(
  shares: ShamirShare[],
  secretLength: number,
): Buffer {
  if (shares.length < 2) throw new Error('Need at least 2 shares to reconstruct');

  const result = Buffer.alloc(secretLength);

  for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
    const points = shares.map((share) => ({
      x: share.index,
      y: share.value[byteIdx],
    }));

    result[byteIdx] = lagrangeInterpolate(points);
  }

  return result;
}

// --- Encrypt + Split Workflow ---

/**
 * Encrypt plaintext with AES-256-GCM and split the key using Shamir's scheme.
 *
 * This is the core privacy operation for Tier 1 (Blind Routing):
 * 1. Generate random AES-256 key
 * 2. Encrypt the prompt with AES-256-GCM
 * 3. Split the AES key into n shares (threshold k)
 * 4. Return ciphertext + shares
 *
 * InferLane holds all shares and selectively distributes them.
 * No single node receives enough shares to reconstruct the key.
 */
export function encryptAndSplit(
  plaintext: string,
  config: ShamirConfig,
): EncryptedPayload {
  // Generate random AES-256 key
  const aesKey = randomBytes(32);
  const iv = randomBytes(16);

  // Encrypt the plaintext
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Split the AES key
  const shares = splitSecret(aesKey, config.threshold, config.totalShares);

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    shares,
    config,
  };
}

/**
 * Reconstruct the AES key from shares and decrypt the ciphertext.
 *
 * Used by InferLane to reassemble fragment responses.
 * Only InferLane has access to enough shares to reconstruct.
 */
export function reconstructAndDecrypt(
  payload: EncryptedPayload,
  shareSubset: ShamirShare[],
): string {
  // Reconstruct AES key
  const aesKey = reconstructSecret(shareSubset, 32);

  // Decrypt
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Verify that shares correctly reconstruct a known value.
 * Used in health checks and attestation flows.
 */
export function verifyShares(
  shares: ShamirShare[],
  expectedLength: number,
  knownHash?: string,
): boolean {
  try {
    const reconstructed = reconstructSecret(shares, expectedLength);
    if (knownHash) {
      const { createHash } = require('crypto');
      const hash = createHash('sha256').update(reconstructed).digest('hex');
      return hash === knownHash;
    }
    return true; // reconstruction succeeded without error
  } catch {
    return false;
  }
}
