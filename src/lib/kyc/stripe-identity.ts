// KYC via Stripe Identity.
//
// Commercial build, Phase 2.1 (identity verification for sellers + high-value
// buyers). Wraps Stripe's Identity Verification Session API so the rest of
// the codebase never sees raw Stripe primitives.
//
// Why a wrapper: Stripe Identity verification sessions have their own
// lifecycle (requires_input → processing → verified/canceled/requires_action)
// and their own audit trail. We translate to our own enum so we can swap
// providers later if needed without refactoring call sites.

import Stripe from 'stripe';
import { logger } from '@/lib/telemetry';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

export type KycStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'REQUIRES_ACTION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export interface KycSession {
  providerSessionId: string;          // Stripe VerificationSession id
  clientSecret: string | null;        // For embedded verification UI
  verificationUrl: string | null;     // For redirect flow
  status: KycStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface KycResult {
  status: KycStatus;
  providerSessionId: string;
  verifiedAt: Date | null;
  attestationHash: string | null;     // SHA-256 of the verified report
  lastError: string | null;
}

const EXPIRY_HOURS = 72;

/**
 * Start a KYC session. `purpose` is either 'buyer' (for high-value buyers
 * who cross spending thresholds) or 'seller' (for operator onboarding).
 * `subjectId` is the internal user id — we pass it through as metadata so
 * the webhook can link verifications back without storing PII here.
 */
export async function startKycSession(params: {
  subjectId: string;
  purpose: 'buyer' | 'seller';
  email: string;
  returnUrl?: string;
}): Promise<KycSession> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured — cannot start KYC');
  }

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      subjectId: params.subjectId,
      purpose: params.purpose,
      platform: 'inferlane',
    },
    options: {
      document: {
        allowed_types: ['driving_license', 'passport', 'id_card'],
        require_id_number: false,
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
    return_url: params.returnUrl,
  });

  logger.info('kyc.session.started', {
    provider: 'stripe_identity',
    purpose: params.purpose,
    subjectId: params.subjectId,
    providerSessionId: session.id,
  });

  const createdAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const expiresAt = new Date(createdAt.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);

  return {
    providerSessionId: session.id,
    clientSecret: session.client_secret ?? null,
    verificationUrl: session.url ?? null,
    status: mapStatus(session.status),
    createdAt,
    expiresAt,
  };
}

/**
 * Fetch the latest status of a KYC session. Use after a user returns from
 * the Stripe Identity flow, or polled from a webhook handler.
 */
export async function getKycStatus(providerSessionId: string): Promise<KycResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }

  const session = await stripe.identity.verificationSessions.retrieve(providerSessionId);
  const status = mapStatus(session.status);

  // Build the attestation hash from non-PII fields: status + session id
  // + last_verification_report id. Gives us something to put in the audit
  // log that is deterministic and privacy-safe.
  const attestationInput = [
    session.id,
    session.status,
    session.last_verification_report ?? '',
    session.last_error?.code ?? '',
  ].join('|');

  let attestationHash: string | null = null;
  try {
    const { createHash } = await import('node:crypto');
    attestationHash = createHash('sha256').update(attestationInput).digest('hex');
  } catch {
    // Edge runtime fallback — leave null; caller can fill in from DB.
  }

  return {
    status,
    providerSessionId: session.id,
    verifiedAt: status === 'VERIFIED' ? new Date() : null,
    attestationHash,
    lastError: session.last_error?.reason ?? null,
  };
}

/**
 * Screen a subject against our sanctions / denied-party list. Stripe
 * Identity also performs OFAC screening internally as part of verification,
 * but we layer our own list for jurisdictions Stripe does not cover.
 *
 * Returns true if the subject is clear, false if they are on a denied list.
 */
export async function screenSanctions(params: {
  firstName: string;
  lastName: string;
  country: string;
  dateOfBirth?: string;
}): Promise<{ clear: boolean; matchedLists: string[] }> {
  // Internal list check
  const internalList = await loadDeniedPartyList();
  const key = `${params.firstName.toLowerCase()}|${params.lastName.toLowerCase()}|${params.country.toUpperCase()}`;

  const matched: string[] = [];
  if (internalList.has(key)) matched.push('internal');

  // TODO(phase-2): wire up OFAC + UK HMT + EU consolidated list
  // fetchers with daily refresh. For now we rely on Stripe Identity
  // for OFAC and our internal list for specific block patterns.

  return { clear: matched.length === 0, matchedLists: matched };
}

async function loadDeniedPartyList(): Promise<Set<string>> {
  // Stub: load from DB or env-configured URL in a real deployment.
  // Returning an empty set keeps tests and dev quiet.
  return new Set<string>();
}

function mapStatus(stripeStatus: Stripe.Identity.VerificationSession.Status): KycStatus {
  switch (stripeStatus) {
    case 'requires_input':
      return 'REQUIRES_ACTION';
    case 'processing':
      return 'IN_PROGRESS';
    case 'verified':
      return 'VERIFIED';
    case 'canceled':
      return 'REJECTED';
    default:
      return 'NOT_STARTED';
  }
}
