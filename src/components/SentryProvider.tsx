'use client';

import { useEffect } from 'react';
import { initSentry } from '@/lib/sentry';

/**
 * Initializes Sentry on mount. No-op if NEXT_PUBLIC_SENTRY_DSN is unset.
 * Dynamic import means @sentry/nextjs is only loaded when DSN exists.
 */
export default function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentry();
  }, []);

  return <>{children}</>;
}
