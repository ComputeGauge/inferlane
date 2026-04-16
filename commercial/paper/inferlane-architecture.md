---
title: InferLane — a privacy-attested compute marketplace with four-leg economics
authors: InferLane (commercial build)
version: 0.1 draft
status: DRAFT — AI-authored; awaiting external review
date: 2026-04-15
license: CC BY 4.0
---

# InferLane: A Privacy-Attested Compute Marketplace with Four-Leg Economics

## Abstract

We describe InferLane, a privacy-attested compute marketplace for
large language model inference. InferLane exposes an OpenAI-compatible
proxy that routes workloads across centralized providers (Anthropic,
OpenAI, Google, Groq, xAI, Together, DeepSeek, and others) and
decentralized operator nodes attested via Intel TDX, AMD SEV-SNP,
NVIDIA Confidential Compute, Azure Attestation Service, Google
Confidential Space, and Apple Managed Device Attestation. A
double-entry ledger with append-only semantics and nightly
reconciliation serves as the money layer. We present a four-leg
revenue model — float yield on deposits, privately-negotiated
provider rebates, compute futures market spread, and premium SaaS
surfaces — which together fund a "free at the point of use" pricing
strategy for routine workloads. A router-level guarantee caps the
influence of rebates on decisions at 0.5% of the composite score so
revenue recognition never drives a worse routing decision. We
describe the threat model, the commitments the system makes to
buyers and operators, and the operational practices that support
those commitments.

## 1. Introduction

The contemporary LLM inference market exhibits a structural
margin stack that we informally call the "Inference Tax." A typical
retail API call passes through three layers of markup between the
buyer and the hardware: an application layer (agent tooling or
wrappers), a routing layer, and the provider's own margin over
cost-of-compute. This tax is particularly acute when the buyer's
workload is a poor fit for the chosen model — for example, a
reasoning model being asked to answer a classification question.

At the same time, the supply side exhibits large pools of idle
capacity that cannot be meaningfully monetized by their owners.
Consumer Apple Silicon Macs run 60B models at 30 watts; data-center
H100 and A100 pools sit below full utilization during off-peak
windows; consumer GPUs spend most of their lives idle. Current API
business models cannot reach this supply because consumer hardware
has no standard attestation surface, no payout rail, and no
reputation mechanism.

This paper presents InferLane, a system designed to bridge the two
sides. Buyers get near-rack-rate prices with cryptographically
attested privacy. Operators plug in existing hardware and receive
settlement in fiat or stablecoins. The marketplace operator
(InferLane itself) is funded by four independent revenue legs, none
of which requires charging routing fees.

## 2. System Overview

### 2.1 Components

- **Proxy router** — receives OpenAI-compatible requests, classifies
  them by complexity and privacy requirements, selects a provider
  or operator, and forwards the call.
- **Commercial router wrapper** — layers privacy-tier gating and
  rebate revenue recognition on top of the base router without
  altering its scoring math.
- **Attestation facade** — a vendor-neutral interface over Intel
  TDX, AMD SEV-SNP, NVIDIA CC, Azure Confidential VM, GCP
  Confidential Space, and Apple Silicon MDM attestation flows.
- **Double-entry ledger** — append-only `LedgerEntry` + `LedgerLeg`
  tables enforcing the per-entry invariant that debits equal
  credits, with nightly reconciliation.
- **Dispute engine** — a finite state machine that governs
  workload disputes with a 168-hour window, evidence handling,
  reviewer independence rules, and appeal workflow.
- **Treasury adapters** — pluggable integrations with licensed
  partners (Stripe Treasury for USD float, Fireblocks for USDT
  custody) so InferLane does not hold customer funds directly.
- **Node daemon** — a small Rust/Node binary that operators run on
  their compute nodes to advertise capabilities, heartbeat, and
  submit attestation bundles.

### 2.2 Request lifecycle

1. Buyer submits a workload through the OpenAI-compatible proxy.
2. Router classifies the request and selects a candidate provider
   or operator.
3. Commercial wrapper filters candidates by the requested privacy
   tier. Confidential-tier requests require a fresh VERIFIED
   attestation record on file for the chosen operator.
4. Router forwards the request. Result returns to the buyer.
5. Completion path debits buyer wallet, credits escrow (commit),
   then on successful completion splits the escrow into operator
   pending, platform fee, and reserve fund legs (87/10/3 for the
   standard tier; 92/5/3 for attested-hardware operators).
6. Rebate recognition records the delta between rack rate and the
   invoiced partnership rate as platform revenue.
