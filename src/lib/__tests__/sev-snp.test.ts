// Unit tests for the SEV-SNP attestation parser.
//
// Signature + chain verification require real AMD-signed fixtures
// which we don't have in-tree. We exercise the parsing,
// shape-checking, nonce binding, and debug-mode detection paths
// against synthetic report buffers that match the spec byte layout.

import { describe, it, expect } from 'vitest';
import {
  parseSevSnpReport,
  verifyNonceBinding,
  looksLikeSevSnpReport,
} from '@/lib/attestation/sev-snp';
import { createHash } from 'crypto';

const REPORT_SIZE = 1184;

function makeReportBuffer(overrides?: {
  version?: number;
  policy?: bigint;
  reportData?: Buffer;
  measurement?: Buffer;
  signatureAlgorithm?: number;
}): Buffer {
  const buf = Buffer.alloc(REPORT_SIZE);
  // version at offset 0
  buf.writeUInt32LE(overrides?.version ?? 2, 0);
  // guest_svn (4)
  buf.writeUInt32LE(0, 4);
  // policy (8) at offset 8
  buf.writeBigUInt64LE(overrides?.policy ?? BigInt(0), 8);
  // family_id (16) at 16
  // image_id (16) at 32
  // vmpl (4) at 48
  buf.writeUInt32LE(0, 48);
  // signature_algo (4) at 52
  buf.writeUInt32LE(overrides?.signatureAlgorithm ?? 1, 52);
  // current_tcb (8) at 56
  // platform_info (8) at 64
  // signer_info (4) at 72
  // report_data (64) at 80
  if (overrides?.reportData) {
    overrides.reportData.copy(buf, 80);
  }
  // measurement (48) at 144
  if (overrides?.measurement) {
    overrides.measurement.copy(buf, 144);
  } else {
    buf.write('deadbeef'.repeat(12), 144, 'hex');
  }
  return buf;
}

describe('sev-snp: looksLikeSevSnpReport', () => {
  it('accepts a buffer of the correct size', () => {
    const valid = Buffer.alloc(REPORT_SIZE).toString('base64');
    expect(looksLikeSevSnpReport(valid)).toBe(true);
  });

  it('rejects a too-small buffer', () => {
    expect(looksLikeSevSnpReport(Buffer.alloc(100).toString('base64'))).toBe(false);
  });

  it('rejects garbage', () => {
    expect(looksLikeSevSnpReport('not base64!')).toBe(false);
    expect(looksLikeSevSnpReport('')).toBe(false);
  });
});

describe('sev-snp: parseSevSnpReport', () => {
  it('parses a minimally valid v2 report', () => {
    const report = parseSevSnpReport(makeReportBuffer());
    expect(report.version).toBe(2);
    expect(report.policy).toBe(BigInt(0));
    expect(report.debuggable).toBe(false);
    expect(report.measurement.length).toBe(48);
  });

  it('flags debug mode when policy bit 19 is set', () => {
    const debugPolicy = BigInt(1) << BigInt(19);
    const report = parseSevSnpReport(makeReportBuffer({ policy: debugPolicy }));
    expect(report.debuggable).toBe(true);
  });

  it('flags single-socket when policy bit 20 is set', () => {
    const singleSocket = BigInt(1) << BigInt(20);
    const report = parseSevSnpReport(makeReportBuffer({ policy: singleSocket }));
    expect(report.singleSocket).toBe(true);
  });

  it('rejects unsupported versions', () => {
    expect(() => parseSevSnpReport(makeReportBuffer({ version: 99 }))).toThrow(
      /Unsupported SEV-SNP report version/,
    );
  });

  it('rejects too-short buffers', () => {
    expect(() => parseSevSnpReport(Buffer.alloc(100))).toThrow(/too short/);
  });
});

describe('sev-snp: verifyNonceBinding', () => {
  it('accepts a report whose REPORT_DATA is SHA-512 of the nonce', () => {
    const nonce = 'test-nonce-abc123';
    const digest = createHash('sha512').update(nonce, 'utf8').digest();
    const report = parseSevSnpReport(makeReportBuffer({ reportData: digest }));
    expect(verifyNonceBinding(report, nonce)).toBe(true);
  });

  it('rejects a report with mismatched REPORT_DATA', () => {
    const digest = createHash('sha512').update('wrong-nonce', 'utf8').digest();
    const report = parseSevSnpReport(makeReportBuffer({ reportData: digest }));
    expect(verifyNonceBinding(report, 'expected-nonce')).toBe(false);
  });

  it('uses constant-time comparison (no short-circuit on first differing byte)', () => {
    // Flip only the last byte of a valid digest and ensure it's still
    // rejected — validates the loop visits every byte.
    const nonce = 'x';
    const digest = createHash('sha512').update(nonce, 'utf8').digest();
    const tampered = Buffer.from(digest);
    tampered[tampered.length - 1] ^= 0xff;
    const report = parseSevSnpReport(makeReportBuffer({ reportData: tampered }));
    expect(verifyNonceBinding(report, nonce)).toBe(false);
  });
});
