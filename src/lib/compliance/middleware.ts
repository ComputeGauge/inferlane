// ---------------------------------------------------------------------------
// Compliance Middleware — IP-level sanctions check for Next.js middleware
// ---------------------------------------------------------------------------

import type { NextRequest } from 'next/server';
import { sanctionsScreener } from './sanctions';
import { logComplianceAudit } from './audit';

export interface ComplianceCheckResult {
  allowed: boolean;
  reason?: string;
  highRisk?: boolean;
}

/**
 * Run a lightweight IP-based compliance check suitable for edge middleware.
 * - If blocked (sanctioned/export-controlled) → return { allowed: false }
 * - If high-risk → return { allowed: true, highRisk: true }
 * - Otherwise → return { allowed: true }
 */
export async function complianceCheck(
  req: NextRequest,
  userId?: string,
): Promise<ComplianceCheckResult> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  const result = await sanctionsScreener.checkIP(ip);

  // Log to audit trail
  logComplianceAudit({
    timestamp: new Date().toISOString(),
    userId,
    ipAddress: ip,
    countryCode: result.country || 'UNKNOWN',
    action: 'API_REQUEST',
    result: !result.allowed ? 'BLOCKED' : result.restrictionType === 'HIGH_RISK' ? 'ENHANCED_DILIGENCE' : 'ALLOWED',
    reason: result.reason,
  });

  if (!result.allowed) {
    return { allowed: false, reason: result.reason };
  }

  if (result.restrictionType === 'HIGH_RISK') {
    return { allowed: true, highRisk: true };
  }

  return { allowed: true };
}
