'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Initialize PostHog only if key is configured
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We capture manually below
    capture_pageleave: true,
  });
}

// Track page views on route changes
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

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

// Identify user when authenticated
function PostHogIdentify() {
  const { user, isDemo } = useAuth();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (user && posthogClient) {
      if (isDemo) {
        posthogClient.identify('demo_user', {
          plan: 'pro',
          is_demo: true,
        });
      } else {
        posthogClient.identify(user.id, {
          email: user.email,
          name: user.name,
          plan: user.plan,
          provider: user.provider,
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
  // If PostHog is not configured, render children without tracking
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
