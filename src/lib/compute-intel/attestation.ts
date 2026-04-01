// ---------------------------------------------------------------------------
// Cryptographic Attestation — Classification Signing (Stream U)
// ---------------------------------------------------------------------------
// Signs classification reports with HMAC-SHA256 so marketplace buyers
// can verify the classification hasn't been tampered with.
//
// HMAC rather than asymmetric (Ed25519) because all verification happens
// on-platform today. If external auditors need to verify, upgrade to
// Ed25519 with a public key registry — signerKeyId already supports rotation.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'crypto';
import type { ComputeClassification } from './types';

// ── Key Management ────────────────────────────────────────────────────────

/**
 * Platform attestation keys. Stored as environment variables.
 * ATTESTATION_KEY_CURRENT: active signing key
 * ATTESTATION_KEY_PREVIOUS: previous key, valid for 90 days after rotation
 */
function getSigningKeys(): Array<{ id: string; key: string }> {
  const keys: Array<{ id: string; key: string }> = [];

  const current = process.env.ATTESTATION_KEY_CURRENT;
  if (current) {
    keys.push({ id: 'current', key: current });
  }

  const previous = process.env.ATTESTATION_KEY_PREVIOUS;
  if (previous) {
    keys.push({ id: 'previous', key: previous });
  }

  // Fallback for development — deterministic key derived from a fixed seed
  if (keys.length === 0) {
    const devKey = createHmac('sha256', 'inferlane-dev-attestation-seed')
      .update('development-key')
      .digest('hex');
    keys.push({ id: 'dev', key: devKey });
  }

  return keys;
}

// ── Canonical Serialisation ───────────────────────────────────────────────

/**
 * Serialise a classification to canonical JSON for signing.
 * Excludes metadata fields (id, signature, signedAt, signerKeyId)
 * that aren't part of the classification content.
 */
function canonicalise(classification: ComputeClassification): string {
  const signable = {
    targetType: classification.targetType,
    targetId: classification.targetId,
    model: classification.model,
    inferenceType: classification.inferenceType,
    qualityTier: classification.qualityTier,
    latencyClass: classification.latencyClass,
    privacyClass: classification.privacyClass,
    availabilityClass: classification.availabilityClass,
    hardwareClass: classification.hardwareClass,
    regions: [...classification.regions].sort(), // deterministic order
    measuredLatencyMs: classification.measuredLatencyMs,
    measuredThroughputTps: classification.measuredThroughputTps,
    measuredAccuracy: classification.measuredAccuracy,
    verificationScore: classification.verificationScore,
    verificationMethods: [...classification.verificationMethods].sort(),
    lastVerifiedAt: classification.lastVerifiedAt?.toISOString() ?? null,
    verificationTTLHours: classification.verificationTTLHours,
    settlementLane: classification.settlementLane,
    settlementTerms: {
      lane: classification.settlementTerms.lane,
      settlementDelayHours: classification.settlementTerms.settlementDelayHours,
      escrowRequired: classification.settlementTerms.escrowRequired,
      escrowAmountUsd: classification.settlementTerms.escrowAmountUsd,
      disputeWindowHours: classification.settlementTerms.disputeWindowHours,
      reputationMinimum: classification.settlementTerms.reputationMinimum,
    },
  };

  // JSON.stringify with sorted keys for deterministic output
  return JSON.stringify(signable, Object.keys(signable).sort());
}

// ── Sign & Verify ─────────────────────────────────────────────────────────

/**
 * Sign a classification report.
 * Returns the classification with signature, signedAt, and signerKeyId set.
 */
export function signClassification(
  classification: ComputeClassification,
  keyId?: string,
): ComputeClassification {
  const keys = getSigningKeys();
  const signingKey = keyId
    ? keys.find((k) => k.id === keyId)
    : keys[0]; // default to current key

  if (!signingKey) {
    throw new Error(`Attestation key not found: ${keyId ?? 'default'}`);
  }

  const canonical = canonicalise(classification);
  const signature = createHmac('sha256', signingKey.key)
    .update(canonical)
    .digest('hex');

  return {
    ...classification,
    signature,
    signedAt: new Date(),
    signerKeyId: signingKey.id,
  };
}

/**
 * Verify a classification's signature.
 * Tries all available keys (current + previous) for rotation tolerance.
 */
export function verifyClassification(classification: ComputeClassification): boolean {
  if (!classification.signature) {
    return false; // unsigned
  }

  const canonical = canonicalise(classification);
  const keys = getSigningKeys();

  // If a specific key is referenced, try that first
  if (classification.signerKeyId) {
    const specificKey = keys.find((k) => k.id === classification.signerKeyId);
    if (specificKey) {
      const expected = createHmac('sha256', specificKey.key)
        .update(canonical)
        .digest('hex');

      try {
        return timingSafeEqual(
          Buffer.from(classification.signature, 'hex'),
          Buffer.from(expected, 'hex'),
        );
      } catch {
        return false;
      }
    }
  }

  // Try all keys (supports rotation window)
  for (const key of keys) {
    const expected = createHmac('sha256', key.key)
      .update(canonical)
      .digest('hex');

    try {
      if (timingSafeEqual(
        Buffer.from(classification.signature, 'hex'),
        Buffer.from(expected, 'hex'),
      )) {
        return true;
      }
    } catch {
      // Buffer length mismatch — skip this key
    }
  }

  return false;
}

/**
 * Check if a classification's verification has expired based on TTL.
 */
export function isVerificationExpired(classification: ComputeClassification): boolean {
  if (!classification.lastVerifiedAt) return true;

  const ttlMs = classification.verificationTTLHours * 60 * 60 * 1000;
  const expiresAt = classification.lastVerifiedAt.getTime() + ttlMs;

  return Date.now() > expiresAt;
}