7. Dispute window opens; 168 hours later, operator pending is
   released to the operator's payout account.

## 3. Four-Leg Economics

InferLane makes money from four independent sources, none of which
requires visible routing fees on routine buyer traffic.

### 3.1 Leg 1: Float on deposits

Buyers prefund wallet balances in USD or USDT. Funds are held in
FDIC-insured partner accounts via Stripe Treasury (USD) or
qualified-custodian accounts via Fireblocks (USDT). InferLane
captures the Treasury yield on the held balance. Operator pending
balances accumulate over the dispute window plus payout cycle
(typically 10–14 days), generating additional float. The 3%
reserve fund itself compounds.

At enterprise scale, per-customer float revenue can exceed visible
fee revenue. A $150K enterprise prefund at 4.5% yields $6,750/year
at near-zero marginal cost.

### 3.2 Leg 2: Provider rebates

InferLane negotiates volume rates with each upstream provider.
Rack rate is shown to buyers; we are invoiced at the partnership
rate; the delta accrues to platform revenue. Analogous to
payment-for-order-flow in equity markets: the "buyer" (upstream
provider) pays for flow because predictable flow has value.

Critically, the router's composite score cannot be overridden by
rebate presence. Rebate-based tiebreaking is permitted only when
two candidates are within 0.5% of each other on the score — a
hard guarantee enforced in `src/lib/proxy/router-commercial.ts`
and disclosed publicly at `/transparency`.

### 3.3 Leg 3: Compute futures market spread

InferLane runs a compute futures market where buyers can lock in
forward prices on inference capacity. Revenue from bid-ask spread
as market maker, settlement fees, and data-feed licensing to third
parties interested in compute price indices.

### 3.4 Leg 4: Premium SaaS surfaces

Pro, Enterprise, and Supplier tiers charge a monthly subscription
for advanced tooling (session history, chain builder, SSO, DPA
negotiation, dedicated capacity). Pure margin; independent of the
other three legs' rate-environment and negotiation dependencies;
valued at a higher multiple at fundraising time.

## 4. Privacy Tiers and Attestation

InferLane offers three privacy tiers per workload:

- **Transport Only**: TLS in flight, plaintext in operator memory.
- **Confidential**: execution inside a cryptographically attested
  Trusted Execution Environment. The operator cannot inspect
  inputs or outputs outside the TEE boundary.
- **Federated**: execution on the buyer's own hardware or on a
  decentralized node via the OpenClaw network.

### 4.1 Attestation facade

`src/lib/attestation/index.ts` dispatches to per-vendor verifiers:

- **Azure Confidential VM** via Microsoft Azure Attestation Service
  (MAA). JWT verification against MAA's pinned JWKS, issuer
  pinning to known regional endpoints, nonce binding, measurement
  enforcement, debuggable-TEE rejection.
- **GCP Confidential Space** via Google's attestation verifier.
- **Intel TDX** raw quote verification via DCAP.
- **AMD SEV-SNP** attestation report verification via AMD's
  vendor chain.
- **NVIDIA Confidential Compute** via NVML attestation.
- **Apple Silicon MDM**: Apple Managed Device Attestation, same
  chain Apple uses for Private Cloud Compute. Suitable for
  consumer Mac operators without custom hardware.

Each verdict is recorded as an immutable `AttestationRecord` row
with measurement hash, validity window, and verifier id. The
router gate reads from this table on every Confidential-tier
routing decision.

### 4.2 Nonce binding

Every attestation submission references a server-issued nonce
(from `/api/nodes/attestation/nonce`) that is one-time-use,
operator-bound, and 15-minute expiring. This prevents replay of
previously-valid attestations and forces fresh evidence
collection.

## 5. Money Layer

### 5.1 Double-entry ledger

Every money movement produces a single `LedgerEntry` header with
N `LedgerLeg` rows. The `checkBalance` function enforces that the
sum of debits equals the sum of credits before any write reaches
the database. The `reconcileLedger` cron re-verifies the invariant
nightly across the entire table.

Amounts are stored as `BigInt` USD cents. Rounding in the split
helper always rounds platform and reserve down so the operator
absorbs any remainder — we never overcharge the buyer by a cent.

### 5.2 Dispute engine

Disputes move through a finite state machine:

```
OPEN ──▶ EVIDENCE_REQUESTED ──▶ UNDER_REVIEW ──▶ RESOLVED_{BUYER|OPERATOR|SPLIT}
```

