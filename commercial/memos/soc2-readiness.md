---
document: SOC 2 Type I Readiness Assessment
version: 1.0.0
status: Authoritative — AI-prepared control mapping, ready for auditor review
drafted_by: Claude (AI)
drafted_at: 2026-04-15
framework: AICPA Trust Services Criteria (2017)
target: SOC 2 Type I (snapshot design assessment)
---

# SOC 2 Type I Readiness — InferLane

Purpose: audit firms need a control catalog mapping each AICPA
Trust Services Criterion (TSC) to implemented controls. This
document is that catalog. A Type I report attests to the DESIGN
of controls at a point in time; a Type II report attests to the
OPERATING effectiveness over a 6–12 month window. We target Type I
first to get the initial attestation quickly, then Type II once
operating history accumulates.

## Scope

- All InferLane production systems under inferlane.dev
- Fleet API, Proxy API, Dispatch API, Marketplace API
- Commercial build modules (ledger, disputes, treasury,
  attestation, wallets, payouts, router-commercial)
- Dashboards and MCP integrations
- Node daemon

Excluded (these rely on third-party SOC 2 attestations we
reference):
- Vercel hosting (covered by Vercel SOC 2 Type II)
- Neon database (covered by Neon SOC 2 Type II)
- Stripe (payments + identity + treasury — covered by Stripe
  SOC 2 Type II and PCI DSS Level 1)
- Upstash Redis (covered by Upstash SOC 2)
- Grafana Cloud (covered by Grafana SOC 2)
- AWS S3 (audit log archival — covered by AWS SOC reports)

## Trust Services Criteria mapping

### CC1 — Control Environment

| Criterion | Implementation |
|---|---|
| CC1.1 — Integrity & ethics | `commercial/legal/SELLER_AGREEMENT.md` + `ACCEPTABLE_USE_POLICY.md` define ethical use commitments |
| CC1.2 — Board oversight | **Hard gate**: requires entity incorporation + board appointment. Tracked in hard-gates table. |
| CC1.3 — Management structure | `commercial/ops/INCIDENT_RUNBOOK.md` defines on-call rotation + escalation |
| CC1.4 — Competence commitment | `commercial/memos/webauthn-integration.md` + ASVS L2 self-audit show ongoing security investment |
| CC1.5 — Accountability | Every ledger entry has `approvedByUserId` for manual adjustments; every dispute resolution has `decidedByUserId` |

### CC2 — Communication and Information

| Criterion | Implementation |
|---|---|
| CC2.1 — Internal communication | `commercial/` folder structure + `BUILD_TRACKER.md` |
| CC2.2 — External communication | `/transparency` page, `/status` page, `/docs/api`, `CHANGELOG.md`, `/.well-known/security.txt` |
| CC2.3 — Objectives alignment | `commercial/DECISIONS.md` locks strategic choices |

### CC3 — Risk Assessment

| Criterion | Implementation |
|---|---|
| CC3.1 — Objectives specification | `commercial/paper/inferlane-architecture.md` §7 (Threat Model) |
| CC3.2 — Risk identification | `commercial/security/stride-threat-model.md` per-phase STRIDE |
| CC3.3 — Fraud risk | `commercial/competitors/darkbloom.md` + fraud protocol in `INCIDENT_RUNBOOK.md` §10 |
| CC3.4 — Change management | `commercial/API_VERSIONING.md` deprecation process |

### CC4 — Monitoring Activities

| Criterion | Implementation |
|---|---|
| CC4.1 — Ongoing monitoring | `src/lib/telemetry/index.ts` + `commercial/memos/siem-pipeline.md` (Grafana Cloud Loki) |
| CC4.2 — Evaluation of deficiencies | `commercial/security/asvs-l2.md` self-audit + `/api/cron/reconcile-ledger` |

### CC5 — Control Activities

| Criterion | Implementation |
|---|---|
| CC5.1 — Control design | Every commercial module has a design doc in `commercial/` |
| CC5.2 — Technology controls | See CC6 — CC9 below |
| CC5.3 — Policy deployment | `commercial/legal/` policies + CLAUDE.md activation persistence |

