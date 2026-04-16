'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Only import PostHog when the key is configured (avoid loading ~50KB library in dev/unconfigured)
let posthogModule: typeof import('posthog-js') | null = null;
let PHProvider: React.ComponentType<{ client: unknown; children: ReactNode }> | null = null;
let usePostHog: (() => ReturnType<typeof import('posthog-js/react')['usePostHog']>) | null = null;

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog?.();

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url += '?' + searchParams.toString();
      }
      posthogClient.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

function PostHogIdentify() {
  const { user, isDemo } = useAuth();
  const posthogClient = usePostHog?.();

  useEffect(() => {
    if (user && posthogClient) {
      // GDPR: never send PII (email, name) to PostHog. Use the
      // opaque user ID only — sufficient for funnel analytics without
      // creating a personal data export obligation to PostHog.
      if (isDemo) {
        posthogClient.identify('demo_user', {
          plan: 'pro',
          is_demo: true,
        });
      } else {
        posthogClient.identify(user.id, {
          plan: user.plan,
          is_demo: false,
        });
      }
    } else if (!user && posthogClient) {
      posthogClient.reset();
    }
  }, [user, isDemo, posthogClient]);

  return null;
}

export default function PostHogProviderWrapper({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [posthogInstance, setPosthogInstance] = useState<unknown>(null);

  useEffect(() => {
    // Skip if no PostHog key configured — library never loads
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    // GDPR: only load analytics if user has consented. The consent
    // state is stored in localStorage by the CookieConsent component.
    // If no consent decision has been made, we don't load PostHog.
    const consent = localStorage.getItem('il_analytics_consent');
    if (consent !== 'granted') return;

    // Dynamic import — only loads posthog-js when key exists AND consent granted
    Promise.all([
      import('posthog-js'),
      import('posthog-js/react'),
    ]).then(([ph, phReact]) => {
      posthogModule = ph;
      PHProvider = phReact.PostHogProvider as typeof PHProvider;
      usePostHog = phReact.usePostHog;

      ph.default.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
      });

      setPosthogInstance(ph.default);
      setReady(true);
    });
  }, []);

  // No PostHog key — render children without tracking (zero library overhead)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !ready || !PHProvider) {
    return <>{children}</>;
  }

  const Provider = PHProvider;

  return (
    <Provider client={posthogInstance}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </Provider>
  );
}
