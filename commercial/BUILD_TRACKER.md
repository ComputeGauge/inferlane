# InferLane Commercial Build — Progress Tracker

Last updated: 2026-04-14
See `DECISIONS.md` for locked choices.

## Status legend

- ⚪ Not started
- 🟡 In progress
- 🟢 Done (code + passes typecheck)
- 🔵 Done (code + tests + verified)
- 🔒 Hard gate (requires human action)
- ⚠️ Draft — needs review

---

## Phase 0 — Strategic decisions & legal

| Item | Status | Location |
|---|---|---|
| Decision doc (unit, fees, TEE, etc.) | 🟢 | `commercial/DECISIONS.md` |
| Terms of Service v2 draft | ⚠️ | `commercial/legal/TERMS_OF_SERVICE.md` |
| Operator / Seller Agreement draft | ⚠️ | `commercial/legal/SELLER_AGREEMENT.md` |
| Privacy Policy draft | ⚠️ | `commercial/legal/PRIVACY_POLICY.md` |
| Data Processing Addendum (DPA) draft | ⚪ | pending |
| Acceptable Use Policy | ⚪ | pending |
| Dispute Resolution Policy | ⚪ | pending |
| Incorporation (Delaware C-corp) | 🔒 | human action |
| MSB determination + registration | 🔒 | human + lawyer |
| Lawyer review of all templates | 🔒 | human + lawyer |

## Phase 1 — Core infrastructure hardening

| Item | Status | Location |
|---|---|---|
| Telemetry facade (traces/metrics/logs) | 🟢 | `src/lib/telemetry/index.ts` |
| OpenTelemetry SDK hookup (managed) | ⚪ | swap console backend for OTLP |
| Instrument Fleet API routes | ⚪ | use `withSpan` in route handlers |
| Instrument proxy router | ⚪ | `src/lib/proxy/router.ts` |
| Secrets management review | ⚪ | audit env var usage |
| DB hardening (RLS, row locks, PITR) | ⚪ | Neon has PITR by default |
| CI/CD: typecheck + test gates | ⚪ | `.gitlab-ci.yml` present |
| API hardening (auth, rate limit, CORS) | 🟢 | Fleet already locked down |
| Security baseline (headers, CSP) | 🟢 | `next.config.ts` headers set |

## Phase 2 — Seller onboarding

| Item | Status | Location |
|---|---|---|
| KYC via Stripe Identity (service) | 🟢 | `src/lib/kyc/stripe-identity.ts` |
| KYC UI flow (`/operator/onboarding/kyc`) | ⚪ | pending |
| Sanctions screening | 🟡 | stub in `stripe-identity.ts#screenSanctions` |
| Operator capabilities declaration UI | ⚪ | pending |
| Hardware attestation test suite | ⚪ | needs Phase 4 attestation |
| Node daemon scaffold | ⚪ | `packages/node-daemon/` (new) |

## Phase 3 — Buyer surface

| Item | Status | Location |
|---|---|---|
| Router v2 — attestation-aware selection | ⚪ | extends `src/lib/proxy/router.ts` |
| Privacy tier enforcement in router | 🟡 | tiers exist in schema |
| Buyer dashboard upgrades (ops tab) | ⚪ | pending |
| MCP tool: `attestation_status` | ⚪ | pending |
| MCP tool: `dispute_open` | ⚪ | pending |

## Phase 4 — TEE + real attestation

| Item | Status | Location |
|---|---|---|
| Attestation facade | 🟢 | `src/lib/attestation/index.ts` |
| Azure Attestation Service verifier | 🟡 | stub in facade |
| GCP Confidential Space verifier | 🟡 | stub in facade |
| Intel TDX quote parser | ⚪ | Phase 4.2 |
| AMD SEV-SNP verifier | ⚪ | Phase 4.2 |
| NVIDIA CC verifier | ⚪ | Phase 4.2 |
| Attestation audit log storage | ⚪ | needs migration |
| Periodic re-attestation scheduler | ⚪ | cron |

## Phase 5 — Settlement, escrow, disputes

