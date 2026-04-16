// Attestation facade.
//
// Commercial build, Phase 4.1 (TEE). The marketplace supports two paths for
// Confidential-tier workloads:
//
//   1. MANAGED — the seller runs on Azure Confidential VMs or Google
//      Confidential Space. Attestation is verified by the cloud's managed
//      attestation service (Microsoft Azure Attestation, Google Attestation
//      Verifier). We receive a signed token from the cloud's verifier and
//      only need to validate the signature and policy binding.
//
//   2. DIY — the seller runs their own TDX / SEV-SNP / NVIDIA CC hardware.
//      We receive the raw hardware quote and verify it against the vendor's
//      certificate chain ourselves, following the RATS conceptual model
//      (RFC 9334) and vendor-specific quote formats.
//
// This file is the facade both paths plug into. It exposes one function:
//
//     verifyAttestation(bundle: AttestationBundle) -> AttestationVerdict
//
// ...so every caller (router, dispatcher, settlement) asks the same
// question regardless of which path the seller chose. The verdict includes
// a measurement hash we record alongside the session, giving us a tamper-
// evident audit trail.

import { logger, withSpan } from '@/lib/telemetry';

export type AttestationType =
  | 'AZURE_CONFIDENTIAL_VM'   // Azure MAA-signed token
  | 'GCP_CONFIDENTIAL_SPACE'  // Google attestation verifier token
  | 'INTEL_TDX'               // Raw TDX quote
  | 'AMD_SEV_SNP'             // Raw SEV-SNP attestation report
  | 'NVIDIA_CC'               // NVIDIA confidential compute attestation
  | 'APPLE_SILICON_MDM'       // Apple Managed Device Attestation (Secure Enclave + hardened runtime)
  | 'MOCK';                   // Dev / test only

export interface AttestationBundle {
  type: AttestationType;
  /** Raw attestation evidence (JWT for managed, base64 quote for DIY) */
  evidence: string;
  /** Optional vendor endorsements / certificate chain (PEM bundle) */
  endorsements?: string;
  /** Operator-claimed measurement the evidence should pin to */
  claimedMeasurement?: string;
  /** Nonce issued by us so evidence is bound to this session */
  nonce: string;
  /** When the bundle was collected (used to reject stale evidence) */
  collectedAt: Date;
}

export type AttestationOutcome =
  | 'VERIFIED'         // signature valid, policy satisfied, fresh
  | 'STALE'            // evidence too old
  | 'BAD_SIGNATURE'    // signature or chain invalid
  | 'POLICY_VIOLATION' // measurement doesn't match expected
  | 'NONCE_MISMATCH'   // replay protection failed
  | 'UNSUPPORTED'      // we don't speak this type yet
  | 'ERROR';

export interface AttestationVerdict {
  outcome: AttestationOutcome;
  /**
   * Canonical measurement we record in the audit log. Typically the
   * SHA-256 of the code + data identity claimed in the evidence.
   */
  measurement: string | null;
  /** Human-readable summary for dashboard display */
  summary: string;
  /** When this verdict expires (we re-attest periodically) */
  validUntil: Date | null;
  /** Upstream verifier id, if managed path used one */
  verifier: string | null;
  /** Original evidence type for downstream routing decisions */
  type: AttestationType;
}

const MAX_EVIDENCE_AGE_MS = 15 * 60 * 1000;   // 15 minutes
const DEFAULT_VALIDITY_MS = 60 * 60 * 1000;   // 1 hour

export async function verifyAttestation(
  bundle: AttestationBundle,
): Promise<AttestationVerdict> {
  return withSpan(
    'attestation.verify',
    { type: bundle.type },
    async (span) => {
      // Freshness check before doing any signature work
      const age = Date.now() - bundle.collectedAt.getTime();
      if (age > MAX_EVIDENCE_AGE_MS) {
        span.setAttribute('outcome', 'STALE');
        return stale(bundle.type, age);
      }

      switch (bundle.type) {
        case 'AZURE_CONFIDENTIAL_VM':
          return verifyAzure(bundle);
        case 'GCP_CONFIDENTIAL_SPACE':
          return verifyGcp(bundle);
        case 'INTEL_TDX':
          return verifyTdx(bundle);
        case 'AMD_SEV_SNP':
          return verifySevSnp(bundle);
        case 'NVIDIA_CC':
          return verifyNvidiaCc(bundle);
        case 'APPLE_SILICON_MDM':
          return verifyAppleSiliconMdm(bundle);
        case 'MOCK':
          return verifyMock(bundle);
        default:
          return {
            outcome: 'UNSUPPORTED',
            measurement: null,
            summary: `Unknown attestation type: ${bundle.type}`,
            validUntil: null,
            verifier: null,
            type: bundle.type,
          };
      }
    },
  );
}

