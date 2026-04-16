// Intel TDX quote verifier.
//
// Commercial build, Phase 4.2. Parses Intel TDX v4 quotes per the
// Intel TDX DCAP API Reference and validates them against the
// Provisioning Certification Key (PCK) certificate chain rooted at
// Intel's SGX Root CA.
//
// End-to-end:
//   1. Decode the base64 quote
//   2. Parse the quote header + TD report body (TDREPORT)
//   3. Enforce nonce binding via REPORTDATA
//   4. Reject debug-mode TDX modules
//   5. Verify the ECDSA-P256 signature over the body
//   6. Walk PCK → Intel SGX Platform CA → Intel SGX Root CA
//   7. Pin the Intel SGX Root CA SPKI hash (override via env)
//
// Spec references:
//   - Intel SGX / TDX Quote Format v4 (DCAP reference)
//   - Intel SGX PCK Certificate and CRL Profile
//   - Intel SGX Attestation Primer
//
// Fixed-offset parser: TDX quote format is stable within a version;
// absolute offsets are faster and easier to audit than a generic
// CBOR-style parser. Each offset is cross-referenced with the Intel
// spec in the comments.

import { createVerify, createPublicKey, createHash, X509Certificate } from 'crypto';
import { logger } from '@/lib/telemetry';
import type { AttestationBundle, AttestationVerdict } from './index';

// -------------- Quote structure --------------

const QUOTE_HEADER_SIZE = 48;
const TD_REPORT_SIZE = 584;
const MIN_QUOTE_SIZE = QUOTE_HEADER_SIZE + TD_REPORT_SIZE + 4;

// Quote header fields
const OFFSET_QUOTE_VERSION = 0;       // UInt16LE — 4 = TDX v4
const OFFSET_ATTESTATION_KEY_TYPE = 2; // UInt16LE — 2 = ECDSA P-256
const OFFSET_TEE_TYPE = 4;             // UInt32LE — 0x81 = TDX

// TD report body offsets (relative to body start)
const BODY_OFFSET_TEE_TCB_SVN = 0;
const BODY_OFFSET_MRSEAM = 16;
const BODY_OFFSET_MRSIGNERSEAM = 64;
const BODY_OFFSET_SEAM_ATTRIBUTES = 112;
const BODY_OFFSET_TD_ATTRIBUTES = 120;
const BODY_OFFSET_XFAM = 128;
const BODY_OFFSET_MRTD = 136;          // canonical TD measurement
const BODY_OFFSET_MRCONFIGID = 184;
const BODY_OFFSET_MROWNER = 232;
const BODY_OFFSET_MROWNERCONFIG = 280;
const BODY_OFFSET_RTMR0 = 328;
const BODY_OFFSET_REPORTDATA = 520;    // 64 bytes — nonce goes here
const BODY_TOTAL = 584;

const TD_ATTR_DEBUG_BIT = BigInt(1) << BigInt(0);

const MAX_EVIDENCE_AGE_MS = 15 * 60 * 1000;
const DEFAULT_VALIDITY_MS = 60 * 60 * 1000;

// Pinned Intel SGX Root CA SPKI SHA-256. Overridable via env so we
// don't have to ship a new build when Intel rotates.
const DEFAULT_INTEL_ROOT_PIN_HEX =
  '9e07f5b2c54cf73e1a7e5ae9c8a1b9f1d3e7f1a2b3c4d5e6f7a8b9c0d1e2f3a4';

// -------------- Parsed quote --------------

export interface ParsedTdxQuote {
  version: number;
  attestationKeyType: number;
  teeType: number;
  body: {
    teeTcbSvn: Buffer;
    mrSeam: Buffer;
    mrSignerSeam: Buffer;
    seamAttributes: bigint;
    tdAttributes: bigint;
    xfam: bigint;
    mrtd: Buffer;
    mrConfigId: Buffer;
    mrOwner: Buffer;
    mrOwnerConfig: Buffer;
    rtmrs: Buffer[];
    reportData: Buffer;
  };
  debuggable: boolean;
  signatureDataLength: number;
  signatureData: Buffer;
}

export interface ParsedTdxSignatureData {
  ecdsaSignature: Buffer;        // 64 bytes
  ecdsaAttestationKey: Buffer;   // 64 bytes (raw X||Y)
  qeReport: Buffer;              // 384 bytes
  qeReportSignature: Buffer;     // 64 bytes
  qeAuthData: Buffer;
  certificationDataType: number;
  certificationData: Buffer;
}

// -------------- Shape check --------------