| Item | Status | Location |
|---|---|---|
| Double-entry escrow ledger | 🟢 | `src/lib/billing/escrow-ledger.ts` |
| Ledger Prisma migration | ⚪ | pending |
| Dispute engine skeleton | 🟢 | `src/lib/disputes/engine.ts` |
| Dispute Prisma migration | ⚪ | pending |
| Reviewer dashboard | ⚪ | pending |
| Appeal workflow | ⚪ | pending |
| Nightly balance reconciliation job | ⚪ | cron |
| Stripe Connect payout integration | 🟢 | existing `src/lib/stripe-connect.ts` |

## Phase 6 — Reputation, SLA, slashing

| Item | Status | Location |
|---|---|---|
| Reputation score decay model | 🟡 | `src/lib/nodes/reliability.ts` |
| SLA enforcement (latency/uptime) | ⚪ | pending |
| Slashing engine | ⚪ | pending |
| Reputation dashboard (public) | ⚪ | pending |

## Phase 7 — Advanced features

| Item | Status | Location |
|---|---|---|
| Reserved capacity | 🟡 | compute futures model exists |
| Multi-currency payouts | ⚪ | Stripe Connect supports |
| Enterprise SSO (SAML/OIDC) | ⚪ | pending |
| Volume discount tiering | ⚪ | pending |

## Phase 8 — Security review

| Item | Status | Location |
|---|---|---|
| OWASP ASVS L2 checklist | ⚪ | `commercial/security/asvs-l2.md` (pending) |
| Semgrep run + triage | ⚪ | CI integration |
| Adversarial test suite | ⚪ | pending |
| External pen test | 🔒 | human-procured firm |
| SOC 2 Type I | 🔒 | human-procured auditor |

## Phase 9 — Soft launch

| Item | Status | Location |
|---|---|---|
| Beta operator cohort (10 nodes) | ⚪ | pending |
| Beta buyer cohort (20 accounts) | ⚪ | pending |
| Incident runbook | ⚪ | `commercial/ops/runbook.md` (pending) |
| Status page | ⚪ | pending |

## Phase 10 — Public launch

| Item | Status | Location |
|---|---|---|
| Marketing site updates | ⚪ | pending |
| Pricing page with marketplace | ⚪ | pending |
| Press / launch post | ⚪ | pending |

---

## Turn 1 deliverables (2026-04-14)

- ✅ `commercial/DECISIONS.md` — locked choices
- ✅ `commercial/legal/TERMS_OF_SERVICE.md` — Buyer ToS v2 draft
- ✅ `commercial/legal/SELLER_AGREEMENT.md` — Operator agreement draft
- ✅ `commercial/legal/PRIVACY_POLICY.md` — Privacy policy v2 draft
- ✅ `src/lib/telemetry/index.ts` — vendor-neutral telemetry facade
- ✅ `src/lib/kyc/stripe-identity.ts` — Stripe Identity KYC service
- ✅ `src/lib/attestation/index.ts` — attestation facade (managed + DIY)
- ✅ `src/lib/billing/escrow-ledger.ts` — double-entry escrow ledger
- ✅ `src/lib/disputes/engine.ts` — dispute workflow engine

## Turn 2 deliverables (2026-04-14)

- ✅ Prisma schema additions: KycSession, AttestationRecord, LedgerEntry/
     LedgerLeg, DisputeCase/DisputeEvidence
- ✅ `src/lib/attestation/azure.ts` — real Azure MAA JWT verifier (jose,
     JWKS, nonce binding, issuer pinning, measurement enforcement)
- ✅ `commercial/legal/DATA_PROCESSING_ADDENDUM.md` — GDPR Art. 28 draft
     with SCC Module Two annexes
- ✅ `commercial/legal/ACCEPTABLE_USE_POLICY.md` — content + use
     restrictions including regulated application rules
- ✅ `commercial/FLOAT_MODEL.md` — four-leg "free at the surface"
     strategy doc (float / rebates / futures / premium surfaces)
- ✅ `src/lib/treasury/index.ts` — treasury management facade
- ✅ `src/lib/wallets/buyer-wallet.ts` — prepaid wallet service
- ✅ `src/lib/tether/index.ts` — USDT payment facade (Plasma, Arbitrum,
     Tron, Solana, Ethereum)
- ✅ `src/lib/rebates/index.ts` — provider rebate tracking
- ✅ Prisma schema additions: BuyerWallet, WalletTransaction,
     TreasuryHolding, ProviderRebateConfig, ProviderRebateEarning

