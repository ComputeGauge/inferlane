---
document: STRIDE Threat Model — Compute Marketplace Phases
version: 1.0.0
status: AUTHORITATIVE — AI-drafted, hard-gated on external security review
drafted_by: Claude (AI)
drafted_at: 2026-04-15
covers: Phase 1 (hardening), Phase 2 (seller), Phase 3 (buyer), Phase 4 (TEE), Phase 5 (settlement), Phase 6 (reputation)
---

# STRIDE Threat Model — InferLane Compute Marketplace

Each phase has its own threat section. For every threat we note:

- **S** Spoofing identity
- **T** Tampering with data
- **R** Repudiation of action
- **I** Information disclosure
- **D** Denial of service
- **E** Elevation of privilege

Every row captures (threat, asset, mitigation, status, follow-up).
Status is PASS (mitigated), PARTIAL (mitigated under realistic
assumptions; improvement tracked), or OPEN (not yet mitigated).

## Phase 1 — Core infrastructure

### S — Spoofing

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| Stolen API key used by attacker | Public API access | Keys hashed SHA-256 in DB, Bearer-only transport, rotation supported, step-up re-auth for sensitive scopes | PASS |
| NextAuth session replay after logout | Dashboard access | Session JWT revocation + short TTL | PARTIAL — session TTL to be tightened from 30d to 8h (ASVS V3.3.2) |
| Fake cron request to `/api/cron/*` | Cron endpoints | `CRON_SECRET` header + Vercel-only invocation | PASS |
| Impersonation via MCP HTTP transport | MCP bearer | Per-session token, 30min TTL, 127.0.0.1 bind default | PASS |

### T — Tampering

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| Client modifies routing request to bypass quality tier | Proxy request | Server-side validation via Zod, no client-trusted price | PASS |
| Attacker tampers with stored provider API keys | `ProviderConnection.apiKey` | AES-256-GCM with HKDF-derived key + envelope encryption available | PASS |
| Log field injection via user-supplied strings | Observability pipeline | `sanitizeValue()` in telemetry facade strips control chars + caps length | PASS |

### R — Repudiation

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| User denies making an API request | Usage accounting | Every request logged in `ProxyRequest` with userId, apiKeyId, timestamps; append-only AuditLog table | PASS |
| Operator denies accepting a workload | Workload dispatch | Dispatch logs + node heartbeat + attestation records together form a tamper-evident trail | PASS |

### I — Information disclosure

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| PII in logs | Observability pipeline | Telemetry facade `redact()` + sanitized attributes; workload inputs never logged in Confidential tier | PASS |
| Error responses leak stack traces | API responses | `handleApiError` returns generic messages; stacks only in server logs | PASS |
| Cross-tenant data access | Multi-tenant DB | Every query scoped to `auth.userId`; ownership checks on all mutable routes | PASS |
| SSRF via provider base URL | Provider connections | `src/lib/security/ssrf-guard.ts` enforces allowlisted hosts | PASS |

### D — Denial of service

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| Runaway client exhausts Neon connections | Postgres pool | Shared rate limiter (`checkFleetRateLimit`) on all Fleet routes; per-route budgets sized to route workload | PASS |
| Slowloris against the proxy | Next.js / Vercel edge | Vercel edge applies timeouts; no long-polling endpoints exposed | PASS |
| Log flooding | Observability pipeline | Field-length cap (2000 chars) + rate-limit-aware log dedup | PARTIAL — log volume budget not yet enforced |

### E — Elevation of privilege

| Threat | Asset | Mitigation | Status |
|---|---|---|---|
| USER role triggers admin-only action | Admin endpoints | Role check in `authenticateRequest` + per-route role guards | PASS |
| Insecure dependency (e.g. vulnerable `next-auth`) | Whole app | `npm audit fix` ran; 1 high remains (auth.js v5 upgrade planned) | PARTIAL |

## Phase 2 — Seller onboarding

### S

- **Stolen Stripe Connect account** → Stripe handles KYB + 2FA on
  their dashboard; we never hold the account credentials. PASS.
- **Fake operator registration** → KYC via Stripe Identity (liveness
  + ID + selfie match) before first payout. PASS when Phase 2 UI ships.

### T

- **Capability declaration fraud** (operator claims H100, runs on
  CPU) → Runtime measurement via heartbeat latency + attestation
  mandate for Confidential tier. PARTIAL — Capability declaration
  validation is Phase 2.3.

### R

- **Operator denies running a workload** → Signed attestation
  bundle + router logs + heartbeat history together cannot be
  repudiated. PASS for Confidential tier, PARTIAL for Transport tier.

### I

- **Operator leaks buyer data from Transport-tier workload** →
  Contractual prohibition via Operator Agreement; detection via
  honey-token traps in a future phase. OPEN until Phase 6.

### D

- **Operator spams registration endpoint** → Rate limiting on
  `sessions_create` (100/min/key). PASS.

### E

- **Operator escalates to admin via role race** → All role changes
  go through step-up re-auth; no UI path for self-elevation. PASS.

## Phase 3 — Buyer-facing surface

### S

- **Buyer spoofs another buyer's session** → NextAuth session +
  CSRF + CORS. PASS.
- **Stolen wallet balance via SIM-swap** → Step-up re-auth for
  withdrawal, wallet deposit routes idempotent by key. PASS.

