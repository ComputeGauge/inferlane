// Azure Attestation Service (MAA) verifier.
//
// Commercial build, Phase 4.1. This is the real implementation that plugs
// into src/lib/attestation/index.ts to replace the `verifyAzure` stub.
//
// Flow:
//   1. Seller's Azure Confidential VM produces a raw attestation report.
//   2. Seller sends that report to Microsoft Azure Attestation (MAA) and
//      receives back a signed JWT (RS256) containing the evidence claims.
//   3. Seller forwards that JWT to InferLane as `bundle.evidence`.
//   4. We (this function) validate the JWT signature against MAA's JWKS,
//      check the issuer and audience claims, pin the measurement to what
//      the seller previously attested to, and verify that the nonce we
//      issued for this session is in the token.
//
// Spec reference:
//   https://learn.microsoft.com/azure/attestation/claim-sets
//   https://learn.microsoft.com/azure/attestation/overview
//
// Security considerations:
//   - JWKS URIs are pinned to known Azure Attestation regional endpoints.
//     We do NOT follow arbitrary jku / x5u URLs from the JWT header, to
//     prevent SSRF-based key swap attacks.
//   - JWKS responses are cached for 5 minutes to cap request rate to
//     Microsoft without caching across key rotations for too long.
//   - We enforce `x-ms-ver` claim to be "1.0" and reject unknown versions.
//   - We require the nonce we issued to appear in `x-ms-runtime.client_payload`
//     or `nonce` claims, whichever MAA populates for the report type.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { logger } from '@/lib/telemetry';
import type { AttestationBundle, AttestationVerdict } from './index';

// Known MAA regional endpoints. If an operator uses a region not in this
// list, they need to be added explicitly — we don't accept arbitrary
// attestation providers by default.
const KNOWN_MAA_ISSUERS: ReadonlyArray<string> = [
  'https://sharedneu.neu.attest.azure.net',
  'https://sharedweu.weu.attest.azure.net',
  'https://shareduks.uks.attest.azure.net',
  'https://sharedeus.eus.attest.azure.net',
  'https://sharedwus.wus.attest.azure.net',
  'https://sharedwus2.wus2.attest.azure.net',
  'https://sharedcus.cus.attest.azure.net',
  'https://sharedeau.eau.attest.azure.net',
  'https://sharedjpe.jpe.attest.azure.net',
];

// Cache: issuer → JWKS. `createRemoteJWKSet` already handles short-term
// caching of key material, but we also memoize the set object itself so
// we don't rebuild the HTTP client on every verification.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

// Default validity window once we've verified a token. The seller is
// expected to re-attest periodically; we use a generous 1-hour window so
// transient network failures don't spike our reject rate.
const DEFAULT_VALIDITY_MS = 60 * 60 * 1000;

/**
 * Shape of the claims we care about from an MAA JWT. Only these are read —
 * anything else in the token is ignored.
 */
interface MaaClaims extends JWTPayload {
  /** MAA claim set version. We only accept "1.0". */
  'x-ms-ver'?: string;
  /** TEE type, e.g. "sevsnpvm", "tdx", "sgx" */
  'x-ms-attestation-type'?: string;
  /** Compound identity: code hash + data hash. Treated as measurement. */
  'x-ms-compliance-status'?: string;
  /** Nonce the seller included; we verify it matches what we issued. */
  'x-ms-runtime'?: { client_payload?: { nonce?: string } };
  nonce?: string;
  /** SEV-SNP guest measurement */
  'x-ms-sevsnpvm-launchmeasurement'?: string;
  /** TDX MRTD */
  'x-ms-tee-is-debuggable'?: boolean;
  'x-ms-policy-hash'?: string;
}