## Turn 10 deliverables (2026-04-15) — real TEE verifiers + deep ops

### Real TEE verifiers (not stubs)
- ✅ `src/lib/attestation/sev-snp.ts` — full AMD SEV-SNP report
     parser with structured 1184-byte layout, nonce binding via
     SHA-512(nonce), debug-mode rejection, ECDSA signature
     verification against VCEK, pluggable VcekFetcher (production
     hits AMD KDS, tests supply static chain), ARK→ASK→VCEK
     chain validation with pinned ARK SPKI hash, env override
     for pin rotation
- ✅ `src/lib/attestation/tdx.ts` — full Intel TDX v4 quote parser
     with structured 48+584+sig layout, nonce binding, debug-
     mode rejection, ECDSA P-256 signature verification with
     raw-point to DER/PEM conversion, PCK→Platform CA→Root chain
     validation with pinned Intel SGX Root SPKI
- ✅ `src/lib/attestation/apple-mdm.ts` — full Apple App Attest
     verifier with hand-rolled CBOR decoder (text/byte/array/map),
     x5c chain validation against pinned Apple App Attestation
     Root CA, nonce extension extraction from leaf cert ASN.1,
     authData parser with AAGUID environment check

### 30 new attestation parser tests (all passing)
- ✅ `sev-snp.test.ts` (11), `tdx.test.ts` (12),
     `apple-mdm.test.ts` (7)

### Security hardening — 3 red-team findings fixed in-turn
- ✅ **H-1** — Postgres advisory lock on `commitFromWallet`
- ✅ **M-2** — Sweep cron checks adapter `stub` flag
- ✅ **M-4** — Span constructor sanitizes the name parameter

### GDPR completion
- ✅ `POST /api/privacy/correct` — Article 16 rectification

### Operational depth
- ✅ `commercial/security/red-team-audit.md` — 19 findings,
     severity-ranked, 3 fixed inline
- ✅ `commercial/ops/TABLETOP_SCENARIOS.md` — 10 drill scenarios
- ✅ `commercial/ops/DR_DRILL_PLAN.md` — quarterly schedule
     closing SOC 2 A1.3 gap
- ✅ `commercial/memos/msb-determination.md` — MSB / MTL analysis
     per state with 8 open questions for counsel
- ✅ `commercial/memos/soc2-readiness.md` — TSC control mapping
- ✅ `commercial/legal/ANNOTATED_REVIEW.md` — clause-level risk
     annotations on all 8 legal drafts
- ✅ `commercial/WAITING_ON_YOU.md` — the 14 hard gates

### Test + typecheck status
- ✅ **172/172 tests passing across 18 files**
- ✅ Zero type errors

## Turn 9 deliverables (2026-04-15) — UX completion + adapter scaffolds

### Appeals surface
- ✅ `GET /api/appeals` list with reviewer/party scope
- ✅ `GET /api/appeals/:id` detail with authorisation check
- ✅ `POST /api/appeals/:id/assign` — panel assignment, ADMIN +
     step-up gated
- ✅ `POST /api/appeals/:id/decide` — overturn or uphold, ADMIN +
     step-up gated, ≥20 char reasoning
- ✅ `/dashboard/admin/appeals` — 3-section queue (awaiting
     assignment / under review / decided) with priority display
- ✅ `/dashboard/admin/appeals/:id` — detail page with assign +
     decide forms, step-up token retry flow shared with the
     dispute resolve page

### Wallet top-up
- ✅ `POST /api/wallet/topup` — creates Stripe Checkout session
     in payment mode with `inferlane_purpose: wallet_deposit`
     metadata, flows through the existing stripe-deposits webhook
     to credit the wallet
- ✅ `/dashboard/wallet` top-up button now functional with preset
     amounts ($25 / $100 / $500 / $2.5K) + custom input + refund
     policy link + success redirect handling

### Operator payouts
- ✅ `GET /api/operator/payouts` — pending balance from ledger,
     recent NodePayout rows, next-cycle timestamp
- ✅ `/dashboard/operator/payouts` — 3-card summary + payout
     history table + Stripe Connect + below-minimum warnings

### Treasury adapters
- ✅ `src/lib/treasury/adapters/fireblocks.ts` — typed contract
     for vault balance + outbound payouts + readiness check;
     stub mode until FIREBLOCKS_ENABLED + credentials land
