# InferLane Commercial Build — Locked Decisions

Date: 2026-04-14
Status: Authoritative. Change only via explicit reversal.

## Constraint

Everything in the commercial build is executed by AI (Claude) end-to-end, with hard
gates noted below that require human action before going live.

## 1. Unit of account — USD

All pricing, ledger entries, payouts, dispute resolution, reserves, and tax reporting
are denominated in USD. Token-based models (per-model token prices) are an *input* to
pricing but the ledger records USD cents only.

- Database: `amountUsdCents: BigInt`
- No crypto settlement at launch
- FX conversion for non-USD bank accounts handled at payout time via Stripe Connect

## 2. TEE strategy — build both paths

- **Managed path (primary at launch):** Azure Attestation Service + Azure Confidential
  VMs (AMD SEV-SNP). Provides SDK-level attestation with zero custom HSM work.
- **DIY path (parallel, activates post-launch):** RATS-compliant attestation collector
  that accepts Intel TDX quotes, AMD SEV-SNP reports, NVIDIA CC attestations directly.
  Lets on-prem sellers participate without going through Azure.

Router treats both paths as equivalent *if* the verifier signs the attestation.

## 3. Fee structure — 10% platform + 3% reserve

- Buyer pays: quoted price
- Seller receives: 87% (10% platform + 3% reserve fund contribution)
- Reserve fund covers: dispute refunds, slashing offsets, bad-debt writeoff
- Target reserve floor: 3 months of payout volume
- Fees adjustable per-tier later (enterprise volume discounts)

## 4. Legal templates — AI-drafted

Claude drafts all templates. They are marked **DRAFT — REQUIRES LAWYER REVIEW** in
frontmatter and in the UI until you have a lawyer sign them off.

- Terms of Service (buyer)
- Seller Agreement
- Privacy Policy
- Data Processing Addendum (DPA)
- Acceptable Use Policy
- Dispute Resolution Policy

Hard gate: **lawyer review before production traffic.** Build proceeds without it.

## 5. Security review — AI-driven

- Claude executes the OWASP ASVS L2 checklist against the codebase
- Claude runs static analysis (semgrep, typescript-strict, npm audit)
- Claude writes and runs adversarial test suites
- Output: `commercial/security/audit-report.md`

Hard gate: **external pen test firm before high-value workloads.** Not a blocker
for code work.

## 6. KYC — Stripe Identity

- Uses existing Stripe integration; no new vendor contract needed
- Verification session issued during seller onboarding
- Liveness + government ID + selfie match
- Sanctions screening via Stripe's OFAC list + our own additional list
- Results stored as attestation hash, not raw documents

## 7. Execution order — parallel streams

Three streams run concurrently, each self-contained so an LLM can make progress on
any of them without blocking the others:

- **Stream A (Infrastructure):** Phase 1 hardening + Phase 4 TEE + Phase 6 reputation
- **Stream B (Product):** Phase 2 seller onboarding + Phase 3 buyer surface
- **Stream C (Operations):** Phase 0 legal drafts + Phase 5 settlement + Phase 8 audit

## Hard gates (require human action eventually)

These are flagged in the build but do NOT block AI progress on everything else.

| Gate | Required before | Owner |
|---|---|---|
| Entity incorporation (Delaware C-corp) | taking real buyer funds | You |
| Business bank + Stripe Connect KYB | taking real seller payouts | You |
| MSB determination + FinCEN registration | marketplace settlement at volume | You + lawyer |
| Lawyer review of drafted templates | production traffic | You + lawyer |
| External pen test | high-value workloads / enterprise | You + firm |
| Cyber liability insurance | enterprise contracts | You + broker |
| SOC 2 Type I | enterprise sales | You + auditor |
| Production TEE hardware (if DIY path) | DIY sellers at volume | You + hardware |

## Operating principles

1. **Defense in depth.** Every layer assumes the next is compromised.
2. **Trust minimization.** Attestation over policy. Crypto over trust.
3. **Observability by default.** Every request is traced, every state change logged.
4. **Symmetric protection.** Buyers and sellers are both protected.
5. **Reversibility.** Every write action must have a documented rollback.
6. **Regulatory-ready.** Schemas and logs anticipate audit requests.
7. **Honest UX.** DRAFT banners and hard-gate warnings show in the UI.
8. **Best-in-class only.** No shortcuts justified by "it's a startup".
