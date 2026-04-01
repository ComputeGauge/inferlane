import { NextRequest, NextResponse } from 'next/server';

type RouteHandler = (req: NextRequest, ctx?: any) => Promise<NextResponse | Response> | NextResponse | Response;

export function withTiming(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const start = performance.now();
    const response = await handler(req, ctx);
    const duration = performance.now() - start;

    // Add Server-Timing header (visible in browser DevTools Network tab)
    response.headers.set('Server-Timing', `total;dur=${duration.toFixed(1)}`);

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`[Slow API] ${req.method} ${req.nextUrl.pathname} took ${duration.toFixed(0)}ms`);
    }

    return response;
  };
}