### CC6 — Logical and Physical Access

| Criterion | Implementation |
|---|---|
| CC6.1 — Logical access restriction | `src/lib/auth-api-key.ts` + NextAuth session management; 8-hour idle timeout |
| CC6.2 — Access provisioning | API key lifecycle in `/dashboard/settings` with autocomplete disabled |
| CC6.3 — Access removal | `POST /api/privacy/delete` + `/api/cron/purge-deleted-accounts` |
| CC6.4 — Credential management | HKDF-derived keys in `src/lib/crypto.ts`; envelope encryption in `src/lib/crypto/envelope.ts` |
| CC6.5 — Asset disposal | Data retention table in `commercial/legal/PRIVACY_POLICY.md` §6 |
| CC6.6 — Boundary protection | `src/lib/security/ssrf-guard.ts` + `src/lib/security/redirect-guard.ts` + CSP headers in `next.config.ts` |
| CC6.7 — Transmission integrity | TLS 1.3 enforced by Vercel; HSTS via `next.config.ts`; attestation facade enforces nonce binding |
| CC6.8 — System hardening | `commercial/security/asvs-l2.md` L2 baseline |

### CC7 — System Operations

| Criterion | Implementation |
|---|---|
| CC7.1 — System detection | Telemetry facade + `/api/cron/reconcile-ledger` ledger imbalance alert |
| CC7.2 — Monitoring | Grafana Cloud Loki pipeline (`commercial/memos/siem-pipeline.md`) |
| CC7.3 — Incident handling | `commercial/ops/INCIDENT_RUNBOOK.md` |
| CC7.4 — Incident response | Specific protocols for ledger imbalance, attestation failure, credential rotation, data exposure |
| CC7.5 — Incident recovery | LEDGER_FREEZE kill switch + compensating ADJUSTMENT path |

### CC8 — Change Management

| Criterion | Implementation |
|---|---|
| CC8.1 — Change authorization | Git-based change tracking; `prisma db push` schema changes require explicit review |
| CC8.2 — Testing | Vitest suite (172 tests across 18 files as of this draft); ledger invariant tests; attestation parser tests |
| CC8.3 — Change deployment | Vercel preview → production; rollback via Vercel one-click revert |

### CC9 — Risk Mitigation

| Criterion | Implementation |
|---|---|
| CC9.1 — Business continuity | Neon PITR; Vercel's regional redundancy |
| CC9.2 — Vendor management | `commercial/legal/SUBPROCESSORS.md` full subprocessor list |

### A1 — Availability (additional criteria)

| Criterion | Implementation |
|---|---|
| A1.1 — Capacity monitoring | Rate limiting per-route budgets in `src/lib/fleet/api-rate-limit.ts` |
| A1.2 — Environmental protection | Third-party hosting — covered by Vercel + Neon SOC reports |
| A1.3 — Recovery testing | **Gap** — no documented recovery drill cadence yet. Action: add quarterly DR exercise to `INCIDENT_RUNBOOK.md` §drill schedule |

### PI1 — Processing Integrity

| Criterion | Implementation |
|---|---|
| PI1.1 — Completeness, validity | Zod schemas on every API route; ledger balance invariant |
| PI1.2 — Processing accuracy | `src/lib/__tests__/escrow-ledger.test.ts` exercises split math at edges |
| PI1.3 — Processing timeliness | Rate limiting + telemetry facade with span timing |
| PI1.4 — Data quality | `/api/cron/reconcile-ledger` nightly check |
| PI1.5 — Output completeness | All money movements flow through double-entry ledger — no "shortcuts" |

### C1 — Confidentiality

| Criterion | Implementation |
|---|---|
| C1.1 — Confidential data ID | `RoutingPrivacyTier` enum + `src/lib/attestation/*` |
| C1.2 — Confidential data disposal | Privacy policy retention table; `/api/privacy/delete` |

### P1–P8 — Privacy (additional criteria)