- ✅ `GET /api/admin/treasury/health` — ADMIN-only aggregated
     readiness report (Stripe Treasury + Fireblocks + ledger
     last entry)

### Attestation scaffolds
- ✅ `src/lib/attestation/tdx.ts` — Intel TDX quote verifier
     scaffold with shape detection (`looksLikeTdxQuote`), version
     check, full spec reference for Phase 4.2 implementation
- ✅ `src/lib/attestation/sev-snp.ts` — AMD SEV-SNP scaffold with
     1184-byte minimum shape check and spec reference
- ✅ Attestation facade dispatches TDX/SEV-SNP to the scaffolds
     via dynamic import; UNSUPPORTED verdicts now have structured
     detail rather than flat strings

### Status + changelog
- ✅ `CHANGELOG.md` — full changelog covering every commercial
     build addition across turns 1-9
- ✅ `/status` — public status page with database connectivity,
     Stripe Treasury readiness, Fireblocks readiness real checks

## Turn 8 deliverables (2026-04-15) — Darkbloom absorption + GDPR rights + paper

### Darkbloom-sourced additions
- ✅ `APPLE_SILICON_MDM` attestation type already shipped turn 7
- ✅ **92/5/3 ATTESTED tier** in `splitWorkloadPayment` — opt-in
     high-trust split for operators passing fresh VERIFIED
     attestation AND accepting full dispute liability. Basis-point
     structure with invariant check that splits sum to 10,000.
     4 new ledger tests exercising the tier (10,000¢ split, 7¢
     pathological remainder, memo tagging, $10M precision).
- ✅ `src/lib/payouts/adapters/solana.ts` — Solana payout adapter
     stub: screen → submit contract shape, base58 address check,
     env-var kill switch, wired for Coinbase Custody or Fireblocks
     SOL enablement
- ✅ Landing page hero rewritten — "Wake the world's sleeping
     compute" with Inference Tax framing; benchmark link moved
     to a secondary callout
- ✅ `commercial/paper/inferlane-architecture.md` — 10-section
     draft of the architecture paper: system overview, four-leg
     economics, privacy tiers, attestation facade, money layer,
     threat model, operational practices, related work (RouteLLM,
     Darkbloom, Tether, Robinhood). CC BY 4.0 license.

### GDPR subject rights
- ✅ `GET /api/privacy/export` — Article 20 data portability,
     JSON bundle download, 2/hour rate limit, includes user
     identity, subscription, api keys (prefix only), KYC session
     results, wallet balance, 90-day dispute history
- ✅ `POST /api/privacy/delete` — Article 17 right to erasure,
     30-day cooling-off window, step-up re-auth required,
     blocks deletion if wallet balance non-zero
- ✅ `POST /api/privacy/delete/cancel` — cancel within the
     cooling-off window
- ✅ `GET /api/cron/purge-deleted-accounts` — nightly 02:45 UTC,
     hard-deletes PII after cooling-off elapsed, retains
     legally-required records (financial, audit, KYC)
- ✅ `commercial/legal/COOKIE_POLICY.md` — strictly necessary
     vs functional vs analytics, consent gating, no cross-site
     advertising, DNT honoring
- ✅ `commercial/legal/REFUND_POLICY.md` — prepaid balance
     refunds, subscription pro-rating, EU 14-day withdrawal,
     Australian Consumer Law statutory guarantees, refund vs
     dispute distinction

### Step-up + reviewer UX
- ✅ `POST /api/auth/step-up` — issues scope-bound tokens, role
     gate for admin-only scopes
- ✅ `/dashboard/admin/disputes/[id]/resolve` — reviewer
     resolution form with step-up token retry flow
     (sessionStorage cached, auto-retry on 401)

### Tests
- ✅ 4 new ATTESTED-tier tests in `escrow-ledger.test.ts`
- ✅ **142/142 tests passing** across 15 files

## Turn 6 deliverables (2026-04-15) — wire up the money layer

### Real persistence
- ✅ `src/lib/billing/escrow-ledger.ts` — `postLedgerEntry` now
     writes LedgerEntry + LedgerLeg in a single Prisma transaction,
     accepts an optional outer `tx` so callers can atomically
     compose ledger writes with their own state changes
- ✅ `getAccountBalance(account, subject, positiveDirection)` —
     generic balance projection over ledger_legs
