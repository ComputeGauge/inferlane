import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // Partner attribution — capture ?partner=<slug> into a 90-day cookie
  const partnerSlug = req.nextUrl.searchParams.get('partner') || req.nextUrl.searchParams.get('ref');
  if (partnerSlug && !req.cookies.get('il_partner')) {
    response.cookies.set('il_partner', partnerSlug, {
      maxAge: 90 * 24 * 60 * 60, // 90 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  // Dashboard routes — require authentication (or demo cookie)
  if (pathname.startsWith('/dashboard')) {
    const isDemo = req.cookies.get('il_demo')?.value === '1';
    if (!token && !isDemo) {
      const signInUrl = new URL('/', req.url);
      signInUrl.searchParams.set('auth', 'required');
      return NextResponse.redirect(signInUrl);
    }
  }

  // Protected API routes (not proxy — proxy uses its own API key auth)
  if (pathname.startsWith('/api/providers') ||
      pathname.startsWith('/api/spend') ||
      pathname.startsWith('/api/alerts') ||
      pathname.startsWith('/api/api-keys') ||
      pathname.startsWith('/api/account') ||
      pathname.startsWith('/api/credits') ||
      pathname.startsWith('/api/invoices') ||
      pathname.startsWith('/api/teams') ||
      pathname.startsWith('/api/user') ||
      pathname.startsWith('/api/forecast') ||
      pathname.startsWith('/api/recommendations') ||
      pathname.startsWith('/api/savings') ||
      pathname.startsWith('/api/scheduler') ||
      pathname.startsWith('/api/trading') ||
      pathname.startsWith('/api/gpu') ||
      pathname.startsWith('/api/compute-intel') ||
      pathname.startsWith('/api/dispatch') ||
      pathname.startsWith('/api/sessions') ||
      pathname.startsWith('/api/partners') ||
      pathname.startsWith('/api/referral') ||
      pathname.startsWith('/api/integrations') ||
      pathname.startsWith('/api/stripe/checkout') ||
      pathname.startsWith('/api/stripe/portal')) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Admin routes — require admin role
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (token.role !== 'ADMIN' && token.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Admin API routes
  if (pathname.startsWith('/api/admin')) {
    if (!token || (token.role !== 'ADMIN' && token.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // CSRF protection for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');

    // Skip CSRF for API key auth (Bearer il_) — these are programmatic, not browser
    const authHeader = req.headers.get('authorization');
    const isApiKeyAuth = authHeader?.startsWith('Bearer il_');

    // Skip CSRF for cron endpoints
    const isCron = pathname.startsWith('/api/cron/');

    // Skip CSRF for webhook endpoints (Stripe, etc.)
    const isWebhook = pathname.includes('/webhook');

    if (!isApiKeyAuth && !isCron && !isWebhook && origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/auth/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/account/:path*',
    '/api/admin/:path*',
    '/api/alerts/:path*',
    '/api/api-keys/:path*',
    '/api/compute-intel/:path*',
    '/api/credits/:path*',
    '/api/dispatch/:path*',
    '/api/forecast/:path*',
    '/api/gpu/:path*',
    '/api/integrations/:path*',
    '/api/invoices/:path*',
    '/api/partners/:path*',
    '/api/providers/:path*',
    '/api/recommendations/:path*',
    '/api/referral/:path*',
    '/api/savings/:path*',
    '/api/scheduler/:path*',
    '/api/sessions/:path*',
    '/api/spend/:path*',
    '/api/stripe/checkout/:path*',
    '/api/stripe/portal/:path*',
    '/api/teams/:path*',
    '/api/trading/:path*',
    '/api/user/:path*',
  ],
};
