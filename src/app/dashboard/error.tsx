'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/sentry';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { page: 'dashboard', digest: error.digest });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-2xl mb-6">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Dashboard Error</h2>
      <p className="text-gray-400 text-sm mb-1 max-w-md">
        Something went wrong loading your dashboard. This could be a temporary issue.
      </p>
      {error.digest && (
        <p className="text-gray-600 text-xs font-mono mb-4">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-amber-500 text-black font-semibold rounded-xl text-sm hover:bg-amber-400 transition-all"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-5 py-2.5 bg-[#1e1e2e] text-gray-300 font-medium rounded-xl text-sm hover:bg-[#2a2a3a] transition-all"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