- ✅ `reconcileLedger()` — walks all entries, verifies invariant,
     returns violations
- ✅ LedgerAccount enum gained `OPERATIONAL_CASH` in schema + pushed
     to Neon + client regenerated
- ✅ `src/lib/disputes/engine.ts` — open / addEvidence / resolve /
     get / listForUser all write real DisputeCase + DisputeEvidence
     rows; resolve composes the refund ledger write with the
     DisputeCase update in a single transaction; addEvidence
     opportunistically transitions to UNDER_REVIEW once both sides
     have submitted statements

### Dispute API
- ✅ `src/app/api/disputes/route.ts` — GET list + POST open
- ✅ `src/app/api/disputes/[disputeId]/route.ts` — GET with
     authorisation check (buyer / operator / reviewer)
- ✅ `src/app/api/disputes/[disputeId]/resolve/route.ts` — POST
     resolve gated on ADMIN role + step-up scope `dispute.resolve`

### Wallet wiring
- ✅ `src/app/api/wallet/deposit/route.ts` — idempotent deposit
     entry point used by Stripe / Tether webhooks + manual credit;
     manual credit path gated on ADMIN + step-up
- ✅ Proxy completion path now calls `recordExpectedRebate()` for
     every successful request (fire-and-forget; no-op until a
     rebate config is registered)

### Crons
- ✅ `/api/cron/reconcile-ledger` — nightly 03:10 UTC, pages on
     imbalance
- ✅ `/api/cron/sweep-treasury` — daily 17:15 UTC, idle capital
     sweep (stub until STRIPE_TREASURY_ENABLED flips)
- ✅ `vercel.json` — both crons wired to the production schedule

### Unit tests (44/44 passing)
- ✅ `src/lib/__tests__/escrow-ledger.test.ts` — 11 tests for
     checkBalance, splitWorkloadPayment, refundFromEscrow,
     including the 87/10/3 split, pathological small amounts
     (7 cents → operator gets all 7), large amounts ($10M),
     reserve drawdown path, negative-amount rejection
- ✅ `src/lib/__tests__/redirect-guard.test.ts` — 16 tests for
     safeRedirect + assertSafeRedirect covering every scheme
     rejection, credential-query stripping, allowlisted hosts
- ✅ `src/lib/__tests__/step-up.test.ts` — 9 tests for HMAC
     signing, payload tampering rejection, scope/userId binding,
     expiry, requireStepUp error paths
- ✅ `src/lib/__tests__/envelope.test.ts` — 8 tests for envelope
     encryption round-trip (string + buffer), IV uniqueness, tag
     tamper detection, ciphertext tamper detection, unsupported
     version, empty + large payloads

### Operational docs
- ✅ `commercial/ops/INCIDENT_RUNBOOK.md` — severity levels,
     paging matrix, first-hour checklist, ledger imbalance
     protocol, attestation failure protocol, credential rotation,
     data exposure protocol, comms templates, RCA template,
     on-call rotation, drill schedule
- ✅ `public/.well-known/security.txt` — RFC 9116 responsible
     disclosure file
- ✅ `commercial/legal/SUBPROCESSORS.md` — full subprocessor
     list with tiers, locations, certifications, notification
     process, LLM-provider transparency, operator category
- ✅ `src/app/transparency/page.tsx` — public "how we make money"
     page covering all four revenue legs + anti-conflict guarantee +
     wallet custody explanation + ASVS self-audit link

## Turn 5 deliverables (2026-04-15) — full queue burn

### Attestation writer path
- ✅ `src/app/api/nodes/attestation/route.ts` — POST writes
     AttestationRecord rows, flips `NodeOperator.teeAttested` on
     VERIFIED, idempotent ownership check, per-key rate limit.
- ✅ `src/app/api/nodes/attestation/nonce/route.ts` — GET issues
     fresh 256-bit nonces, one-time use, 15-min expiry, ownership
     bound, in-memory store with cleanup.

### Node daemon scaffold
- ✅ `packages/node-daemon/package.json` — new npm package with
     `inferlane-node` bin entry, ESM-only, Node 20+
- ✅ `packages/node-daemon/src/config.mjs` — CLI + env + config
     file precedence, validated at startup
- ✅ `packages/node-daemon/src/logger.mjs` — zero-dep structured
     JSON logger with control-char stripping
