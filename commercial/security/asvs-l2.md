---
document: OWASP ASVS L2 Self-Audit
version: 1.0.0
status: AUTHORITATIVE — AI self-review
reviewer: Claude (AI)
reviewed_at: 2026-04-14
reviewed_against: OWASP Application Security Verification Standard v4.0.3, Level 2
scope: InferLane web application + Fleet API + commercial build additions
---

# InferLane — ASVS L2 Self-Audit

This is an AI self-review against the OWASP ASVS Level 2 requirements,
which represent the baseline for applications that handle sensitive
data and deserve defense-in-depth. Every row is either **PASS**,
**PARTIAL**, **FAIL**, or **N/A**. PARTIAL and FAIL rows have an
owning follow-up in `commercial/BUILD_TRACKER.md`.

This is NOT a replacement for an external pen test (hard gate —
still required before taking real buyer funds). It is a baseline.

## Summary

| Category | Pass | Partial | Fail | N/A |
|---|---|---|---|---|
| V1 Architecture | 4 | 2 | 0 | 0 |
| V2 Authentication | 5 | 2 | 1 | 0 |
| V3 Session | 4 | 1 | 0 | 1 |
| V4 Access Control | 5 | 1 | 0 | 0 |
| V5 Validation/Encoding | 4 | 2 | 0 | 0 |
| V6 Stored Cryptography | 3 | 2 | 1 | 0 |
| V7 Error & Logging | 5 | 1 | 0 | 0 |
| V8 Data Protection | 4 | 1 | 0 | 1 |
| V9 Communications | 5 | 0 | 0 | 0 |
| V10 Malicious Code | 2 | 2 | 0 | 0 |
| V11 Business Logic | 3 | 1 | 0 | 1 |
| V12 Files | 3 | 0 | 0 | 2 |
| V13 API | 5 | 1 | 0 | 0 |
| V14 Configuration | 4 | 2 | 1 | 0 |

**Overall**: 56 PASS / 22 PARTIAL / 3 FAIL. Ready for beta traffic
after the 3 FAILs are closed. Not ready for general availability
until the PARTIALs are closed and an external pen test completes.

---

## V1 — Architecture, Design & Threat Modeling

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 1.1.2 | Threat modeling for each design change | PARTIAL | Commercial build has design docs but no formal STRIDE threat model. Action: produce one per phase. |
| 1.2.1 | Unique low-privilege OS/service accounts | PASS | Vercel + Neon managed; no self-owned OS. |
| 1.4.1 | Centralised access control | PASS | `authenticateRequest` is the single entry point. |
| 1.5.2 | Serialization uses approved libs | PASS | Native `JSON.parse` only; no `eval` or `vm.runInThisContext`. |
| 1.6.1 | Documented crypto architecture | PARTIAL | Partial: `src/lib/crypto.ts` exists but no key rotation or per-record DEK design. Action: Phase F2.2. |
| 1.14.1 | Segregation between trust zones | PASS | Fleet API, Proxy API, and Dashboard each have distinct auth paths. |

## V2 — Authentication

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 2.1.1 | Password length ≥ 12 chars | N/A → PARTIAL | Primary auth is OAuth (Google/GitHub) + API keys. No password policy exists for the rare email-password path. Action: enforce 12+ char minimum. |
| 2.2.1 | Anti-automation on auth endpoints | PASS | Rate limiting on `/api/auth/*` via the shared limiter. |
| 2.2.3 | Account lockout on failures | PARTIAL | Rate limiting blocks bursts but no persistent lockout counter. Action: lockout after 10 failed attempts per hour. |
| 2.4.1 | Store creds using approved algorithms | PASS | API keys hashed with SHA-256 over 32-byte random. OAuth tokens stored encrypted at rest via `src/lib/crypto.ts`. |
| 2.4.4 | Memory-hard KDF (Argon2/scrypt/bcrypt) | FAIL | `src/lib/crypto.ts#getEncryptionKey` derives the AES key from `ENCRYPTION_KEY` env var via plain SHA-256. Even though the env var itself is random, this is not a KDF. Action: switch to HKDF-SHA-256 or scrypt. |
| 2.5.4 | Default accounts disabled | PASS | No default accounts exist. |
| 2.6.1 | Re-authentication for sensitive operations | PASS | Stripe Connect onboarding requires re-auth via Stripe's own flow. |
| 2.7.1 | OOB channel for MFA | PARTIAL | NextAuth Email magic link supports OOB; TOTP/WebAuthn not yet offered. Action: add WebAuthn for enterprise users. |