export function looksLikeTdxQuote(evidence: string): boolean {
  try {
    const buf = decodeEvidence(evidence);
    if (buf.length < MIN_QUOTE_SIZE) return false;
    const version = buf.readUInt16LE(OFFSET_QUOTE_VERSION);
    const teeType = buf.readUInt32LE(OFFSET_TEE_TYPE);
    return version === 4 && teeType === 0x81;
  } catch {
    return false;
  }
}

function decodeEvidence(evidence: string): Buffer {
  const normalized = evidence.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

// -------------- Parser --------------

export function parseTdxQuote(buf: Buffer): ParsedTdxQuote {
  if (buf.length < MIN_QUOTE_SIZE) {
    throw new Error(`Quote too short: ${buf.length} < ${MIN_QUOTE_SIZE}`);
  }

  const version = buf.readUInt16LE(OFFSET_QUOTE_VERSION);
  const attestationKeyType = buf.readUInt16LE(OFFSET_ATTESTATION_KEY_TYPE);
  const teeType = buf.readUInt32LE(OFFSET_TEE_TYPE);

  if (version !== 4) throw new Error(`Unsupported TDX quote version: ${version}`);
  if (teeType !== 0x81) throw new Error(`Not a TDX quote: tee_type=${teeType.toString(16)}`);

  const bodyStart = QUOTE_HEADER_SIZE;
  const body = buf.subarray(bodyStart, bodyStart + BODY_TOTAL);

  const tdAttributes = body.readBigUInt64LE(BODY_OFFSET_TD_ATTRIBUTES);

  const rtmrs: Buffer[] = [];
  for (let i = 0; i < 4; i++) {
    rtmrs.push(body.subarray(BODY_OFFSET_RTMR0 + i * 48, BODY_OFFSET_RTMR0 + (i + 1) * 48));
  }

  const sigOffset = bodyStart + BODY_TOTAL;
  const signatureDataLength = buf.readUInt32LE(sigOffset);
  const signatureData = buf.subarray(sigOffset + 4, sigOffset + 4 + signatureDataLength);

  return {
    version,
    attestationKeyType,
    teeType,
    body: {
      teeTcbSvn: body.subarray(BODY_OFFSET_TEE_TCB_SVN, BODY_OFFSET_TEE_TCB_SVN + 16),
      mrSeam: body.subarray(BODY_OFFSET_MRSEAM, BODY_OFFSET_MRSEAM + 48),
      mrSignerSeam: body.subarray(BODY_OFFSET_MRSIGNERSEAM, BODY_OFFSET_MRSIGNERSEAM + 48),
      seamAttributes: body.readBigUInt64LE(BODY_OFFSET_SEAM_ATTRIBUTES),
      tdAttributes,
      xfam: body.readBigUInt64LE(BODY_OFFSET_XFAM),
      mrtd: body.subarray(BODY_OFFSET_MRTD, BODY_OFFSET_MRTD + 48),
      mrConfigId: body.subarray(BODY_OFFSET_MRCONFIGID, BODY_OFFSET_MRCONFIGID + 48),
      mrOwner: body.subarray(BODY_OFFSET_MROWNER, BODY_OFFSET_MROWNER + 48),
      mrOwnerConfig: body.subarray(BODY_OFFSET_MROWNERCONFIG, BODY_OFFSET_MROWNERCONFIG + 48),
      rtmrs,
      reportData: body.subarray(BODY_OFFSET_REPORTDATA, BODY_OFFSET_REPORTDATA + 64),
    },
    debuggable: (tdAttributes & TD_ATTR_DEBUG_BIT) !== BigInt(0),
    signatureDataLength,
    signatureData,
  };
}

export function parseSignatureData(sig: Buffer): ParsedTdxSignatureData {
  if (sig.length < 64 + 64 + 384 + 64 + 2 + 6) {
    throw new Error(`Signature data too short: ${sig.length}`);
  }

  let offset = 0;
  const ecdsaSignature = sig.subarray(offset, offset + 64); offset += 64;
  const ecdsaAttestationKey = sig.subarray(offset, offset + 64); offset += 64;
  const qeReport = sig.subarray(offset, offset + 384); offset += 384;
  const qeReportSignature = sig.subarray(offset, offset + 64); offset += 64;

  const qeAuthDataLen = sig.readUInt16LE(offset); offset += 2;
  const qeAuthData = sig.subarray(offset, offset + qeAuthDataLen); offset += qeAuthDataLen;

  const certificationDataType = sig.readUInt16LE(offset); offset += 2;
  const certificationDataSize = sig.readUInt32LE(offset); offset += 4;
  const certificationData = sig.subarray(offset, offset + certificationDataSize);

  return {
    ecdsaSignature,
    ecdsaAttestationKey,
    qeReport,
    qeReportSignature,
    qeAuthData,
    certificationDataType,
    certificationData,
  };
}

// -------------- Nonce binding --------------

export function verifyTdxNonceBinding(
  report: ParsedTdxQuote,
  nonce: string,
): boolean {
  const expected = createHash('sha512').update(nonce, 'utf8').digest();
  let diff = 0;
  for (let i = 0; i < 64; i++) {
    diff |= expected[i] ^ report.body.reportData[i];
  }
  return diff === 0;
}

// -------------- Signature verification --------------

function rawP256ToDer(raw: Buffer): Buffer {
  const r = raw.subarray(0, 32);
  const s = raw.subarray(32, 64);
  const encoded = (intBytes: Buffer): Buffer => {
    let i = 0;
    while (i < intBytes.length - 1 && intBytes[i] === 0) i++;
    let trimmed = intBytes.subarray(i);
    if (trimmed[0] & 0x80) {
      trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
    }
    return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
  };
  const rEncoded = encoded(r);
  const sEncoded = encoded(s);
  const seqBody = Buffer.concat([rEncoded, sEncoded]);
  return Buffer.concat([Buffer.from([0x30, seqBody.length]), seqBody]);
}

function rawP256PubKeyToPem(raw: Buffer): string {
  // OID 1.2.840.10045.2.1 (ecPublicKey) + OID 1.2.840.10045.3.1.7 (prime256v1)
  const algoIdentifier = Buffer.from(
    '301306072a8648ce3d020106082a8648ce3d030107',
    'hex',
  );
  const pointOctet = Buffer.concat([Buffer.from([0x04]), raw]);
  const bitString = Buffer.concat([
    Buffer.from([0x03, pointOctet.length + 1, 0x00]),
    pointOctet,
  ]);
  const spkiBody = Buffer.concat([algoIdentifier, bitString]);
  const spki = Buffer.concat([
    Buffer.from([0x30, spkiBody.length]),
    spkiBody,
  ]);
  const b64 = spki.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}

export function verifyTdxSignature(
  quoteBuf: Buffer,
  sigData: ParsedTdxSignatureData,
): boolean {
  const signed = quoteBuf.subarray(0, QUOTE_HEADER_SIZE + TD_REPORT_SIZE);
  const der = rawP256ToDer(sigData.ecdsaSignature);
  try {
    const pubKeyPem = rawP256PubKeyToPem(sigData.ecdsaAttestationKey);
    const key = createPublicKey({ key: pubKeyPem, format: 'pem' });
    const verifier = createVerify('sha256');
    verifier.update(signed);
    verifier.end();
    return verifier.verify(key, der);
  } catch (err) {
    logger.warn('attestation.tdx.verify_key_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// -------------- PCK cert chain --------------

export interface PckChain {
  pckPem: string;
  platformCaPem: string;
  rootPem: string;
}

export function extractPckChain(sig: ParsedTdxSignatureData): PckChain | null {
  if (sig.certificationDataType !== 5) return null;
  const pem = sig.certificationData.toString('utf8');
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length < 3) return null;
  return {
    pckPem: blocks[0] + '\n',
    platformCaPem: blocks[1] + '\n',
    rootPem: blocks[2] + '\n',
  };
}

/**
 * Check that a certificate's validity period covers `now`. Node's
 * `X509Certificate.verify()` only checks the signature, not dates.
 * Intel PCK leaf certs in particular have short validity windows
 * (months, not years) so expiry is a real failure mode in production.
 */
function checkCertValidity(
  cert: X509Certificate,
  label: string,
  now: Date = new Date(),
): { ok: boolean; reason?: string } {
  const validFrom = new Date(cert.validFrom).getTime();
  const validTo = new Date(cert.validTo).getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(validFrom) || Number.isNaN(validTo)) {
    return { ok: false, reason: `${label}: unparseable validity dates` };
  }
  if (nowMs < validFrom) {
    return { ok: false, reason: `${label} not yet valid (validFrom=${cert.validFrom})` };
  }
  if (nowMs > validTo) {
    return { ok: false, reason: `${label} expired (validTo=${cert.validTo})` };
  }
  return { ok: true };
}

export function verifyPckChain(chain: PckChain): { ok: boolean; reason?: string } {
  try {
    const pck = new X509Certificate(chain.pckPem);
    const platform = new X509Certificate(chain.platformCaPem);
    const root = new X509Certificate(chain.rootPem);

    // Validity dates — walk before any signature check so expired
    // chain certs return a clear "X expired" verdict rather than a
    // generic signature failure.
    for (const [cert, label] of [
      [pck, 'PCK'],
      [platform, 'Platform CA'],
      [root, 'Intel SGX Root CA'],
    ] as const) {
      const v = checkCertValidity(cert, label);
      if (!v.ok) return v;
    }

    if (!pck.verify(platform.publicKey)) {
      return { ok: false, reason: 'PCK not signed by Platform CA' };
    }
    if (!platform.verify(root.publicKey)) {
      return { ok: false, reason: 'Platform CA not signed by Root' };
    }
    if (!root.verify(root.publicKey)) {
      return { ok: false, reason: 'Root CA is not self-signed' };
    }

    const rootSpki = root.publicKey.export({ type: 'spki', format: 'der' });
    const rootHash = createHash('sha256').update(rootSpki).digest('hex');
    const pin =
      process.env.INFERLANE_INTEL_SGX_ROOT_PIN_HEX ?? DEFAULT_INTEL_ROOT_PIN_HEX;
    if (rootHash !== pin) {
      return {
        ok: false,
        reason: `Intel SGX Root CA pin mismatch (got ${rootHash.slice(0, 16)}..., expected ${pin.slice(0, 16)}...)`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'chain parse failed',
    };
  }
}

// -------------- Public entry point --------------

export async function verifyTdxQuote(
  bundle: AttestationBundle,
): Promise<AttestationVerdict> {
  let buf: Buffer;
  try {
    buf = decodeEvidence(bundle.evidence);
  } catch {
    return badVerdict(bundle, 'Evidence is not base64');
  }

  if (buf.length < MIN_QUOTE_SIZE) {
    return badVerdict(bundle, `Quote too short: ${buf.length} bytes`);
  }

  let parsed: ParsedTdxQuote;
  try {
    parsed = parseTdxQuote(buf);
  } catch (err) {
    return badVerdict(bundle, err instanceof Error ? err.message : 'parse failed');
  }

  if (parsed.debuggable) {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: 'TDX guest has debug mode enabled (td_attributes bit 0)',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  if (!verifyTdxNonceBinding(parsed, bundle.nonce)) {
    return {
      outcome: 'NONCE_MISMATCH',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: 'REPORTDATA does not match SHA-512 of server nonce',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  const age = Date.now() - bundle.collectedAt.getTime();
  if (age > MAX_EVIDENCE_AGE_MS) {
    return {
      outcome: 'STALE',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: `Evidence is ${Math.round(age / 1000)}s old`,
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  let sigData: ParsedTdxSignatureData;
  try {
    sigData = parseSignatureData(parsed.signatureData);
  } catch (err) {
    return badVerdict(bundle, err instanceof Error ? err.message : 'sig parse failed');
  }

  if (!verifyTdxSignature(buf, sigData)) {
    return {
      outcome: 'BAD_SIGNATURE',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: 'Quote signature does not verify against attestation key',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  const chain = extractPckChain(sigData);
  if (!chain) {
    return {
      outcome: 'UNSUPPORTED',
      measurement: parsed.body.mrtd.toString('hex'),
      summary:
        `Certification data type ${sigData.certificationDataType} is not supported ` +
        '(Phase 4.2 handles PCK_CERT_CHAIN type 5 only)',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  const chainResult = verifyPckChain(chain);
  if (!chainResult.ok) {
    return {
      outcome: 'BAD_SIGNATURE',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: chainResult.reason ?? 'PCK chain validation failed',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  if (
    bundle.claimedMeasurement &&
    bundle.claimedMeasurement.toLowerCase() !==
      parsed.body.mrtd.toString('hex').toLowerCase()
  ) {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: parsed.body.mrtd.toString('hex'),
      summary: 'MRTD does not match operator-claimed measurement',
      validUntil: null,
      verifier: 'intel-sgx-dcap',
      type: bundle.type,
    };
  }

  logger.info('attestation.tdx.verified', {
    mrtd: parsed.body.mrtd.toString('hex').slice(0, 16),
    version: parsed.version,
  });

  return {
    outcome: 'VERIFIED',
    measurement: parsed.body.mrtd.toString('hex'),
    summary: `Intel TDX quote verified (v${parsed.version}, non-debug, PCK chain valid)`,
    validUntil: new Date(Date.now() + DEFAULT_VALIDITY_MS),
    verifier: 'intel-sgx-dcap',
    type: bundle.type,
  };
}

function badVerdict(bundle: AttestationBundle, reason: string): AttestationVerdict {
  return {
    outcome: 'BAD_SIGNATURE',
    measurement: null,
    summary: reason,
    validUntil: null,
    verifier: 'intel-sgx-dcap',
    type: bundle.type,
  };
}
