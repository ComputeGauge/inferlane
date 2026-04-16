'use client';

import { useEffect, useState } from 'react';

// Dashboard — Operator KYC onboarding.
//
// Commercial build, Phase 2.2 UI. Walks an operator through identity
// verification via Stripe Identity (src/lib/kyc/stripe-identity.ts).
//
// Flow:
//   1. User clicks "Start verification" → POST /api/kyc/sessions
//   2. We get back a client secret or verification URL
//   3. Open Stripe's hosted verification page or embed the verify flow
//   4. On return, poll /api/kyc/sessions/:id until VERIFIED
//
// The API routes ship in Phase 2.2. Until then this page renders a
// clear "coming soon" state with the backing docs link.

type KycStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'REQUIRES_ACTION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

const STATUS_LABEL: Record<KycStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  REQUIRES_ACTION: 'Requires action',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

const STATUS_COLOR: Record<KycStatus, string> = {
  NOT_STARTED: 'text-gray-400',
  IN_PROGRESS: 'text-amber-400',
  REQUIRES_ACTION: 'text-orange-400',
  VERIFIED: 'text-emerald-400',
  REJECTED: 'text-red-400',
  EXPIRED: 'text-red-400',
};

export default function KycOnboardingPage() {
  const [status, setStatus] = useState<KycStatus>('NOT_STARTED');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/kyc/sessions');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status) setStatus(data.status as KycStatus);
      } catch {
        /* ignore */
      }
    }
    load();
  }, []);

  async function startVerification() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/kyc/sessions', { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to start KYC: ${res.status}`);
      const data = await res.json();
      if (data?.verificationUrl) {
        window.location.href = data.verificationUrl;
      } else {
        setError('Verification URL not returned. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Identity verification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify your identity to sell compute on the InferLane marketplace.
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Status</p>
          <p className={`text-xl font-semibold ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </p>
        </div>

        {status === 'VERIFIED' ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-4 text-sm text-emerald-300">
            Your identity is verified. You can now accept workloads as an
            operator. Manage payouts and capabilities from the Operator
            dashboard.
          </div>
        ) : status === 'REJECTED' || status === 'EXPIRED' ? (
          <div className="rounded-lg border border-red-800 bg-red-950/20 p-4 text-sm text-red-300">
            Verification failed. Please contact support@inferlane.dev to
            review your situation.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              We use Stripe Identity to verify operators. You&apos;ll need:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li>A government-issued photo ID (passport, driving licence, or ID card)</li>
              <li>A camera for a live selfie comparison</li>
              <li>A few minutes of your time</li>
            </ul>
            <button
              onClick={startVerification}
              disabled={starting}
              className="rounded-lg bg-white text-black px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start verification'}
            </button>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Your identity documents are processed by Stripe Identity. InferLane
        stores only the verification result and an attestation hash, never
        the raw documents. See our{' '}
        <a href="/privacy-policy" className="underline hover:text-gray-300">
          Privacy Policy
        </a>{' '}
        for details.
      </p>
    </div>
  );
}