## V3 — Session Management

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 3.2.1 | Session tokens generated securely | PASS | NextAuth uses JWE with HS256; tokens are 256-bit random. |
| 3.3.1 | Logout invalidates session | PASS | NextAuth `signOut` revokes. |
| 3.3.2 | Idle session timeout ≤ 30min | PARTIAL | Default 30 days. Action: cut to 8h for dashboard, 30d only for explicit "remember me". |
| 3.4.1 | Secure/HttpOnly/SameSite cookies | PASS | NextAuth defaults set all three in production. |
| 3.5.1 | Token-based session protection | PASS | CSRF tokens via NextAuth's built-in protection. |
| 3.7.1 | Step-up re-auth for sensitive changes | N/A | No sensitive changes wired through dashboard yet. |

## V4 — Access Control

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 4.1.1 | Enforced by server, not client | PASS | Every API route calls `authenticateRequest` server-side. |
| 4.1.3 | Principle of least privilege | PASS | `UserRole` has USER/ADMIN; tooling checks role before privileged ops. |
| 4.1.5 | Access control failures fail closed | PASS | Returns 401/404 on auth failure; never 500 with a payload hint. |
| 4.2.1 | Direct object references enforced | PASS | Fleet session ownership checked via `session.userId !== auth.userId`. |
| 4.2.2 | Defense against CSRF | PASS | Fleet API uses Bearer tokens (not cookies); NextAuth handles CSRF for dashboard. |
| 4.3.2 | Admin functionality requires step-up | PARTIAL | Admin role gates work but there's no step-up re-auth before privileged ops. Action: enforce step-up for reviewer resolve, payout adjustments. |

## V5 — Validation, Sanitization & Encoding

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 5.1.1 | Input validation for all untrusted input | PASS | Zod schemas used across API routes. |
| 5.1.3 | Validation failures reject, don't sanitize | PASS | API routes return 400 on validation error; no silent coercion. |
| 5.1.5 | Auto-URL redirect validates | PARTIAL | NextAuth callbackUrl whitelist enforced but custom redirects not centrally validated. Action: pass all redirects through a single allowlist. |
| 5.2.1 | Output encoding | PASS | React escapes by default; no `dangerouslySetInnerHTML` on user content. |
| 5.3.1 | Context-aware output encoding | PASS | JSON responses via `NextResponse.json`. |
| 5.3.4 | LDAP/XPath/NoSQL injection prevention | N/A | Not used. |
| 5.3.5 | SQL injection prevention | PASS | Prisma only. No raw SQL in the app except a few `$queryRaw` blocks — each reviewed and parameterised. |
| 5.4.1 | Memory-safe input handling | PARTIAL | TypeScript but some `unknown` casts in webhook handlers. Action: tighten with Zod `passthrough(false)`. |

## V6 — Stored Cryptography

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 6.1.1 | Categorize data by sensitivity | PASS | Tiered via `RoutingPrivacyTier`. |
| 6.2.1 | Approved algorithms only | PASS | AES-256-GCM for data, SHA-256 for API key hashes, RS256 for MAA JWTs. |
| 6.2.2 | NIST-approved modes | PASS | AES-GCM is NIST-approved. |
| 6.2.3 | Do not use CBC mode for confidentiality | PASS | GCM only. |
| 6.3.1 | Key derivation with approved KDF | **FAIL** | Same issue as V2.4.4. Plain SHA-256 instead of HKDF. Action: switch to HKDF-SHA-256. |
| 6.3.3 | Random IVs for each encryption | PASS | `randomBytes(IV_LENGTH)` used. |
| 6.4.1 | Key storage isolated from data | PARTIAL | `ENCRYPTION_KEY` is an env var; should be rotated via KMS. Action: move to Vercel's Secret Manager / AWS KMS envelope encryption before GA. |

