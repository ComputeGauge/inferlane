'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  if (!showAuthModal) return null;

  const handleOAuthLogin = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      await login(provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoadingProvider('email');
    try {
      await login('email', email);
    } finally {
      setLoadingProvider(null);
    }
  };

  const oauthProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      bg: 'bg-white hover:bg-gray-100',
      text: 'text-gray-800',
      note: 'Used by: Google AI Studio, Gemini',
    },
    {
      id: 'apple',
      name: 'Apple',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
      ),
      bg: 'bg-black hover:bg-gray-900',
      text: 'text-white',
      note: 'Used by: Apple Intelligence (iCloud)',
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      ),
      bg: 'bg-[#24292e] hover:bg-[#2f363d]',
      text: 'text-white',
      note: 'Used by: OpenAI, Anthropic, Together AI, Replicate',
    },
    {
      id: 'microsoft',
      name: 'Microsoft',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
          <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
        </svg>
      ),
      bg: 'bg-[#2F2F2F] hover:bg-[#3a3a3a]',
      text: 'text-white',
      note: 'Used by: Azure OpenAI, Copilot, Bing AI',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 text-center relative">
          <button
            onClick={() => setShowAuthModal(false)}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {authMode === 'login'
              ? 'Sign in to access your AI spend dashboard'
              : 'Start tracking your AI compute spend for free'}
          </p>
        </div>

        {/* OAuth Providers */}
        <div className="px-6 space-y-2.5">
          {oauthProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleOAuthLogin(provider.id)}
              disabled={isLoading}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${provider.bg} ${provider.text} relative group disabled:opacity-50`}
            >
              {loadingProvider === provider.id ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                provider.icon
              )}
              <span>Continue with {provider.name}</span>
              <span className="absolute right-3 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity font-normal">
                {provider.note}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="px-6 my-5">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1e1e2e]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#12121a] px-3 text-gray-500">or continue with email</span>
            </div>
          </div>
        </div>

        {/* Email login */}
        <form onSubmit={handleEmailLogin} className="px-6 pb-2">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={!email || isLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:hover:brightness-100"
            >
              {loadingProvider === 'email' ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            We&apos;ll send you a magic link — no password needed
          </p>
        </form>

        {/* Demo Mode */}
        <div className="px-6 mt-3">
          <button
            onClick={() => handleOAuthLogin('demo')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-[#1a1a2e] hover:bg-[#252540] text-gray-300 border border-[#2a2a3e] hover:border-amber-500/30 disabled:opacity-50"
          >
            {loadingProvider === 'demo' ? (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
            Try Demo — no sign-up required
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e1e2e] mt-4">
          <p className="text-xs text-gray-500 text-center">
            {authMode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={() => setAuthMode('signup')} className="text-amber-400 hover:text-amber-300">
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => setAuthMode('login')} className="text-amber-400 hover:text-amber-300">
                  Sign in
                </button>
              </>
            )}
          </p>
          <p className="text-[10px] text-gray-700 text-center mt-2">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