| Criterion | Implementation |
|---|---|
| P1.1 — Privacy notice | `commercial/legal/PRIVACY_POLICY.md` |
| P2.1 — Choice and consent | Cookie consent banner; `/dashboard/privacy/settings` |
| P3.1 — Collection limits | Workload inputs never logged in Confidential tier |
| P4.1 — Use, retention, disposal | Retention table in Privacy Policy §6 |
| P5.1 — Access | `GET /api/privacy/export` (Art. 20) |
| P5.2 — Correction | **Gap** — no dedicated correction route; users can update profile fields but no structured correction flow |
| P6.1 — Third-party disclosure | Subprocessor list |
| P7.1 — Quality | User-supplied data is never processed beyond the workload |
| P8.1 — Monitoring and enforcement | DPO email + `privacy@inferlane.dev` |

## Current gaps (must close before Type I auditor kickoff)

1. **Entity incorporation** — required for CC1.2. Hard gate.
2. **Privacy correction route** — P5.2. Can ship in one day.
3. **DR drill cadence** — A1.3. Document schedule + run first
   drill. Can ship in two days.
4. **Access review cadence** — CC6.1 requires quarterly access
   reviews documented in a log. Action: add
   `/dashboard/admin/access-review` with quarterly checklist
   stored as a row per review.
5. **Employee onboarding controls** — CC1.4 requires documented
   onboarding for staff. Not applicable pre-hire, but documenting
   the intended process counts toward readiness.
6. **Change management approvals** — CC8.1 wants documented
   pre-deploy approvals. Today we rely on git commit history.
   Auditor may accept this as "informal but functional" for
   Type I but will want formal CI gates for Type II.
7. **Vendor risk assessments** — CC9.2 requires annual
   assessments of each subprocessor. Can be satisfied by
   collecting each partner's current SOC 2 report and filing
   them in `commercial/vendor-attestations/`.

## Hard gates (require human action)

| Gate | Required before | Estimated cost |
|---|---|---|
| Entity incorporation | Type I start | $1K–$5K |
| Audit firm engagement | Type I start | $25K–$60K |
| Penetration test report | Type I recommends it | $15K–$40K |
| Cyber insurance | Not required but strongly expected | $5K–$20K annual |
| Type I audit fieldwork | — | 4–8 weeks |
| Type II observation window | After Type I | 6–12 months |
| Type II audit fieldwork | After observation | 4–8 weeks |

## Recommended auditor firms

Ranked by fit for early-stage SaaS with technical depth:

1. **A-LIGN** — strong technical depth, well-regarded for
   fintech + marketplaces. Good fit.
2. **Drata** — automated platform, faster turnaround, lower
   cost. Good if you want to compress the timeline.
3. **Vanta** — similar to Drata with a broader compliance-
   management offering. Good if you want to bundle SOC 2 +
   ISO 27001 + PCI.
4. **Prescient Assurance** — hands-on, reasonable price, good
   for first-time Type I.
5. **Schellman** — larger firm, higher cost, stronger brand
   name; worth it if enterprise customers specifically ask for
   a "Big 4-adjacent" auditor.

## Timeline

- **Week 0** — engage counsel to review this memo + MSB
  determination memo
- **Weeks 1–4** — incorporate entity, open business bank
  account, sign SOC 2 auditor
- **Weeks 5–8** — close the gaps identified above (privacy
  correction, DR drill cadence, access review process)
- **Weeks 9–12** — auditor fieldwork (Type I)
- **Week 13** — Type I report delivered
- **Weeks 14+** — begin Type II observation period (6 months
  minimum)

## Estimated total cost

- Year 1: $40K–$80K (Type I + pen test + cyber insurance start)
- Year 2: $80K–$150K (Type II + annual Type I renewal)

## References

- AICPA Trust Services Criteria 2017
- `commercial/DECISIONS.md`
- `commercial/security/asvs-l2.md`
- `commercial/security/stride-threat-model.md`
- `commercial/memos/siem-pipeline.md`
- `commercial/ops/INCIDENT_RUNBOOK.md`
- `commercial/legal/SUBPROCESSORS.md`
