'use client';

import { useCallback } from 'react';

// Track funnel events — safe to call even when PostHog is not configured
export function useTrack() {
  return useCallback((event: string, properties?: Record<string, unknown>) => {
    // PostHog attaches to window.posthog when initialized
    const ph = typeof window !== 'undefined' ? (window as any).posthog : null;
    if (ph?.capture) {
      ph.capture(event, properties);
    }
  }, []);
}

// Standard funnel events
export const EVENTS = {
  // Acquisition funnel
  LANDING_PAGE_VIEW: 'landing_page_view',
  PRICING_TOGGLE: 'pricing_toggle',
  CTA_CLICK: 'cta_click',

  // Auth funnel
  AUTH_MODAL_OPEN: 'auth_modal_open',
  AUTH_PROVIDER_CLICK: 'auth_provider_click',
  DEMO_START: 'demo_start',
  SIGNUP_COMPLETE: 'signup_complete',

  // Activation funnel
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_STEP: 'onboarding_step',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  PROVIDER_CONNECTED: 'provider_connected',
  BUDGET_SET: 'budget_set',
  ALERT_CREATED: 'alert_created',

  // Revenue funnel
  UPGRADE_BANNER_VIEW: 'upgrade_banner_view',
  UPGRADE_BANNER_CLICK: 'upgrade_banner_click',
  UPGRADE_BANNER_DISMISS: 'upgrade_banner_dismiss',
  CHECKOUT_START: 'checkout_start',

  // Engagement
  FEEDBACK_SUBMIT: 'feedback_submit',
  API_KEY_CREATED: 'api_key_created',
  SMART_ROUTER_USED: 'smart_router_used',
  REFERRAL_INVITE_SENT: 'referral_invite_sent',
} as const;
