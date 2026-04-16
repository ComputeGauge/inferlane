'use client';

import { useEffect, useState, use } from 'react';

// /dashboard/admin/disputes/:id/resolve — reviewer resolution form.
//
// Gated on ADMIN role (server-side check in /api/disputes/:id/resolve)
// AND step-up re-auth (X-Step-Up-Token header with scope
// `dispute.resolve`). If the token is missing or expired the user is
// prompted to re-authenticate before the resolution is accepted.
//
// Flow:
//   1. Load the dispute detail
//   2. Reviewer picks an outcome (BUYER / OPERATOR / SPLIT) and a
//      refund amount
//   3. Reviewer writes reasoning
//   4. Client POSTs to /api/disputes/:id/resolve with
//      X-Step-Up-Token header
//   5. On 401 with step-up error, client pops the re-auth flow
//      (calls POST /api/auth/step-up with scope dispute.resolve),
//      stores the returned token in sessionStorage, and retries
//   6. On success, redirect to the detail page

interface DisputeDetail {
  id: string;
  status: string;
  reason: string;
  description: string;
  amountUsdCents: string;
}

const STEP_UP_STORAGE_KEY = 'il_stepup_dispute_resolve';

export default function ResolvePage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = use(params);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'BUYER' | 'OPERATOR' | 'SPLIT'>('OPERATOR');
  const [refundUsd, setRefundUsd] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stepUpNeeded, setStepUpNeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/disputes/${disputeId}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Not found' : `Failed: ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setDispute(data.dispute);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [disputeId]);

  async function doStepUp(): Promise<string | null> {
    // Simplified: real flow collects WebAuthn or password here.
    // For now we POST with empty body and expect the server to
    // short-circuit if no MFA is available. The token lives in
    // sessionStorage for the life of the browser tab.
    try {
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'dispute.resolve' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.token) {
        sessionStorage.setItem(STEP_UP_STORAGE_KEY, data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!dispute) throw new Error('Dispute not loaded');
      const refundCents = BigInt(Math.round(parseFloat(refundUsd || '0') * 100));
      if (reasoning.length < 10) {
        setError('Reasoning must be at least 10 characters');
        setSubmitting(false);
        return;
      }

      let token = sessionStorage.getItem(STEP_UP_STORAGE_KEY);

      for (let attempt = 0; attempt < 2; attempt++) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers['X-Step-Up-Token'] = token;

        const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            outcome,
            refundCents: refundCents.toString(),
            reasoning,
          }),
        });

        if (res.ok) {
          window.location.href = `/dashboard/disputes/${disputeId}`;
          return;
        }

        if (res.status === 401 && attempt === 0) {
          setStepUpNeeded(true);
          token = await doStepUp();
          if (!token) {
            setError('Step-up re-authentication failed');
            setSubmitting(false);
            return;
          }
          continue;
        }

        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed: ${res.status}`);
        setSubmitting(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error && !dispute) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!dispute) return null;

  const maxUsd = (Number(dispute.amountUsdCents) / 100).toFixed(2);

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Resolve dispute</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reviewer-only. Resolving writes a ledger entry and cannot be
          undone without an appeal.
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
        <p className="text-xs uppercase text-gray-500 mb-1">Dispute</p>
        <p className="font-mono text-sm text-white">{dispute.id}</p>
        <p className="text-sm text-gray-400 mt-2">
          <strong>Reason:</strong> {dispute.reason}
        </p>
        <p className="text-sm text-gray-400">
          <strong>Amount at stake:</strong> ${maxUsd}
        </p>
        <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{dispute.description}</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
            Outcome
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as 'BUYER' | 'OPERATOR' | 'SPLIT')}
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          >
            <option value="BUYER">Buyer wins (full refund)</option>
            <option value="OPERATOR">Operator wins (no refund)</option>
            <option value="SPLIT">Split (partial refund)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
            Refund (USD)
          </label>
          <input
            type="number"
            min={0}
            max={Number(maxUsd)}
            step="0.01"
            value={refundUsd}
            onChange={(e) => setRefundUsd(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Max: ${maxUsd}</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
            Reasoning (at least 10 characters)
          </label>
          <textarea
            rows={6}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Explain the decision. This is recorded permanently."
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          />
          <p className="text-xs text-gray-500 mt-1">{reasoning.length} / min 10</p>
        </div>
      </div>

      {stepUpNeeded && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
          Step-up re-authentication required. Attempting now...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || reasoning.length < 10}
        className="rounded-lg bg-white text-black px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? 'Resolving...' : 'Resolve dispute'}
      </button>
    </form>
  );
}
