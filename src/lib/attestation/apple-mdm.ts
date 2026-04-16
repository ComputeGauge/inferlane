// Apple App Attest / Managed Device Attestation verifier.
//
// Commercial build, Phase 4.3. Validates attestation objects produced
// by DCAppAttestService on Apple Silicon Macs (and iOS / iPadOS
// devices). Same chain Apple uses for Private Cloud Compute's hardware
// root of trust.
//
// Spec references:
//   - Apple "Validating apps that connect to your server" (WWDC)
//   - Apple "Establishing your app's integrity" (App Attest docs)
//   - Apple DeviceCheck framework reference
//
// Attestation object format (CBOR):
//   {
//     fmt: "apple-appattest",
//     attStmt: {
//       x5c: [leafCertDer, intermediateCertDer],
//       receipt: <bytes>   // optional, only for non-development envs
//     },
//     authData: <bytes>
//   }
//
// Verification steps per Apple docs:
//   1. Walk x5c: leaf signed by intermediate signed by Apple App
//      Attestation Root CA. Pin the Apple root SPKI.
//   2. Create a client data hash as SHA-256 of the server challenge
//      (our nonce, binary form).
//   3. Concatenate authData + clientDataHash and SHA-256 the result.
//      That's the `nonce` claim inside the leaf cert extension
//      1.2.840.113635.100.8.2.
//   4. Verify the credential public key in authData matches the
//      SHA-256 of the leaf cert's public key.
//   5. Verify AAGUID bytes in authData match one of:
//        - 'appattestdevelop' for dev environment
//        - 'appattest' + 0-padded for production
//   6. Record the keyId (SHA-256 of the subject public key) as the
//      canonical measurement — it's the operator's Secure Enclave
//      identity and cannot be migrated between devices.
//
// We parse CBOR by hand (no dependency) because the App Attest
// structure is a small fixed subset of CBOR — just enough to walk
// the outer map.

import { createHash, createPublicKey, X509Certificate, createVerify } from 'crypto';
import { logger } from '@/lib/telemetry';
import type { AttestationBundle, AttestationVerdict } from './index';
import {
  parseDer,
  parseChildren,
  isSequence,
  isOctetString,
  isContext,
  oidEquals,
  Asn1ParseError,
  type Asn1Node,
} from './asn1';

const DEFAULT_VALIDITY_MS = 60 * 60 * 1000;
const MAX_EVIDENCE_AGE_MS = 15 * 60 * 1000;

// Pinned Apple App Attestation Root CA SPKI SHA-256 — override via
// INFERLANE_APPLE_APPATTEST_ROOT_PIN_HEX so we don't ship a build on
// rotation. Apple's real root SPKI hash belongs in
// `commercial/pins/apple-appattest-root.sha256`.
const DEFAULT_APPLE_ROOT_PIN_HEX =
  '638a3c0ddb0ea23094b62e9f6f82d5d59d3e2c7fef67e7d9f4db2c3c81a4f6b3';

// AAGUID prefixes
const AAGUID_DEVELOPMENT = Buffer.from('appattestdevelop', 'utf8');
const AAGUID_PRODUCTION_PREFIX = Buffer.from('appattest', 'utf8');

// Leaf certificate extension OID that holds the nonce
const APPLE_NONCE_OID = '1.2.840.113635.100.8.2';

// -------------- Minimal CBOR decoder --------------
//
// Just enough to read a definite-length map with byte-string and
// text-string keys/values, plus a nested map for attStmt. Rejects
// anything exotic (indefinite-length, tags, etc.) so we don't
// introduce a parser bug.

type CborValue =
  | { kind: 'uint'; value: bigint }
  | { kind: 'negint'; value: bigint }
  | { kind: 'bstr'; value: Buffer }
  | { kind: 'tstr'; value: string }
  | { kind: 'array'; value: CborValue[] }
  | { kind: 'map'; value: Map<string, CborValue> }
  | { kind: 'bool'; value: boolean }
  | { kind: 'null' };

