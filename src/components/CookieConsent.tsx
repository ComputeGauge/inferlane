'use client';

// GDPR / ePrivacy cookie consent banner.
//
// Blocks all non-essential cookies (PostHog analytics) until the user
// explicitly consents. Essential cookies (NextAuth session, CSRF,
// il_demo) are always allowed — they're strictly necessary for the
// service to function.
//
// Consent state is stored in localStorage as 'il_analytics_consent':
//   'granted'  — user clicked Accept → PostHog loads
//   'denied'   — user clicked Decline → PostHog never loads
//   (absent)   — no decision yet → PostHog never loads (default-deny)
//
// The PostHogProviderWrapper checks this value before loading the
// analytics library, so this banner controls the actual behavior.

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no consent decision has been made
    const consent = localStorage.getItem('il_analytics_consent');
    if (!consent) {
      // Small delay so the banner doesn't flash on first paint
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('il_analytics_consent', 'granted');
    setVisible(false);
    // Reload so PostHogProvider picks up the new consent state
    window.location.reload();
  };

  const handleDecline = () => {
    localStorage.setItem('il_analytics_consent', 'denied');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-2xl mx-auto bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-5 shadow-2xl shadow-black/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 leading-relaxed">
              We use analytics cookies (PostHog) to understand how the dashboard is used —
              no prompt content, no API keys, no PII is ever sent to analytics.{' '}
              <a
                href="/privacy-policy"
                className="text-amber-400 hover:text-amber-300 underline"
              >
                Privacy policy
              </a>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
