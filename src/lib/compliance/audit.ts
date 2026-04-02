// ---------------------------------------------------------------------------
// Compliance Audit Trail
// ---------------------------------------------------------------------------
// Appends JSONL entries to ~/.inferlane/compliance-audit.jsonl
// Each entry records a sanctions screening result for regulatory compliance.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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
// Audit directory + file path
// ---------------------------------------------------------------------------

const AUDIT_DIR = join(homedir(), '.inferlane');
const AUDIT_FILE = join(AUDIT_DIR, 'compliance-audit.jsonl');

function ensureAuditDir(): void {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Write audit entry
// ---------------------------------------------------------------------------

/**
 * Append a compliance audit entry as a JSONL line.
 * Non-blocking best-effort — never throws.
 */
export function logComplianceAudit(entry: ComplianceAuditEntry): void {
  try {
    ensureAuditDir();
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(AUDIT_FILE, line, { encoding: 'utf-8' });
  } catch (err) {
    // Audit logging must never break the request flow
    console.error('[compliance-audit] Failed to write audit entry:', err);
  }
}