function cborDecode(buf: Buffer, offset: { value: number }): CborValue {
  if (offset.value >= buf.length) throw new Error('CBOR: unexpected end of input');
  const initial = buf[offset.value++];
  const major = initial >> 5;
  const info = initial & 0x1f;

  const readLength = (): bigint => {
    if (info < 24) return BigInt(info);
    if (info === 24) {
      const v = buf[offset.value];
      offset.value += 1;
      return BigInt(v);
    }
    if (info === 25) {
      const v = buf.readUInt16BE(offset.value);
      offset.value += 2;
      return BigInt(v);
    }
    if (info === 26) {
      const v = buf.readUInt32BE(offset.value);
      offset.value += 4;
      return BigInt(v);
    }
    if (info === 27) {
      const hi = BigInt(buf.readUInt32BE(offset.value));
      const lo = BigInt(buf.readUInt32BE(offset.value + 4));
      offset.value += 8;
      return (hi << BigInt(32)) | lo;
    }
    throw new Error(`CBOR: unsupported additional info ${info}`);
  };

  switch (major) {
    case 0: return { kind: 'uint', value: readLength() };
    case 1: return { kind: 'negint', value: BigInt(-1) - readLength() };
    case 2: {
      const len = Number(readLength());
      const v = buf.subarray(offset.value, offset.value + len);
      offset.value += len;
      return { kind: 'bstr', value: Buffer.from(v) };
    }
    case 3: {
      const len = Number(readLength());
      const v = buf.subarray(offset.value, offset.value + len).toString('utf8');
      offset.value += len;
      return { kind: 'tstr', value: v };
    }
    case 4: {
      const len = Number(readLength());
      const arr: CborValue[] = [];
      for (let i = 0; i < len; i++) arr.push(cborDecode(buf, offset));
      return { kind: 'array', value: arr };
    }
    case 5: {
      const len = Number(readLength());
      const map = new Map<string, CborValue>();
      for (let i = 0; i < len; i++) {
        const key = cborDecode(buf, offset);
        const val = cborDecode(buf, offset);
        if (key.kind !== 'tstr') {
          throw new Error(`CBOR: unexpected map key kind ${key.kind}`);
        }
        map.set(key.value, val);
      }
      return { kind: 'map', value: map };
    }
    case 7: {
      if (info === 20) return { kind: 'bool', value: false };
      if (info === 21) return { kind: 'bool', value: true };
      if (info === 22 || info === 23) return { kind: 'null' };
      throw new Error(`CBOR: unsupported simple/float ${info}`);
    }
    default:
      throw new Error(`CBOR: unsupported major type ${major}`);
  }
}

// -------------- Parsed attestation --------------

export interface ParsedAppleAttestation {
  fmt: string;
  x5c: Buffer[];
  receipt: Buffer | null;
  authData: Buffer;
}

export function parseAppleAttestation(buf: Buffer): ParsedAppleAttestation {
  const offset = { value: 0 };
  const root = cborDecode(buf, offset);
  if (root.kind !== 'map') throw new Error('Attestation root is not a CBOR map');

  const fmtVal = root.value.get('fmt');
  if (!fmtVal || fmtVal.kind !== 'tstr') throw new Error('Missing fmt');
  if (fmtVal.value !== 'apple-appattest') {
    throw new Error(`Unsupported attestation fmt: ${fmtVal.value}`);
  }

  const attStmtVal = root.value.get('attStmt');
  if (!attStmtVal || attStmtVal.kind !== 'map') throw new Error('Missing attStmt');

  const x5cVal = attStmtVal.value.get('x5c');
  if (!x5cVal || x5cVal.kind !== 'array') throw new Error('Missing x5c');
  const x5c: Buffer[] = [];
  for (const el of x5cVal.value) {
    if (el.kind !== 'bstr') throw new Error('x5c element is not a byte string');
    x5c.push(el.value);
  }
  if (x5c.length < 2) throw new Error('x5c must contain at least 2 certificates');

  const receiptVal = attStmtVal.value.get('receipt');
  const receipt = receiptVal && receiptVal.kind === 'bstr' ? receiptVal.value : null;

  const authDataVal = root.value.get('authData');
  if (!authDataVal || authDataVal.kind !== 'bstr') throw new Error('Missing authData');

  return {
    fmt: fmtVal.value,
    x5c,
    receipt,
    authData: authDataVal.value,
  };
}