- ✅ `packages/node-daemon/src/api-client.mjs` — HTTP client for
     heartbeat / attestation / capability endpoints
- ✅ `packages/node-daemon/src/capability-detector.mjs` — Ollama /
     vLLM / llama.cpp probes with timeouts
- ✅ `packages/node-daemon/src/attestation-collector.mjs` — TEE
     environment detection + bundle collection stubs per vendor
- ✅ `packages/node-daemon/src/daemon.mjs` — three independent
     cycles (heartbeat, capability, attestation) with exponential
     backoff on consecutive failure, graceful shutdown
- ✅ `packages/node-daemon/bin/inferlane-node.mjs` — CLI entry
     with --dry-run / --help / --version
- ✅ Dry-run smoke-tested: validates config, prints redacted
     summary, exits 0

### Security hardening
- ✅ `src/lib/security/redirect-guard.ts` (ASVS V5.1.5) —
     `safeRedirect()`, `assertSafeRedirect()`, allowlisted hosts
     from env, credential-query stripping, protocol-relative and
     javascript:/data:/file:/blob: rejected
- ✅ `src/lib/security/step-up.ts` (ASVS V4.3.2) — scope-bound
     HMAC-SHA-256 step-up tokens, 5-min TTL, HKDF-derived key,
     timing-safe comparison, `StepUpRequiredError` + `requireStepUp()`
- ✅ `src/lib/crypto/envelope.ts` (ASVS V6.4.1) — envelope
     encryption facade with DEK/KEK separation, local provider
     (HKDF-derived KEK) + AWS KMS provider stub, versioned
     ciphertext bundles, DEK zeroization
- ✅ `src/lib/auth.ts` session config tightened (ASVS V3.3.2):
     8h idle / 15min refresh (from 30d default)
- ✅ `src/app/dashboard/settings/page.tsx` API key name input
     marked `autoComplete="off"` + `data-1p-ignore` + `data-lpignore`
     (ASVS V8.3.4)
- ✅ `packages/mcp-server/package.json` — `publishConfig` with
     provenance + `publish:provenance` script (ASVS V10.3.2)

### API surface
- ✅ `src/lib/openapi/spec.ts` — OpenAPI 3.1 spec authored
     by hand for Fleet, Attestation, and Wallet surfaces
- ✅ `src/app/api/openapi.json/route.ts` — serves the spec
- ✅ `src/app/api/kyc/sessions/route.ts` — POST start + GET status
- ✅ `src/app/api/wallet/balance/route.ts` — GET current balance
     from ledger projection
- ✅ `src/app/api/fleet/sessions/[sessionId]/events/route.ts` —
     wrapped in `withSpan` for real observability

### Dashboard UI scaffolds
- ✅ `src/app/dashboard/wallet/page.tsx` — balance cards,
     deposit CTA, empty-state fallback
- ✅ `src/app/dashboard/disputes/page.tsx` — open + resolved
     tables with status badges, graceful loading
- ✅ `src/app/dashboard/operator/onboarding/kyc/page.tsx` — start
     verification flow, status polling, Stripe Identity redirect
- ✅ `src/app/dashboard/attestation/page.tsx` — attestation history
     table, outcome colour coding, measurement prefixes

### Docs & memos
- ✅ `commercial/security/stride-threat-model.md` — STRIDE per
     phase across Phase 1-6, PASS/PARTIAL/OPEN status, cross-
     cutting open items, assumptions
- ✅ `commercial/memos/auth-js-v5-upgrade.md` — migration plan
     with 6 phases, rollback strategy, risk table
- ✅ `commercial/memos/webauthn-integration.md` — simplewebauthn-
     based passkey plan, schema, routes, rollout stages
- ✅ `commercial/memos/siem-pipeline.md` — Grafana Cloud + S3
     Object Lock architecture, cost projection, alerting rules
- ✅ `commercial/API_VERSIONING.md` — authoritative versioning
     policy with breaking-change taxonomy and deprecation process

## Turn 4 deliverables (2026-04-15) — cross-LLM persistence

- ✅ `packages/plugin/templates/activation.md` — marker-delimited
     activation block that tells Claude (and any LLM) to think about
     cost at conversation start
