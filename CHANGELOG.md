# InferLane Changelog

All notable changes to the InferLane commercial build are tracked
here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where
applicable.

Changes listed here drive the 30-day customer notification window
for breaking API changes and material policy updates (see
`commercial/API_VERSIONING.md`).

## [Unreleased]

### Added — Money layer
- Double-entry ledger (`LedgerEntry` + `LedgerLeg`) with balanced
  journal invariant enforcement and nightly reconciliation cron
- `LEDGER_FREEZE` kill switch for incident response
- `splitWorkloadPayment` ATTESTED tier (92/5/3) for
  attested-hardware operators
- Operator payout flow composing Stripe Connect transfers with the
  double-entry ledger + compensating ADJUSTMENT path on failure
- `/api/cron/execute-payouts` weekly cycle with $50 minimum
- `/api/cron/reconcile-ledger` nightly invariant check
- `/api/cron/sweep-treasury` idle capital sweep

### Added — Treasury + payouts
- Treasury management facade with local, Stripe Treasury, and
  Fireblocks adapters (stub mode until contracts land)
- Tether / USDT payment facade covering Plasma, Arbitrum, Tron,
  Solana, Ethereum
- Solana payout adapter stub
- Buyer wallet service with real ledger-leg projection balance

### Added — Disputes + appeals
- DisputeCase FSM (OPEN → EVIDENCE_REQUESTED → UNDER_REVIEW →
  RESOLVED_*), 168h window, 72h evidence deadline
- Automatic UNDER_REVIEW transition once both sides have
  submitted statements
- Dispute appeal workflow with 2-reviewer (or 3 for ≥$10K) panel,
  excludes original decider, compensating ledger entry on overturn
- Reviewer dashboard + resolve form with step-up re-auth retry
- Appeals queue dashboard

### Added — Privacy + compliance
- `/api/privacy/export` (GDPR Article 20)
- `/api/privacy/delete` + cancel (GDPR Article 17 with 30-day
  cooling-off)
- `/api/cron/purge-deleted-accounts` nightly wipe with legal
  retention
- Cookie Policy, Refund Policy, Subprocessor List drafts
- `.well-known/security.txt` responsible disclosure

### Added — Security
- HKDF-SHA-256 key derivation (ASVS V6.3.1) with legacy fallback
- Versioned ciphertext format (`v1:iv:tag:ct`)
- Envelope encryption facade with local + AWS KMS providers
- Redirect allowlist guard (`safeRedirect`, `assertSafeRedirect`)
- Step-up re-auth tokens (HMAC-SHA-256, scope-bound, 5min TTL)
- Telemetry sanitization (strips control chars, caps length)
- Attestation facade covering Azure MAA, GCP Confidential Space,
  Intel TDX, AMD SEV-SNP, NVIDIA CC, Apple Silicon MDM
- Azure MAA real JWT verifier with JWKS pinning, nonce binding,
  debuggable-TEE rejection
- Per-node attestation writer + nonce issuer
- Dashboard session TTL tightened to 8h idle from 30d
- API key creation form autocomplete disabled
- npm publish provenance configured
- 142 unit tests across ledger, disputes, redirect guard, step-up,
  envelope, rebates, telemetry, crypto

### Added — Router + marketplace
- Router-commercial wrapper: privacy tier gate, rebate tiebreaker
  (capped at 0.5% score delta), rebate earning recorder
- Provider rebate registry with flat percent, volume tiered,
  credit pool, off-peak kinds
- AttestationRecord writer + router gate consulting it for
  Confidential-tier routing

### Added — Operational
- Observability facade (`withSpan`, structured JSON logs)
- Incident runbook
- STRIDE threat model per phase
- ASVS L2 self-audit
- API versioning policy
- SIEM pipeline design (Grafana Cloud + S3 Object Lock)
- Auth.js v5 upgrade plan
- WebAuthn integration plan
- Darkbloom competitor memo
- InferLane architecture paper (draft)

### Added — UX
- Cross-LLM persistence installer (writes activation block to
  CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md,
  .gemini/styleguide.md, CONVENTIONS.md) with auto-detection
- Buyer wallet dashboard with top-up flow
- Dispute detail page (buyer / operator / reviewer)
- Operator capabilities declaration form
- Operator payouts dashboard
- Operator KYC onboarding via Stripe Identity
- Attestation history page
- Reviewer queue + appeals queue
- Transparency page ("how we make money")
- Public API docs at `/docs/api` via Swagger UI
- Landing page "Wake the sleeping compute" hero

### Added — Legal drafts
- Terms of Service v2
- Operator Agreement
- Privacy Policy v2
- Data Processing Addendum (GDPR Art. 28 with SCC Module Two)
- Acceptable Use Policy
- Dispute Resolution Policy
- Cookie Policy
- Refund Policy
- Subprocessor List

All legal drafts are marked DRAFT — REQUIRES LAWYER REVIEW BEFORE
PRODUCTION USE and are not in force until counsel signs off.

---

## How to read this changelog

- **Added** — new capabilities
- **Changed** — behavior changes
- **Deprecated** — still working, being phased out
- **Removed** — no longer available
- **Fixed** — bug fixes
- **Security** — security-relevant changes

Breaking API changes trigger a 30-day customer notification via
email and dashboard banner, plus a migration guide at
`docs/migration/`. See `commercial/API_VERSIONING.md` for the
full versioning policy.