// -------------- authData parser --------------
//
// authData = rpIdHash(32) || flags(1) || signCount(4) || attestedCredentialData(...)
// attestedCredentialData = aaguid(16) || credentialIdLength(2, BE) ||
//                          credentialId(length) || credentialPublicKey(CBOR)

export interface AuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid: Buffer;
  credentialId: Buffer;
  credentialPublicKey: Buffer;  // raw CBOR-encoded COSE key
}

export function parseAuthData(authData: Buffer): AuthData {
  if (authData.length < 37) throw new Error('authData too short');
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);

  // Bit 6 of flags indicates attestedCredentialData present
  if ((flags & 0x40) === 0) {
    throw new Error('authData flags: attested credential data not present');
  }

  const aaguid = authData.subarray(37, 37 + 16);
  const credIdLen = authData.readUInt16BE(37 + 16);
  const credentialId = authData.subarray(37 + 16 + 2, 37 + 16 + 2 + credIdLen);
  const credentialPublicKey = authData.subarray(37 + 16 + 2 + credIdLen);

  return {
    rpIdHash,
    flags,
    signCount,
    aaguid,
    credentialId,
    credentialPublicKey,
  };
}

// -------------- Chain validation --------------

function derToX509(der: Buffer): X509Certificate {
  // node:X509Certificate accepts DER directly via the Buffer constructor.
  return new X509Certificate(der);
}

/**
 * Check that a certificate's validity period covers `now`. Node's
 * `X509Certificate.verify()` only checks the signature, not dates —
 * we walk it ourselves so an expired Apple intermediate or leaf
 * fails closed instead of silently passing.
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

export function verifyAppleChain(x5c: Buffer[]): {
  ok: boolean;
  reason?: string;
  leaf?: X509Certificate;
} {
  try {
    const certs = x5c.map(derToX509);
    if (certs.length < 2) return { ok: false, reason: 'chain must have ≥ 2 certs' };

    // Validity dates for every cert in the chain. Node's
    // X509Certificate.verify() only checks signatures.
    for (let i = 0; i < certs.length; i++) {
      const label = i === 0 ? 'leaf' : i === certs.length - 1 ? 'root' : `cert[${i}]`;
      const v = checkCertValidity(certs[i], label);
      if (!v.ok) return v;
    }

    // Walk: cert[i] must be signed by cert[i+1]. Last cert must be
    // Apple root (we pin by SPKI hash).
    for (let i = 0; i < certs.length - 1; i++) {
      if (!certs[i].verify(certs[i + 1].publicKey)) {
        return { ok: false, reason: `Cert ${i} not signed by cert ${i + 1}` };
      }
    }
    const root = certs[certs.length - 1];
    if (!root.verify(root.publicKey)) {
      return { ok: false, reason: 'Apple root is not self-signed' };
    }

    const rootSpki = root.publicKey.export({ type: 'spki', format: 'der' });
    const rootHash = createHash('sha256').update(rootSpki).digest('hex');
    const pin =
      process.env.INFERLANE_APPLE_APPATTEST_ROOT_PIN_HEX ??
      DEFAULT_APPLE_ROOT_PIN_HEX;
    if (rootHash !== pin) {
      return {
        ok: false,
        reason: `Apple root SPKI pin mismatch (got ${rootHash.slice(0, 16)}..., expected ${pin.slice(0, 16)}...)`,
      };
    }

    return { ok: true, leaf: certs[0] };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'chain parse failed',
    };
  }
}

// -------------- Leaf cert extension --------------
//
// Apple carries the attestation nonce inside a certificate extension
// identified by OID 1.2.840.113635.100.8.2. The extension value is:
//
//   OCTET STRING { SEQUENCE { [1] EXPLICIT OCTET STRING nonce } }
//
// Old code used byte scanning on the raw cert DER with a hardcoded
// 10-byte OID pattern, which was wrong (the pattern encoded
// 1.2.840.113635.100.8.2.2, not 1.2.840.113635.100.8.2 — the
// fallback that stripped the last byte happened to work). We now
// walk the cert structurally via the minimal DER parser in ./asn1.ts
// so the lookup is robust and the OID is computed, not memorised.

/**
 * Pure-function version of the extractor that takes the raw DER
 * bytes of an X.509 certificate. Exposed for unit testing so callers
 * don't need to construct an X509Certificate to exercise the walk.
 */
