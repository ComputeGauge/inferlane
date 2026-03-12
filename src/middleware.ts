import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Dashboard routes — require authentication (or demo cookie)
  if (pathname.startsWith('/dashboard')) {
    const isDemo = req.cookies.get('cg_demo')?.value === '1';
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/providers/:path*',
    '/api/spend/:path*',
    '/api/alerts/:path*',
    '/api/api-keys/:path*',
    '/api/stripe/checkout/:path*',
    '/api/stripe/portal/:path*',
    '/api/admin/:path*',
  ],
};