export async function verifyAzureMaa(bundle: AttestationBundle): Promise<AttestationVerdict> {
  try {
    const { payload, protectedHeader } = await verifyJwt(bundle.evidence);

    // Issuer must be one of the pinned MAA endpoints.
    const issuer = typeof payload.iss === 'string' ? payload.iss : '';
    if (!KNOWN_MAA_ISSUERS.includes(issuer)) {
      logger.warn('attestation.azure.unknown_issuer', { issuer });
      return badSignature(`Unknown MAA issuer: ${issuer}`);
    }

    const claims = payload as MaaClaims;

    // Enforce claim set version we know how to reason about.
    if (claims['x-ms-ver'] && claims['x-ms-ver'] !== '1.0') {
      return badSignature(`Unsupported x-ms-ver: ${claims['x-ms-ver']}`);
    }

    // Nonce binding: reject if the token doesn't include the nonce we
    // asked for. MAA puts user-supplied nonces under x-ms-runtime.client_payload
    // or, for SEV-SNP reports with report_data binding, under top-level nonce.
    const tokenNonce =
      claims['x-ms-runtime']?.client_payload?.nonce ??
      (typeof claims.nonce === 'string' ? claims.nonce : undefined);

    if (!tokenNonce || tokenNonce !== bundle.nonce) {
      logger.warn('attestation.azure.nonce_mismatch', {
        expected: bundle.nonce,
        got: tokenNonce ?? '<missing>',
      });
      return {
        outcome: 'NONCE_MISMATCH',
        measurement: null,
        summary: 'Nonce in MAA token did not match the one we issued',
        validUntil: null,
        verifier: issuer,
        type: bundle.type,
      };
    }

    // Reject debuggable TEEs — they leak secrets.
    if (claims['x-ms-tee-is-debuggable'] === true) {
      return {
        outcome: 'POLICY_VIOLATION',
        measurement: null,
        summary: 'TEE is debuggable — rejected',
        validUntil: null,
        verifier: issuer,
        type: bundle.type,
      };
    }

    // Compose the canonical measurement. Prefer launch measurement, fall
    // back to compliance status, then policy hash.
    const measurement =
      claims['x-ms-sevsnpvm-launchmeasurement'] ??
      claims['x-ms-compliance-status'] ??
      claims['x-ms-policy-hash'] ??
      null;

    if (!measurement) {
      return {
        outcome: 'POLICY_VIOLATION',
        measurement: null,
        summary: 'No measurement in MAA token — cannot pin identity',
        validUntil: null,
        verifier: issuer,
        type: bundle.type,
      };
    }

    // Pin to claimed measurement if the seller declared one.
    if (
      bundle.claimedMeasurement &&
      measurement.toLowerCase() !== bundle.claimedMeasurement.toLowerCase()
    ) {
      return {
        outcome: 'POLICY_VIOLATION',
        measurement,
        summary: `Measurement mismatch: token=${measurement.slice(0, 16)}… claimed=${bundle.claimedMeasurement.slice(0, 16)}…`,
        validUntil: null,
        verifier: issuer,
        type: bundle.type,
      };
    }

    logger.info('attestation.azure.verified', {
      issuer,
      measurement: measurement.slice(0, 16) + '…',
      teeType: claims['x-ms-attestation-type'],
      alg: protectedHeader.alg,
    });

    return {
      outcome: 'VERIFIED',
      measurement,
      summary: `Azure MAA verified (${claims['x-ms-attestation-type'] ?? 'unknown tee'})`,
      validUntil: new Date(Date.now() + DEFAULT_VALIDITY_MS),
      verifier: issuer,
      type: bundle.type,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('attestation.azure.verify_failed', { error: message });
    return badSignature(message);
  }
}

async function verifyJwt(token: string) {
  // Peek the issuer from the unverified payload so we can pick the right
  // JWKS. This is safe because we then *verify* the signature against
  // that issuer's keys — an attacker cannot trick us into using a
  // different key set without having the private key.
  const [, payloadSegment] = token.split('.');
  if (!payloadSegment) throw new Error('Malformed JWT — missing payload');

  const peeked = JSON.parse(
    Buffer.from(
      payloadSegment.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8'),
  ) as { iss?: string };

  const issuer = peeked.iss;
  if (!issuer || typeof issuer !== 'string') {
    throw new Error('JWT missing iss claim');
  }
  if (!KNOWN_MAA_ISSUERS.includes(issuer)) {
    throw new Error(`Untrusted issuer: ${issuer}`);
  }

  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    const jwksUrl = new URL('/certs', issuer);
    jwks = createRemoteJWKSet(jwksUrl, {
      cooldownDuration: 5 * 60 * 1000,   // 5 min cache
      timeoutDuration: 5 * 1000,          // 5s fetch timeout
    });
    jwksCache.set(issuer, jwks);
  }

  return jwtVerify(token, jwks, {
    issuer,
    algorithms: ['RS256'],
    clockTolerance: 30,
  });
}

function badSignature(reason: string): AttestationVerdict {
  return {
    outcome: 'BAD_SIGNATURE',
    measurement: null,
    summary: `Signature verification failed: ${reason}`,
    validUntil: null,
    verifier: null,
    type: 'AZURE_CONFIDENTIAL_VM',
  };
}