### T

- **Tampering with routing decision** → Decision happens server-side
  only; client sees the final decision but cannot alter it. PASS.

### R

- **Buyer disputes a workload and denies receiving output** →
  Signed receipt of delivery + hash-chain logging. PARTIAL — receipt
  signature is Phase 3.4.

### I

- **Buyer output leaks to other buyers via cache** → Request cache
  keyed on (user, prompt hash) and never shared across users. PASS.

### D

- **Buyer flood-fills the wallet deposit route** → Rate limit +
  idempotency key prevents duplicates; bounded sweeping. PASS.

### E

- **Buyer escalates to operator role via signup** → Onboarding
  wizard is a separate flow gated by KYC. PASS.

## Phase 4 — TEE + Attestation

### S

- **Fake attestation (replayed old quote)** → Nonce binding
  enforced by `/api/nodes/attestation/nonce` + facade nonce check.
  PASS.
- **Attestation from a TEE we don't control** → Issuer pinning to
  known MAA / GCP verifier endpoints; vendor cert chains required
  for DIY paths. PASS for managed, PARTIAL for DIY (vendor chains
  in Phase 4.2).

### T

- **Malicious operator modifies TEE measurement claim** → Verifier
  rejects mismatch between claimed measurement and token content.
  PASS.

### R

- **Operator denies their TEE went debuggable** → Attestation
  reports include `x-ms-tee-is-debuggable`; any `true` value is
  recorded + rejected. PASS.

### I

- **Buyer data extracted from TEE memory** → Confidential tier
  binds data to measurement; debuggable TEEs rejected. PASS at
  the protocol level; hardware-level guarantees depend on Intel /
  AMD / NVIDIA errata.

### D

- **Attestation endpoint flooded** → Rate limit 6/min per key.
  PASS.

### E

- **Attestation bypass via undetected TEE type** → Unknown types
  return UNSUPPORTED verdict; router gate fails closed. PASS.

## Phase 5 — Settlement, escrow, disputes

### S

- **Fake dispute from a buyer** → Dispute window (168h), evidence
  requirements, reviewer independence. PASS.
- **Spoofed ledger entry** → Every entry has a groupId + balance
  invariant check + append-only table. PASS.

### T

- **Tampering with historical ledger rows** → Rows are never
  updated; corrections are new rows with type ADJUSTMENT and
  approver id. PASS.
- **Race condition on wallet commit** → Preflight balance check
  from ledger projection; row lock on Phase F1.3. PARTIAL — row
  lock pending.

### R

- **Operator disputes a ledger entry** → Entry has groupId linking
  to the ProxyRequest and the AttestationRecord; cannot be
  repudiated without contradicting upstream provider receipts.
  PASS.

### I

- **Ledger leaks other users' balances** → Per-user projection
  queries scoped to the authenticated userId. PASS.

### D

- **Attacker floods dispute endpoint** → Rate limit 60/min; dispute
  evidence upload size capped by Next.js defaults. PASS.

### E

- **Reviewer abuses their role** → Two-reviewer requirement for
  disputes >$10K; audit log of all resolutions; scope-bound
  step-up token required per resolution. PASS.

## Phase 6 — Reputation & SLA

### S

- **Sybil reputation** (one operator with 10 accounts each with a
  small positive history) → KYC on every operator account + IP +
  device fingerprinting + hardware attestation measurement
  correlation. PARTIAL — device fingerprinting is Phase 6.2.

### T

- **Operator tampers with their own uptime stats** → Stats
  collected by the orchestrator, not reported by the operator.
  PASS.

### R

- **Operator denies a downtime event** → Heartbeat + dispatcher
  record are independent of operator. PASS.

### I

- **Reputation history leaks other operators' aggregates** → Public
  page shows only per-operator numbers + marketplace-wide
  aggregates. Cross-operator comparisons never queryable via user
  API. PASS.

### D

- **Slashing-based DoS** (attacker triggers dispute to slash a
  competitor) → Disputes below $100 don't move reputation; dispute
  score decay; reviewer integrity checks. PASS.

### E

- **Operator escalates via reputation gaming** → Reputation score
  has hard caps and decay, cannot grant elevated access above
  declared capability tier. PASS.

## Cross-cutting open items

Items flagged OPEN in any phase and aggregated here for visibility:

| Item | Phase | Owner | ETA |
|---|---|---|---|
| Honey-token detection for Transport tier data leaks | 2 | T&S | Phase 6 |
| Device fingerprinting for Sybil prevention | 6 | Security | Phase 6.2 |

## Assumptions

1. The underlying Node.js + crypto library is not compromised.
2. TLS terminates at Vercel and we trust Vercel's TLS implementation.
3. Neon's SOC 2 posture covers database confidentiality at rest.
4. Stripe's own attestations cover Connect + Treasury.
5. The master `ENCRYPTION_KEY` lives in Vercel Secrets + is rotated
   annually.
6. Developers do not copy production keys to local machines.

## What this document is NOT

- Not a substitute for an external pen test. Scheduled for Phase 8.
- Not a legal compliance check (SOC 2 / HIPAA / PCI). Tracked in
  `commercial/DECISIONS.md` hard gates.
- Not a guarantee that every threat is fully mitigated. Status
  columns are deliberately mixed so the gaps are visible.