Evidence submission is opportunistic — once both buyer and
operator statements are on file, the case transitions to
UNDER_REVIEW automatically. Resolution composes the refund
ledger write with the DisputeCase row update in a single
database transaction, so partial-failure recovery is never
needed.

### 5.3 Appeal workflow

Either party may appeal within 7 days of resolution. Appeals are
reviewed by a panel of two reviewers (three for disputes ≥
$10,000) drawn from a pool that excludes the original decider.
Panel decisions to overturn issue a compensating `ADJUSTMENT`
ledger entry that correctly handles both directions of delta
(override higher or lower than original).

### 5.4 LEDGER_FREEZE kill switch

An environment variable `LEDGER_FREEZE=1` causes `postLedgerEntry`
to throw `LedgerFrozenError` on any new write. Compensating
`ADJUSTMENT` entries with an approver field are still permitted so
oncall can resolve incidents without fighting the kill switch.

## 6. Threat Model

InferLane follows a defense-in-depth threat model with each layer
assuming the next is compromised. A full STRIDE analysis is
published at `commercial/security/stride-threat-model.md`.

Key commitments:

- **Buyer data confidentiality** — Confidential tier enforces
  attestation; router refuses to route Confidential requests to
  non-attested providers; operator's hardware cannot read the
  data outside the TEE boundary.
- **Operator honesty** — capability declarations are audited
  against runtime measurements; attestation chains bind the
  advertised hardware to the actual execution substrate.
- **Money layer integrity** — append-only ledger with nightly
  reconciliation; invariant-violating writes throw before hitting
  the database; freeze kill switch available for incident
  response.
- **Symmetric protection** — both buyers and operators have the
  same dispute and appeal rights.

## 7. Operational Practices

- **Rate limiting** centrally administered via shared helper;
  per-route budgets sized to route workload.
- **Observability** via a vendor-neutral telemetry facade that
  sanitizes user-supplied strings and caps attribute length at
  2000 characters (ASVS V14.5.2).
- **Secrets management** via HKDF-derived keys from a master
  ENCRYPTION_KEY held in Vercel Secrets; envelope encryption
  facade with local and AWS KMS providers.
- **Nightly reconciliation cron** verifies ledger integrity and
  pages oncall on any imbalance.
- **Full ASVS Level 2 self-audit** published at
  `commercial/security/asvs-l2.md` with 56 PASS, 22 PARTIAL,
  0 FAIL as of this draft.

## 8. Related Work

RouteLLM (Ong et al., ICLR 2025) demonstrates preference-trained
router architectures that can deliver 2× cost reduction at 95%
quality retention. InferLane's classifier is hand-authored with
14 dimensions adapted from the BlockRunAI ClawRouter project
(MIT license, attribution preserved in source).

Darkbloom (Eigen Labs, 2026) demonstrates a successful
decentralized inference network with Apple Silicon attestation
via Managed Device Attestation. InferLane's multi-vendor
attestation facade includes `APPLE_SILICON_MDM` as one of six
supported types, positioning for hybrid operator onboarding.

Tether and Robinhood provide the economic templates for the
float and rebate legs respectively. Neither business model has
been previously applied to compute markets.

## 9. Status

All code described in this paper is live in the InferLane
commercial build repository. The Phase 4 DIY attestation verifiers
(TDX, SEV-SNP, NVIDIA CC, Apple MDM) are scaffolded with the real
implementations pending in Phase 4.2 / 4.3. Azure MAA is wired
with real JWKS verification. Stripe Treasury, Fireblocks, and
Solana payout adapters are in stub mode behind env-var kill
switches awaiting contract execution.

## 10. Conclusion

InferLane demonstrates that a privacy-attested compute marketplace
can be architected today using commercially available components:
managed TEE attestation services, licensed treasury partners,
standard payment rails, double-entry bookkeeping, and
vendor-neutral observability. The four-leg revenue model shows
that marketplace economics can support a "free at the surface"
pricing strategy without relying on subsidies or speculative
token mechanics. The open invitation is to the inference
ecosystem: bring your attested hardware, and we will route to it.

## Appendix A: Implementation Reference

- Repository: https://github.com/ComputeGauge/inferlane
- OpenAPI spec: https://inferlane.dev/api/openapi.json
- ASVS L2 audit: `commercial/security/asvs-l2.md`
- STRIDE threat model: `commercial/security/stride-threat-model.md`
- Transparency page: https://inferlane.dev/transparency
- Source of truth for splits: `src/lib/billing/escrow-ledger.ts`
- Attestation facade: `src/lib/attestation/index.ts`

## Appendix B: Version History

- 0.1 (2026-04-15) — Initial draft