- ✅ `packages/plugin/scripts/install-persistence.mjs` — idempotent
     cross-client installer (Claude global, Claude project, Cursor,
     Copilot, Gemini Code Assist, Aider, AGENTS.md). Supports
     `--scope`, `--dry-run`, `--clients`, `--project-dir`.
- ✅ `packages/plugin/scripts/uninstall-persistence.mjs` — reversible
     uninstaller that removes exactly the block the installer added,
     deletes files we created if they'd be empty afterwards
- ✅ Staged the installer into `packages/mcp-server/bin/` and
     `packages/mcp-server/templates/` so it ships with the published
     npm package. Added `inferlane-persist` + `inferlane-unpersist`
     bins to `@inferlane/mcp-server` — one-command install via
     `npx @inferlane/mcp-server inferlane-persist`.
- ✅ `packages/plugin/PERSISTENCE.md` — docs explaining scope, files,
     idempotence, security, and the one-command flow
- ✅ Verified via fixture: install + re-install (idempotent) + uninstall
     cycle leaves files byte-identical to their pre-install state
- ✅ Applied to local machine — `~/.claude/CLAUDE.md` now has the
     activation block. Next new Claude Code session in any project
     will auto-activate InferLane awareness.

## Turn 3 deliverables (2026-04-14)

- ✅ `prisma db push` run against Neon — all 14 new tables + 18 new
     enums live in production schema
- ✅ `commercial/legal/DISPUTE_RESOLUTION_POLICY.md` — full dispute
     policy draft covering scope, window, lifecycle, evidence, reviewer
     independence, standard of proof, appeals, transparency
- ✅ `src/lib/proxy/router-commercial.ts` — attestation-gated routing
     wrapper (`gateByPrivacyTier`), rebate tiebreaker (`pickTiebreaker`),
     rebate earning recorder (`recordExpectedRebate`). Base router
     untouched; commercial concerns layer on top.
- ✅ `src/lib/wallets/buyer-wallet.ts` — real balance projection over
     ledger_legs, `hasSufficientFunds` helper, insufficient-funds check
     on commit so the ledger can't be overdrawn
- ✅ `commercial/security/asvs-l2.md` — OWASP ASVS L2 self-audit:
     56 PASS / 22 PARTIAL / 3 FAIL across 14 categories
- ✅ **V6.3.1 / V2.4.4 FAIL closed** — `src/lib/crypto.ts` now uses
     HKDF-SHA-256 for key derivation with legacy fallback for old
     ciphertexts + `isLegacyCiphertext()` helper for opportunistic
     re-encryption
- ✅ **V14.5.2 FAIL closed** — `src/lib/telemetry/index.ts` sanitizes
     all user-supplied strings (strips C0 controls + caps length at
     2000 chars) before they land in structured logs
- ✅ **V14.4.1 FAIL closed** — `npm audit fix` dropped vulns from 22 to
     7. Remaining 7 (including 1 high on next-auth → nodemailer) need
     a breaking upgrade to auth.js v5; tracked separately

## Next turn's priorities

1. **Close ASVS PARTIALs** — STRIDE threat model, enterprise WebAuthn,
   session timeout tightening, admin step-up re-auth, redirect
   allowlist, KMS envelope encryption for ENCRYPTION_KEY, SIEM
   pipeline, API versioning doc + OpenAPI emission.
2. **Tether partner decision memo** — `commercial/memos/tether-partner.md`
   comparing Fireblocks, BitGo, Anchorage, Tether merchant API.
3. **Stripe Treasury adapter** — wire `src/lib/treasury/adapters/stripe-treasury.ts`
   against the documented API. Requires a Stripe Treasury account
   (hard gate) but stub + types can be landed today.
4. **AttestationRecord writer path** — when the node daemon or an
   operator posts an attestation bundle, we need the API surface
   that stores a verdict. New route: `/api/nodes/attestation`.
5. **Auth.js v5 upgrade plan** — document the migration to remove
   the remaining high-severity next-auth vulnerability.
6. **STRIDE threat model** per phase.
7. **Dashboard UI surfaces** — /dashboard/wallet, /dashboard/disputes,
   /dashboard/operator/onboarding/kyc, /dashboard/attestation.
8. **Node daemon scaffold** — `packages/node-daemon/` with heartbeat,
   attestation collection, capability declaration, Stripe Connect
   onboarding.
