import { describe, it, expect } from 'vitest';
import nextConfig from '../../../next.config';

describe('Security Headers', () => {
  it('defines security headers in next.config', async () => {
    expect(nextConfig.headers).toBeDefined();
    const headers = await nextConfig.headers!();
    expect(headers.length).toBeGreaterThan(0);
  });

  it('applies headers to all routes', async () => {
    const headers = await nextConfig.headers!();
    const allRoutes = headers.find(h => h.source === '/(.*)');
    expect(allRoutes).toBeDefined();
  });

  it('includes critical security headers', async () => {
    const headers = await nextConfig.headers!();
    const allRoutes = headers.find(h => h.source === '/(.*)');
    const headerKeys = allRoutes!.headers.map(h => h.key);

    expect(headerKeys).toContain('X-Content-Type-Options');
    expect(headerKeys).toContain('X-Frame-Options');
    expect(headerKeys).toContain('Strict-Transport-Security');
    expect(headerKeys).toContain('Content-Security-Policy');
    expect(headerKeys).toContain('Referrer-Policy');
    expect(headerKeys).toContain('Permissions-Policy');
  });

  it('denies framing (clickjacking protection)', async () => {
    const headers = await nextConfig.headers!();
    const allRoutes = headers.find(h => h.source === '/(.*)');
    const xfo = allRoutes!.headers.find(h => h.key === 'X-Frame-Options');
    expect(xfo!.value).toBe('DENY');
  });

  it('enforces HSTS for 1 year', async () => {
    const headers = await nextConfig.headers!();
    const allRoutes = headers.find(h => h.source === '/(.*)');
    const hsts = allRoutes!.headers.find(h => h.key === 'Strict-Transport-Security');
    expect(hsts!.value).toContain('max-age=31536000');
    expect(hsts!.value).toContain('includeSubDomains');
  });

  it('CSP blocks object embeds', async () => {
    const headers = await nextConfig.headers!();
    const allRoutes = headers.find(h => h.source === '/(.*)');
    const csp = allRoutes!.headers.find(h => h.key === 'Content-Security-Policy');
    expect(csp!.value).toContain("object-src 'none'");
  });
});
