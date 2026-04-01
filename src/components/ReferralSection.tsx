'use client';

import { useState } from 'react';
import { useTrack, EVENTS } from '@/hooks/useTrack';

interface ReferralSectionProps {
  userId: string;
  userPlan: string;
}

export default function ReferralSection({ userId, userPlan }: ReferralSectionProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const track = useTrack();

  const isFreePlan = userPlan === 'free';
  const userIdShort = userId.slice(0, 8);
  const referralPath = `/ref/${userIdShort}`;

  async function copyLink() {
    try {
      const fullLink = `${window.location.origin}${referralPath}`;
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  }

  async function sendInvite() {
    if (!email.trim() || isFreePlan) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/referral/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        track(EVENTS.REFERRAL_INVITE_SENT, { email });
        setStatus({ type: 'success', message: `Invite sent to ${email}` });
        setEmail('');
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: data.error || 'Failed to send invite.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Invite Your Team</h3>
        <p className="text-sm text-gray-500 mt-1">
          Both you and your teammate get 1 month of Pro free
        </p>
      </div>

      {isFreePlan && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">
            Available on Pro plan and above.{' '}
            <a href="/dashboard/settings" className="underline hover:text-amber-300">
              Upgrade
            </a>{' '}
            to start inviting teammates.
          </p>
        </div>
      )}

      {/* Referral link */}
      <div className="mb-6">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Your Referral Link</label>
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 text-sm text-white bg-[#0a0a0f] px-4 py-2 rounded-xl font-mono border border-[#1e1e2e] truncate">
            {referralPath}
          </code>
          <button
            onClick={copyLink}
            disabled={isFreePlan}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Email invite */}
      <div className="mb-6">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Invite by Email</label>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            disabled={isFreePlan}
            className="flex-1 px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
          />
          <button
            onClick={sendInvite}
            disabled={isFreePlan || sending || !email.trim()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`mb-4 p-3 rounded-xl border ${
            status.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      {/* Stats */}
      <div className="pt-4 border-t border-[#1e1e2e]">
        <p className="text-sm text-gray-500">
          0 invites sent &middot; 0 accepted
        </p>
      </div>
    </div>
  );
}