// ---- Managed paths ----
// These are stubs that TODO into the real verifier SDKs. They already
// enforce the facade contract so downstream code can depend on them.

async function verifyAzure(bundle: AttestationBundle): Promise<AttestationVerdict> {
  // Real Azure MAA JWT verification is in ./azure.ts. Dynamic import so
  // edge-runtime routes that never touch attestation don't pay the
  // import cost.
  const { verifyAzureMaa } = await import('./azure');
  return verifyAzureMaa(bundle);
}

async function verifyGcp(bundle: AttestationBundle): Promise<AttestationVerdict> {
  // TODO(phase-4.1): validate the GCP attestation verifier JWT via
  // confidentialcomputing.googleapis.com JWKS.
  logger.warn('attestation.gcp.not_implemented', { nonce: bundle.nonce });
  return {
    outcome: 'UNSUPPORTED',
    measurement: null,
    summary: 'GCP Confidential Space verifier not yet wired (Phase 4.1)',
    validUntil: null,
    verifier: 'gcp-attestation-verifier',
    type: bundle.type,
  };
}

// ---- DIY paths ----
// These require vendor-specific quote parsing and certificate chain
// validation. Full implementations live in Phase 4.2.

async function verifyTdx(bundle: AttestationBundle): Promise<AttestationVerdict> {
  // Dispatched to the structured scaffold in ./tdx.ts which at
  // minimum sanity-checks the quote shape before returning
  // UNSUPPORTED. Phase 4.2 replaces the inner function with the
  // full DCAP chain validation.
  const { verifyTdxQuote } = await import('./tdx');
  return verifyTdxQuote(bundle);
}

async function verifySevSnp(bundle: AttestationBundle): Promise<AttestationVerdict> {
  const { verifySevSnpReport } = await import('./sev-snp');
  return verifySevSnpReport(bundle);
}

async function verifyNvidiaCc(bundle: AttestationBundle): Promise<AttestationVerdict> {
  logger.warn('attestation.nvidia_cc.not_implemented', { nonce: bundle.nonce });
  return {
    outcome: 'UNSUPPORTED',
    measurement: null,
    summary: 'NVIDIA CC attestation verifier not yet wired (Phase 4.2)',
    validUntil: null,
    verifier: 'nvidia-nvml',
    type: bundle.type,
  };
}

/**
 * Apple Managed Device Attestation — same chain Apple uses for
 * Private Cloud Compute. Real verifier lives in ./apple-mdm.ts:
 * CBOR decode → x5c chain validation → pinned Apple App
 * Attestation Root CA → nonce extension → authData parse → AAGUID
 * environment check → SHA-256 of leaf SPKI as canonical
 * measurement (operator's Secure Enclave identity).
 *
 * The expected AppID rpIdHash comes from
 * INFERLANE_APPLE_APPID_RP_HASH (SHA-256 of "<teamId>.<bundleId>"
 * hex-encoded). Absent → default zero hash forces explicit env
 * setting before production attestations are accepted.
 */
async function verifyAppleSiliconMdm(
  bundle: AttestationBundle,
): Promise<AttestationVerdict> {
  const { verifyAppleAppAttest } = await import('./apple-mdm');
  const expectedHashHex =
    process.env.INFERLANE_APPLE_APPID_RP_HASH ??
    '0000000000000000000000000000000000000000000000000000000000000000';
  const expectedHash = Buffer.from(expectedHashHex, 'hex');
  return verifyAppleAppAttest(bundle, expectedHash);
}

async function verifyMock(bundle: AttestationBundle): Promise<AttestationVerdict> {
  // Dev-only path. Rejects if NODE_ENV is production.
  if (process.env.NODE_ENV === 'production') {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: null,
      summary: 'Mock attestation rejected in production',
      validUntil: null,
      verifier: null,
      type: bundle.type,
    };
  }

  const measurement = bundle.claimedMeasurement ?? 'mock-measurement';
  return {
    outcome: 'VERIFIED',
    measurement,
    summary: 'Mock attestation (dev only) — do not use for real workloads',
    validUntil: new Date(Date.now() + DEFAULT_VALIDITY_MS),
    verifier: 'mock',
    type: bundle.type,
  };
}

function stale(type: AttestationType, ageMs: number): AttestationVerdict {
  return {
    outcome: 'STALE',
    measurement: null,
    summary: `Evidence is ${Math.round(ageMs / 1000)}s old (max ${MAX_EVIDENCE_AGE_MS / 1000}s)`,
    validUntil: null,
    verifier: null,
    type,
  };
}