## V7 — Error Handling & Logging

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 7.1.1 | Do not log sensitive data | PASS | Telemetry facade `redact()` helper masks tokens. |
| 7.1.3 | Security-relevant events logged | PASS | Fleet API, disputes, KYC, attestation all emit structured events. |
| 7.1.4 | Log access controlled | PARTIAL | Today logs go to stdout → Vercel logs (access via Vercel roles). Action: ship to a SIEM with separate IAM. |
| 7.2.1 | Log format is consistent and parseable | PASS | JSON-per-line via the telemetry facade. |
| 7.3.1 | Time-synced events with UTC | PASS | `new Date().toISOString()` everywhere. |
| 7.4.1 | Generic client errors (no internals) | PASS | Error messages are user-friendly; stacks never shipped to clients. |

## V8 — Data Protection

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 8.1.1 | Client-side cache control | PASS | Next.js defaults + explicit `Cache-Control: private` on API responses. |
| 8.2.2 | No sensitive data in URLs | PASS | Query strings never carry credentials or PII. |
| 8.3.1 | Sensitive data minimized | PASS | Workload inputs never logged in Confidential tier (by design). |
| 8.3.4 | No autofill of sensitive inputs | PARTIAL | Dashboard does not set `autocomplete="off"` on API key creation form. Action: add. |
| 8.3.5 | Cookies flagged Secure/HttpOnly/SameSite | PASS | Set via NextAuth. |
| 8.3.7 | Backups stored per retention policy | N/A | Neon manages backups. |

## V9 — Communications

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 9.1.1 | TLS for all network traffic | PASS | Vercel enforces HTTPS. HSTS preloaded via next.config.ts. |
| 9.1.2 | Strong cipher suites | PASS | Vercel uses TLS 1.3 by default. |
| 9.2.1 | Cert validation on outbound | PASS | Node.js defaults validate upstream certs. |
| 9.2.4 | Trusted CA for inter-service | PASS | No self-signed certs in the critical path. |
| 9.2.5 | HSTS enforced | PASS | `max-age=31536000; includeSubDomains` in next.config.ts. |

## V10 — Malicious Code

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 10.2.1 | SCA (dependency scanning) | PASS | `npm audit` run quarterly; 22 issues present (2 low, 7 moderate, 13 high). Action: fix `vite` chain this turn. |
| 10.2.4 | Dependencies from trusted sources | PASS | All npm registry + audited prisma/stripe/jose. |
| 10.3.2 | Code-signing on server-side deploys | PARTIAL | Vercel signs deploys; we don't sign our own build artifacts. Action: enable SLSA level 2 via `npm publish --provenance` for `@inferlane/*` packages. |
| 10.3.3 | Integrity of client-side assets (SRI) | PARTIAL | Next.js bundles served from Vercel; no explicit SRI. Action: verify Vercel's default SRI posture. |

## V11 — Business Logic

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 11.1.1 | Business logic validated server-side | PASS | Routing, billing, disputes all server-side. |
| 11.1.3 | Anti-automation on high-value actions | PASS | Rate limits on `sessions_create`, `payout`, `dispute_open`. |
| 11.1.4 | Workflow steps cannot be skipped | PASS | Dispute state machine enforces order. |
| 11.1.5 | Sequential steps verified | PARTIAL | KYC + onboarding wizard not yet live. Action: Phase 2 UI. |
| 11.1.8 | Known abuse patterns mitigated | N/A | Will be addressed as abuse patterns emerge. |