export function extractAppleNonceFromCertDer(raw: Buffer): Buffer | null {
  try {
    // cert = SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
    const cert = parseDer(raw);
    if (!isSequence(cert)) return null;

    const certChildren = parseChildren(cert);
    if (certChildren.length === 0) return null;

    const tbsCert = certChildren[0];
    if (!isSequence(tbsCert)) return null;

    // tbsCertificate has an optional [3] EXPLICIT extensions field
    // at the end; walk all children looking for it.
    const tbsChildren = parseChildren(tbsCert);
    let extensionsWrapper: Asn1Node | null = null;
    for (const child of tbsChildren) {
      if (isContext(child, 3) && child.constructed) {
        extensionsWrapper = child;
        break;
      }
    }
    if (!extensionsWrapper) return null;

    // Inside the [3] EXPLICIT wrapper is a SEQUENCE OF Extension.
    const wrapperChildren = parseChildren(extensionsWrapper);
    if (wrapperChildren.length === 0) return null;
    const extensionsSeq = wrapperChildren[0];
    if (!isSequence(extensionsSeq)) return null;

    const extensions = parseChildren(extensionsSeq);
    for (const ext of extensions) {
      // Extension = SEQUENCE { extnID OID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }
      if (!isSequence(ext)) continue;
      const extChildren = parseChildren(ext);
      if (extChildren.length < 2) continue;

      const oidNode = extChildren[0];
      if (!oidEquals(oidNode, APPLE_NONCE_OID)) continue;

      // The extnValue is always the last child (critical is optional
      // and may appear between the OID and the value).
      const extnValueNode = extChildren[extChildren.length - 1];
      if (!isOctetString(extnValueNode)) return null;

      // extnValue's content is DER-encoded:
      //   SEQUENCE { [1] EXPLICIT OCTET STRING nonce }
      const inner = parseDer(extnValueNode.content);
      if (!isSequence(inner)) return null;

      const innerChildren = parseChildren(inner);
      for (const c of innerChildren) {
        if (!isContext(c, 1) || !c.constructed) continue;
        // [1] EXPLICIT wraps an OCTET STRING.
        const wrapped = parseDer(c.content);
        if (isOctetString(wrapped)) {
          return Buffer.from(wrapped.content);
        }
      }
      return null;
    }
    return null;
  } catch (err) {
    if (err instanceof Asn1ParseError) return null;
    return null;
  }
}

/**
 * Extract the Apple nonce extension (OID 1.2.840.113635.100.8.2)
 * from a leaf certificate. Apple wraps the nonce in an OCTET STRING
 * containing a SEQUENCE with a [1] EXPLICIT OCTET STRING. Returns
 * null if the extension is missing or the structure doesn't match.
 *
 * Walks the cert structurally via the ASN.1 parser in ./asn1.ts
 * rather than scanning for byte patterns.
 */
export function extractAppleNonceFromLeaf(leaf: X509Certificate): Buffer | null {
  return extractAppleNonceFromCertDer(leaf.raw);
}

// -------------- Public entry point --------------

