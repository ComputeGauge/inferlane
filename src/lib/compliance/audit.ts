// ---------------------------------------------------------------------------
// Compliance Audit Trail
// ---------------------------------------------------------------------------
// Writes JSONL entries to one of two backends depending on runtime:
//   - Edge runtime (Vercel middleware, edge routes): structured console.log,
//     captured by Vercel's log pipeline (and any log drain you configure).
//   - Node runtime (serverless functions, local dev): appends to
//     ~/.inferlane/compliance-audit.jsonl for operator inspection.
//
// This module MUST NOT statically import `fs`, `os`, or `path` because
// `src/middleware.ts` pulls it in via `complianceCheck`, and Next.js
// middleware runs on the Edge runtime where those Node built-ins don't exist.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceAuditEntry {
  timestamp: string;
  userId?: string;
  ipAddress: string;
  countryCode: string;
  action: 'REGISTRATION' | 'PROVIDER_CONNECT' | 'NODE_REGISTER' | 'API_REQUEST';
  result: 'ALLOWED' | 'BLOCKED' | 'ENHANCED_DILIGENCE';
  reason?: string;
}

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Edge runtime (Vercel edge functions, middleware) sets
 * `globalThis.EdgeRuntime` or reports process.env.NEXT_RUNTIME === 'edge'.
 * We use both signals — belt and suspenders.
 */
function isEdgeRuntime(): boolean {
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') return true;
  if (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'edge') return true;
  return false;
}

/**
 * Even on Node, Vercel serverless functions don't have a persistent home
 * directory — writes go to a read-only layer or ephemeral /tmp. Skip the
 * filesystem write in any Vercel environment.
 */
function isVercelRuntime(): boolean {
  return typeof process !== 'undefined' && process.env?.VERCEL === '1';
}

// ---------------------------------------------------------------------------
// Write audit entry
// ---------------------------------------------------------------------------

/**
 * Append a compliance audit entry as JSONL.
 * Non-blocking best-effort — never throws.
 *
 * Edge / serverless: emits a structured console.log line captured by the
 *                    platform's log pipeline.
 * Local Node:        also appends to ~/.inferlane/compliance-audit.jsonl so
 *                    operators can inspect history without log aggregation.
 */
export function logComplianceAudit(entry: ComplianceAuditEntry): void {
  // Always emit the structured log line — this is the canonical trail on
  // serverless platforms and the easy-to-grep output during local dev.
  // The `type` prefix lets log drains filter compliance events out of noise.
  try {
    console.log(JSON.stringify({ type: 'compliance_audit', ...entry }));
  } catch {
    // JSON.stringify should never fail on this shape, but swallow just in case.
  }

  // Only attempt filesystem persistence in a non-edge, non-serverless Node
  // runtime. Vercel's Node runtime technically has fs but no persistent home
  // directory, so we skip it there too.
  if (isEdgeRuntime() || isVercelRuntime()) return;

  // Dynamic require — keeps fs/os/path out of the edge bundle entirely.
  // This path is only reachable in local dev + self-hosted Node deployments.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('node:os') as typeof import('node:os');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');

    const dir = path.join(os.homedir(), '.inferlane');
    const file = path.join(dir, 'compliance-audit.jsonl');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', { encoding: 'utf-8' });
  } catch (err) {
    // Audit logging must never break the request flow.
    console.error('[compliance-audit] Failed to write audit entry:', err);
  }
}
