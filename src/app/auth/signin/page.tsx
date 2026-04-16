'use client';

import { Suspense } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Provider {
  id: string;
  name: string;
  type: string;
}

function SignInContent() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  const providerIcons: Record<string, { bg: string; label: string }> = {
    google: { bg: 'bg-white text-black', label: 'Continue with Google' },
    github: { bg: 'bg-[#24292e] text-white', label: 'Continue with GitHub' },
    apple: { bg: 'bg-black text-white', label: 'Continue with Apple' },
    microsoft: { bg: 'bg-[#00a4ef] text-white', label: 'Continue with Microsoft' },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-white text-xl">InferLane</span>
          </a>
          <h1 className="text-2xl font-bold text-white">Sign in to your account</h1>
          <p className="text-gray-400 mt-2">The intelligent inference platform. Route, schedule, and optimize AI across every provider.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {['Smart dispatch', 'Cross-provider sessions', 'AI triage', 'Cost savings intelligence'].map((feature) => (
              <span key={feature} className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e2e] text-gray-400 border border-[#2a2a3a]">
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error === 'OAuthSignin' && 'Error starting OAuth sign in.'}
            {error === 'OAuthCallback' && 'Error during OAuth callback.'}
            {error === 'Callback' && 'Error during callback.'}
            {error === 'Default' && 'An error occurred during sign in.'}
            {!['OAuthSignin', 'OAuthCallback', 'Callback', 'Default'].includes(error) && error}
          </div>
        )}

        {/* Sign-in card */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
          {/* OAuth providers */}
          {providers &&
            Object.values(providers)
              .filter((p) => p.type === 'oauth')
              .map((provider) => {
                const info = providerIcons[provider.id] || { bg: 'bg-gray-700 text-white', label: `Continue with ${provider.name}` };
                return (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setLoading(provider.id);
                      signIn(provider.id, { callbackUrl });
                    }}
                    disabled={!!loading}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all ${info.bg} hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3`}
                  >
                    {loading === provider.id ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    {info.label}
                  </button>
                );
              })}

          {/* Divider */}
          {providers && Object.values(providers).some((p) => p.type === 'email') && (
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[#1e1e2e]" />
              <span className="text-xs text-gray-500">or sign in with email</span>
              <div className="flex-1 h-px bg-[#1e1e2e]" />
            </div>
          )}

          {/* Email magic link */}
          {providers && Object.values(providers).some((p) => p.type === 'email') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLoading('email');
                signIn('email', { email, callbackUrl });
              }}
              className="space-y-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#2a2a3a] text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-sm"
              />
              <button
                type="submit"
                disabled={!!loading || !email}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading === 'email' ? 'Sending magic link...' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* No providers configured — show private-beta + demo message */}
          {providers && Object.keys(providers).length === 0 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 text-xs font-medium px-3 py-1 rounded-full mb-4 border border-amber-500/20">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                Private beta — account signups coming soon
              </div>
              <p className="text-gray-300 text-sm mb-2">
                InferLane is in private beta while we harden the production auth path. In the meantime:
              </p>
              <ul className="text-gray-400 text-sm space-y-1 mb-5 text-left inline-block">
                <li>
                  <span className="text-green-400">✓</span> The <strong className="text-white">MCP plugin</strong> works today — three tools run fully offline, no account needed
                </li>
                <li>
                  <span className="text-green-400">✓</span> The <strong className="text-white">demo dashboard</strong> is live with mock data so you can see what you&apos;d be signing up for
                </li>
                <li>
                  <span className="text-amber-400">○</span> Real accounts + API keys coming as soon as OAuth is wired
                </li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                <a
                  href="/"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:brightness-110 transition-all"
                >
                  Try the demo dashboard
                </a>
                <a
                  href="https://www.npmjs.com/package/@inferlane/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-xl bg-[#1e1e2e] border border-[#2a2a3a] text-white font-medium text-sm hover:bg-[#2a2a3a] transition-all"
                >
                  Install the MCP plugin
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
