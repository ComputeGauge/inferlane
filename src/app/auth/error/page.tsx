'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'Access was denied. You may not have permission to sign in.',
    Verification: 'The verification link has expired or has already been used.',
    Default: 'An unexpected error occurred during authentication.',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Authentication Error</h1>
        <p className="text-gray-400 mb-6">
          {errorMessages[error || 'Default'] || errorMessages.Default}
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/auth/signin"
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium text-sm hover:brightness-110 transition-all"
          >
            Try Again
          </a>
          <a
            href="/"
            className="px-6 py-2 rounded-xl bg-[#1e1e2e] text-gray-300 text-sm font-medium hover:bg-[#2a2a3a] transition-all"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