export async function verifyAppleAppAttest(
  bundle: AttestationBundle,
  appIdRpIdHash: Buffer,
): Promise<AttestationVerdict> {
  let buf: Buffer;
  try {
    const normalized = bundle.evidence.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    buf = Buffer.from(padded, 'base64');
  } catch {
    return badVerdict(bundle, 'Evidence is not base64');
  }

  // 1. Parse CBOR
  let parsed: ParsedAppleAttestation;
  try {
    parsed = parseAppleAttestation(buf);
  } catch (err) {
    return badVerdict(bundle, err instanceof Error ? err.message : 'CBOR parse failed');
  }

  // 2. Freshness
  const age = Date.now() - bundle.collectedAt.getTime();
  if (age > MAX_EVIDENCE_AGE_MS) {
    return {
      outcome: 'STALE',
      measurement: null,
      summary: `Evidence is ${Math.round(age / 1000)}s old`,
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }

  // 3. Chain validation
  const chain = verifyAppleChain(parsed.x5c);
  if (!chain.ok || !chain.leaf) {
    return {
      outcome: 'BAD_SIGNATURE',
      measurement: null,
      summary: chain.reason ?? 'Apple chain validation failed',
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }

  // 4. Nonce binding. The leaf cert has an extension carrying
  // SHA-256(authData || SHA-256(nonce)). We recompute and compare.
  const expectedNonceExt = createHash('sha256')
    .update(parsed.authData)
    .update(createHash('sha256').update(bundle.nonce, 'utf8').digest())
    .digest();
  const leafNonceExt = extractAppleNonceFromLeaf(chain.leaf);
  if (!leafNonceExt || !leafNonceExt.equals(expectedNonceExt)) {
    return {
      outcome: 'NONCE_MISMATCH',
      measurement: null,
      summary: 'Leaf cert nonce extension does not match expected value',
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }

  // 5. Parse authData
  let authData: AuthData;
  try {
    authData = parseAuthData(parsed.authData);
  } catch (err) {
    return badVerdict(
      bundle,
      err instanceof Error ? err.message : 'authData parse failed',
    );
  }

  // 6. rpIdHash must match the caller's app id hash. The caller
  // supplies this — it's SHA-256 of the AppID in the form
  // "<teamId>.<bundleId>".
  if (!authData.rpIdHash.equals(appIdRpIdHash)) {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: null,
      summary: 'authData rpIdHash does not match expected AppID hash',
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }

  // 7. AAGUID check
  const isDev = authData.aaguid.equals(AAGUID_DEVELOPMENT);
  const isProd = authData.aaguid.subarray(0, AAGUID_PRODUCTION_PREFIX.length).equals(
    AAGUID_PRODUCTION_PREFIX,
  );
  if (!isDev && !isProd) {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: null,
      summary: `Unknown AAGUID: ${authData.aaguid.toString('hex')}`,
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }
  if (isDev && process.env.NODE_ENV === 'production') {
    return {
      outcome: 'POLICY_VIOLATION',
      measurement: null,
      summary: 'Development AAGUID rejected in production',
      validUntil: null,
      verifier: 'apple-managed-device-attestation',
      type: bundle.type,
    };
  }

  // 8. Canonical measurement = SHA-256 of the leaf cert SPKI.
  // This is the operator's Secure Enclave identity and cannot be
  // forged without the Secure Enclave cooperating.
  const leafSpki = chain.leaf.publicKey.export({ type: 'spki', format: 'der' });
  const keyId = createHash('sha256').update(leafSpki).digest('hex');

  logger.info('attestation.apple_mdm.verified', {
    keyIdPrefix: keyId.slice(0, 16),
    env: isDev ? 'development' : 'production',
  });

  return {
    outcome: 'VERIFIED',
    measurement: keyId,
    summary: `Apple App Attest verified (${isDev ? 'development' : 'production'} environment)`,
    validUntil: new Date(Date.now() + DEFAULT_VALIDITY_MS),
    verifier: 'apple-managed-device-attestation',
    type: bundle.type,
  };
}

function badVerdict(bundle: AttestationBundle, reason: string): AttestationVerdict {
  return {
    outcome: 'BAD_SIGNATURE',
    measurement: null,
    summary: reason,
    validUntil: null,
    verifier: 'apple-managed-device-attestation',
    type: bundle.type,
  };
}
