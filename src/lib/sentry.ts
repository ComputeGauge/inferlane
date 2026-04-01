/**
 * Sentry Error Tracking — client-side initialization
 *
 * To enable: set NEXT_PUBLIC_SENTRY_DSN in your environment variables.
 * Without the DSN, this module is a no-op (zero overhead).
 */

let sentryInitialized = false;

export async function initSentry() {
  if (sentryInitialized) return;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (typeof window === 'undefined') return;

  try {
    // Use string variable to prevent Next.js from statically resolving the module
    const sentryModuleName = '@sentry/nextjs';
    const Sentry = await import(/* webpackIgnore: true */ sentryModuleName);
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Failed to connect to MetaMask',
        /Loading chunk \d+ failed/,
      ],
      beforeSend(event: { user?: { ip_address?: string; email?: string } }) {
        if (event.user) {
          delete event.user.ip_address;
          delete event.user.email;
        }
        return event;
      },
    });
    sentryInitialized = true;
  } catch {
    // Sentry SDK not installed — silently skip
    console.debug('Sentry SDK not available, error tracking disabled');
  }
}

/**
 * Capture an error manually (e.g., from error boundaries)
 */
export async function captureError(error: Error, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const sentryModuleName = '@sentry/nextjs';
    const Sentry = await import(/* webpackIgnore: true */ sentryModuleName);
    if (context) {
      Sentry.setContext('extra', context);
    }
    Sentry.captureException(error);
  } catch {
    // Sentry not available
  }
}
