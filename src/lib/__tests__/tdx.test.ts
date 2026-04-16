// Unit tests for the Intel TDX quote parser.
//
// Full signature + PCK chain verification would require a real
// Intel-signed quote fixture. These tests exercise the parser,
// shape-check, nonce binding, and signature-data parser against
// synthetic buffers matching the spec byte layout.

import { describe, it, expect } from 'vitest';
import {
  looksLikeTdxQuote,
  parseTdxQuote,
  parseSignatureData,
  verifyTdxNonceBinding,
} from '@/lib/attestation/tdx';
import { createHash } from 'crypto';

const QUOTE_HEADER_SIZE = 48;
const TD_REPORT_SIZE = 584;
const MIN_QUOTE_SIZE = QUOTE_HEADER_SIZE + TD_REPORT_SIZE + 4;

function makeQuoteBuffer(overrides?: {
  version?: number;
  teeType?: number;
  tdAttributes?: bigint;
  reportData?: Buffer;
  mrtd?: Buffer;
  signatureDataLength?: number;
}): Buffer {
  const sigLen = overrides?.signatureDataLength ?? 0;
  const buf = Buffer.alloc(MIN_QUOTE_SIZE + sigLen);

  buf.writeUInt16LE(overrides?.version ?? 4, 0);        // quote version
  buf.writeUInt16LE(2, 2);                               // attestation key type
  buf.writeUInt32LE(overrides?.teeType ?? 0x81, 4);      // tee type
  // remaining 40 bytes of header stay zero

  // TD report body starts at offset 48
  if (overrides?.mrtd) {
    overrides.mrtd.copy(buf, QUOTE_HEADER_SIZE + 136);
  } else {
    buf.write('cafebabe'.repeat(12), QUOTE_HEADER_SIZE + 136, 'hex');
  }
  // td_attributes at body offset 120
  buf.writeBigUInt64LE(
    overrides?.tdAttributes ?? BigInt(0),
    QUOTE_HEADER_SIZE + 120,
  );
  if (overrides?.reportData) {
    overrides.reportData.copy(buf, QUOTE_HEADER_SIZE + 520);
  }

  // signature_data length at offset 48 + 584 = 632
  buf.writeUInt32LE(sigLen, QUOTE_HEADER_SIZE + TD_REPORT_SIZE);

  return buf;
}

describe('tdx: looksLikeTdxQuote', () => {
  it('accepts a buffer with version 4 and tee_type 0x81', () => {
    const buf = makeQuoteBuffer();
    expect(looksLikeTdxQuote(buf.toString('base64'))).toBe(true);
  });

  it('rejects an SGX quote (tee_type 0)', () => {
    const buf = makeQuoteBuffer({ teeType: 0 });
    expect(looksLikeTdxQuote(buf.toString('base64'))).toBe(false);
  });

  it('rejects version 3', () => {
    const buf = makeQuoteBuffer({ version: 3 });
    expect(looksLikeTdxQuote(buf.toString('base64'))).toBe(false);
  });

  it('rejects too-small buffers', () => {
    expect(looksLikeTdxQuote(Buffer.alloc(40).toString('base64'))).toBe(false);
  });
});

describe('tdx: parseTdxQuote', () => {
  it('parses the header and body', () => {
    const parsed = parseTdxQuote(makeQuoteBuffer());
    expect(parsed.version).toBe(4);
    expect(parsed.teeType).toBe(0x81);
    expect(parsed.body.mrtd.length).toBe(48);
    expect(parsed.body.reportData.length).toBe(64);
  });

  it('flags debug mode when td_attributes bit 0 is set', () => {
    const parsed = parseTdxQuote(
      makeQuoteBuffer({ tdAttributes: BigInt(1) }),
    );
    expect(parsed.debuggable).toBe(true);
  });

  it('non-debug when td_attributes bit 0 is clear', () => {
    const parsed = parseTdxQuote(
      makeQuoteBuffer({ tdAttributes: BigInt(2) }),
    );
    expect(parsed.debuggable).toBe(false);
  });

  it('rejects version != 4', () => {
    expect(() => parseTdxQuote(makeQuoteBuffer({ version: 5 }))).toThrow(
      /Unsupported TDX quote version/,
    );
  });
});

describe('tdx: verifyTdxNonceBinding', () => {
  it('accepts a quote with REPORTDATA = SHA-512(nonce)', () => {
    const nonce = 'tdx-test-nonce-xyz';
    const digest = createHash('sha512').update(nonce, 'utf8').digest();
    const parsed = parseTdxQuote(makeQuoteBuffer({ reportData: digest }));
    expect(verifyTdxNonceBinding(parsed, nonce)).toBe(true);
  });

  it('rejects a quote with mismatched REPORTDATA', () => {
    const digest = createHash('sha512').update('other', 'utf8').digest();
    const parsed = parseTdxQuote(makeQuoteBuffer({ reportData: digest }));
    expect(verifyTdxNonceBinding(parsed, 'expected')).toBe(false);
  });
});

describe('tdx: parseSignatureData', () => {
  it('parses a minimal signature data blob', () => {
    const sig = Buffer.alloc(64 + 64 + 384 + 64 + 2 + 6);
    // Empty QE auth data at offset 576
    sig.writeUInt16LE(0, 576);
    // certification data type at 578
    sig.writeUInt16LE(5, 578);
    // certification data size at 580
    sig.writeUInt32LE(0, 580);

    const parsed = parseSignatureData(sig);
    expect(parsed.ecdsaSignature.length).toBe(64);
    expect(parsed.ecdsaAttestationKey.length).toBe(64);
    expect(parsed.qeReport.length).toBe(384);
    expect(parsed.qeReportSignature.length).toBe(64);
    expect(parsed.certificationDataType).toBe(5);
  });

  it('rejects a too-short signature blob', () => {
    expect(() => parseSignatureData(Buffer.alloc(100))).toThrow(/too short/);
  });
});
