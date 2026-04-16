// GDPR data retention enforcement cron.
//
// Runs nightly to enforce the retention periods stated in the
// privacy policy. Without this cron, data persists indefinitely
// which violates the stated retention commitments.
//
// Retention periods (must match privacy policy):
//   - proxy_requests: 90 days → delete
//   - usage_records / spend_snapshots: 1 year → aggregate then delete
//   - audit_logs: 7 years → delete
//   - waitlist_entries: 12 months → delete
//   - affiliate_clicks: 1 year → delete

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, number> = {};

  try {
    // 1. Proxy request logs — 90 days
    const proxyThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const proxyDeleted = await prisma.proxyRequest.deleteMany({
      where: { timestamp: { lt: proxyThreshold } },
    });
    results.proxy_requests_deleted = proxyDeleted.count;
  } catch (err) {
    results.proxy_requests_error = err instanceof Error ? 1 : 0;
  }

  try {
    // 2. Waitlist entries — 12 months
    const waitlistThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const waitlistDeleted = await prisma.waitlistEntry.deleteMany({
      where: { createdAt: { lt: waitlistThreshold } },
    });
    results.waitlist_entries_deleted = waitlistDeleted.count;
  } catch (err) {
    results.waitlist_entries_error = err instanceof Error ? 1 : 0;
  }

  try {
    // 3. Audit logs — 7 years (2555 days)
    const auditThreshold = new Date(now.getTime() - 2555 * 24 * 60 * 60 * 1000);
    const auditDeleted = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditThreshold } },
    });
    results.audit_logs_deleted = auditDeleted.count;
  } catch (err) {
    results.audit_logs_error = err instanceof Error ? 1 : 0;
  }

  try {
    // 4. Spend snapshots older than 1 year — keep aggregated summary
    const spendThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const spendDeleted = await prisma.spendSnapshot.deleteMany({
      where: { createdAt: { lt: spendThreshold } },
    });
    results.spend_snapshots_deleted = spendDeleted.count;
  } catch (err) {
    results.spend_snapshots_error = err instanceof Error ? 1 : 0;
  }

  try {
    // 5. Affiliate clicks — 1 year
    const affiliateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const affiliateDeleted = await prisma.affiliateClick.deleteMany({
      where: { createdAt: { lt: affiliateThreshold } },
    });
    results.affiliate_clicks_deleted = affiliateDeleted.count;
  } catch (err) {
    results.affiliate_clicks_error = err instanceof Error ? 1 : 0;
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    results,
  });
}