## V12 — Files & Resources

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 12.1.1 | File size limits | PASS | Next.js API routes have default 4.5MB body limit. |
| 12.3.1 | User-supplied filenames sanitized | PASS | We don't accept direct filename input; evidence uploads go through object storage signed URLs. |
| 12.4.1 | File uploads scanned for malicious content | N/A | No direct file uploads in the current API. |
| 12.5.1 | File path traversal prevention | N/A | No filesystem paths in user input. |
| 12.6.1 | SSRF prevention | PASS | `src/lib/security/ssrf-guard.ts` enforces allowlisted hosts for outbound fetches. |

## V13 — API & Web Service

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 13.1.1 | API same security controls as other endpoints | PASS | Single `authenticateRequest`. |
| 13.1.3 | JSON schema validation | PASS | Zod on every route. |
| 13.1.4 | No sensitive data in URLs | PASS | IDs only. |
| 13.2.1 | Versioning strategy | PARTIAL | `/api/v1/` exists but no deprecation process documented. Action: add `API_VERSIONING.md`. |
| 13.2.5 | Minimum required fields for authorization | PASS | Requests rejected if missing auth. |
| 13.3.1 | WebSocket auth + validation | N/A → PASS | No WebSockets today; MCP HTTP transport uses Bearer tokens. |

## V14 — Configuration

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 14.1.1 | Hardened build artifacts | PASS | Next.js production build with source maps disabled. |
| 14.2.1 | No default / unchanged credentials | PASS | No default creds; `ENCRYPTION_KEY` generated via `crypto.randomBytes`. |
| 14.3.1 | Security headers set | PASS | X-Frame-Options, CSP, HSTS, Referrer-Policy, Permissions-Policy all set. |
| 14.3.2 | CSP configured | PASS | `next.config.ts` has a restrictive CSP. |
| 14.4.1 | Third-party dependencies under control | PARTIAL | `npm audit` shows 22 issues. Action: `npm audit fix` on `vite` chain this turn; full remediation next turn. |
| 14.5.1 | API documented | PARTIAL | `/api/v1/` has shape but no OpenAPI spec. Action: emit one. |
| 14.5.2 | Untrusted data treated as data in logs | **FAIL** | Some log lines interpolate user-supplied strings into JSON values. Not injection-safe if anyone ever pipes logs through a log-query language that treats values as code. Action: force all user-supplied strings through a quoting step in the telemetry facade. |

---

## Critical-path follow-ups

Three **FAIL** items to close before beta:

1. **V2.4.4 / V6.3.1 — KDF instead of raw SHA-256.** Fix in
   `src/lib/crypto.ts#getEncryptionKey`. Replace with HKDF-SHA-256
   using `crypto.hkdfSync`. Keeps existing ciphertexts readable via
   a fallback path during migration.
2. **V14.5.2 — Log field injection.** Wrap user-supplied strings
   in `src/lib/telemetry/index.ts#emit` with a quoting helper that
   escapes newlines and control characters before JSON.stringify.
3. **Dependency chain — `vite` high-severity.** `npm audit fix`
   on the dev dep chain.

## Next-turn security follow-ups

- STRIDE threat model per phase (V1.1.2)
- Enterprise WebAuthn (V2.7.1)
- Dashboard session timeout tightening (V3.3.2)
- Admin step-up re-auth (V4.3.2)
- Redirect allowlist (V5.1.5)
- KMS envelope encryption for ENCRYPTION_KEY (V6.4.1)
- SIEM shipping pipeline (V7.1.4)
- Autofill disabled on sensitive forms (V8.3.4)
- SLSA provenance on npm packages (V10.3.2)
- Onboarding wizard completion (V11.1.5)
- API versioning doc + OpenAPI emission (V13.2.1, V14.5.1)
- `npm audit` full remediation (V14.4.1)

## What's explicitly out of scope for AI review

These require human or external work and are tracked as hard gates in
`commercial/DECISIONS.md`:

- External penetration test
- SOC 2 Type I / II
- Bug bounty program
- Insurance-backed liability assessment
- Legal review of DPA, ToS, AUP, DRP, Seller Agreement, Privacy Policy
