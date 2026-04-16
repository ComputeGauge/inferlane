---
document: Hard Gates — What Only You Can Do
version: 1.0.0
status: Authoritative — this is the complete list
date: 2026-04-15
---

# What the AI Build Still Needs From You

Everything in this document is a true hard gate: either it requires
physical presence, a government filing, a signed contract, a
credit card, or a human decision. I've grouped them by urgency
relative to actually taking production traffic.

## Critical path — required before any real buyer money flows

### 1. Incorporate a Delaware C-corp (or equivalent)
- **Why:** You cannot open a business bank account, sign vendor
  contracts, or accept customer funds without a legal entity.
- **How:** Stripe Atlas ($500), Clerky ($799), or a lawyer's
  office ($1K-$3K). Allow 5-10 business days.
- **After:** You get an EIN, a Delaware file number, and a
  formation certificate. All downstream items need these.
- **Cost:** $500-$3K + $300/yr Delaware franchise tax

### 2. Open a business bank account
- **Why:** Operational cash needs to sit somewhere, and every
  vendor below requires one for payouts.
- **Recommended:** Mercury (fintech-friendly), Brex (startup
  stack), or a traditional bank if you want cyber insurance
  discounts later.
- **After:** You have an account number + routing that downstream
  services (Stripe, Fireblocks) can pay into.
- **Timeline:** 1-3 business days post-incorporation

### 3. Engage a fintech lawyer
- **Why:** The MSB determination memo
  (`commercial/memos/msb-determination.md`) lists 8 open questions
  a lawyer must answer before we can accept real USDT or handle
  large USD wallet balances. Until these are answered we cannot
  launch the wallet flow safely.
- **Recommended firms for fintech + AI marketplaces:**
  - Goodwin Procter (big firm, expensive, strong regulatory)
  - Cooley (startup-friendly, mid-market)
  - Wilson Sonsini (tech focus, good for later rounds)
  - Dechert (boutique, reasonable for early-stage)
  - Anderson Kill (marketplace-specific experience)
- **What to ask them (day 1):**
  - Review `commercial/memos/msb-determination.md` § 5 "Open
    questions for counsel" — 8 specific questions
  - Review all 8 drafts in `commercial/legal/` for production
    readiness (the drafts are there; they need a licensed
    attorney's edits and sign-off)
  - Identify the specific states where we trigger MTL
- **Cost:** $500-$1000/hr, expect $15K-$40K for the initial
  engagement
- **Timeline:** 2-4 weeks for initial review

### 4. Stripe Treasury KYB + activation
- **Why:** Treasury is the yield-bearing FDIC-insured account
  that holds buyer wallet balances — Leg 1 of the float model.
  The code adapter is already shipped; only a KYB review stands
  between stub mode and live.
- **How:** Apply via your Stripe Dashboard. Requires the
  Delaware C-corp + EIN + business bank + proof of address.
- **After:** Flip `STRIPE_TREASURY_ENABLED=1` in Vercel env and
  set `STRIPE_TREASURY_ACCOUNT_ID`. The adapter starts hitting
  the real API.
- **Timeline:** 2-8 weeks (Stripe's KYB is slow for new
  fintechs)

### 5. Sign a Fireblocks enterprise contract
- **Why:** Fireblocks is the recommended primary USDT custodian
  per `commercial/memos/tether-partner-selection.md`. Without
  it, the Tether adapter stays in stub mode and we cannot do
  global operator payouts.
- **How:** Sales-led contract. Expect 4-8 weeks from first
  contact to signature. They'll require the legal entity,
  financials, and a security questionnaire (which you can
  answer using the ASVS L2 self-audit I've already shipped).
- **Cost:** $5K-$50K/month base depending on volume tier
- **Alternative if Fireblocks declines or delays:** BitGo
  (second choice per the memo) or Anchorage.

## Required before Confidential-tier routing goes live

### 6. Replace the placeholder attestation pins
- **Why:** The attestation verifiers I shipped ship with
  PLACEHOLDER zero-hash pins for the Intel SGX Root CA, AMD
  ARK, and Apple App Attest root. Real deployments need real
  pins.
- **How (AI-runnable but needs the real certs):** Download the
  current root cert from each vendor and compute the SPKI
  SHA-256. Store in:
  - `commercial/pins/intel-sgx-root.sha256`
  - `commercial/pins/amd-ark-milan.sha256`
  - `commercial/pins/apple-appattest-root.sha256`
- **Env overrides** in Vercel:
  - `INFERLANE_INTEL_SGX_ROOT_PIN_HEX=...`
  - `INFERLANE_AMD_ARK_PIN_HEX=...`
  - `INFERLANE_APPLE_APPATTEST_ROOT_PIN_HEX=...`
- **Timeline:** 1 hour once you have the certs
- **What I need from you:** just run a curl against each
  vendor's root cert endpoint and paste the output somewhere I
  can read it. I can compute the hash.

### 7. Apple Developer Program membership ($99/yr)
- **Why:** Apple App Attest requires a Team ID + Bundle ID
  registered in the Apple Developer Program. The verifier
  needs `INFERLANE_APPLE_APPID_RP_HASH` set to
  `SHA-256("<teamId>.<bundleId>")`.
- **How:** Sign up at developer.apple.com with an Apple ID.
- **Timeline:** 1-2 days for the account review
- **After:** Register a Bundle ID, enable App Attest capability,
  ship the node-daemon binary to operators.

## Required before high-value workloads / enterprise customers

### 8. External penetration test
- **Why:** SOC 2 auditors expect one. Enterprise customers
  expect one. The ASVS L2 self-audit I ran is not a substitute
  for an adversarial engagement.
- **Recommended firms:**
  - Trail of Bits (strong technical depth, expensive $40K-$80K)
  - NCC Group (mid-market, good coverage $25K-$60K)
  - Cure53 (Europe-focused, mid-market $25K-$50K)
  - Bishop Fox (boutique, good at web + API $30K-$70K)
- **What to test:** Fleet API, Proxy API, Dispute API, Wallet
  API, Attestation API, the whole commercial surface I shipped
- **Timeline:** 3-6 weeks engagement + report
- **Cost:** $25K-$80K

### 9. Cyber liability insurance
- **Why:** Enterprise contracts routinely require $5M-$10M
  cyber liability coverage. Also covers your personal exposure
  as a founder.
- **Recommended brokers:** Embroker, Vouch, Coalition
- **Cost:** $5K-$25K/yr for the coverage most enterprise
  contracts demand

### 10. SOC 2 Type I kickoff
- **Why:** Enterprise sales will block on this. The readiness
  memo at `commercial/memos/soc2-readiness.md` has the full
  control mapping — most criteria are already met in code, but
  you need an actual auditor to attest to the design.
- **Recommended firms** (ranked in the memo): A-LIGN, Drata,
  Vanta, Prescient Assurance, Schellman
- **Cost:** $25K-$60K for Type I
- **Timeline:** 8-12 weeks from engagement to report
- **Prerequisite:** Entity incorporation (item 1)

## Optional but strongly recommended

### 11. MSB registration with FinCEN
- **Only if:** The lawyer determination comes back saying we
  trigger MSB status (likely only if we hold USDT directly or
  if Fireblocks' MSB coverage doesn't extend to our use case).
- **Cost:** Registration is free; filings and compliance are
  ongoing
- **Timeline:** Registration is immediate; state licenses take
  months each

### 12. State Money Transmitter Licenses
- **Only if:** Same condition as item 11
- **Cost:** $500K-$2M year one (surety bonds + filing fees +
  licensing agent + compliance officer)
- **Timeline:** 6-12 months to get all 40+ states

### 13. Apple Managed Device Attestation for enterprise Macs
- **Why:** If you want consumer Macs to participate as
  operators. Requires an MDM server (Jamf, Kandji) + Apple
  Business Manager.
- **Cost:** $500-$5K/yr depending on MDM vendor
- **Timeline:** 1-2 weeks to configure

### 14. TEE hardware access for end-to-end testing
- **Why:** The TDX, SEV-SNP, and NVIDIA CC verifiers I shipped
  are feature-complete per spec but haven't been tested against
  real Intel/AMD/NVIDIA-signed fixtures in-house.
- **Option A:** Azure Confidential VMs (TDX + SEV-SNP). Spin up
  an instance, grab a real attestation, feed it to our verifier.
  Cost: ~$50/day per instance.
- **Option B:** Phala Cloud, which provides TDX attestation
  endpoints for free (rate-limited).
- **Option C:** Buy a Sapphire Rapids workstation (~$5K-$10K).

## Things I cannot do for you, ever

- Sign contracts
- Transfer money
- Make legal opinions binding
- Pass a background check for KYB
- Physically attend meetings
- Make judgement calls on whether to accept specific
  risk/liability exposures
- Hire employees
- Answer to regulators on your behalf

## What happens when each gate opens

The moment any of the above lands, flip the corresponding env
var or config and the code is ready:

| Gate | Env variable(s) to flip |
|---|---|
| Entity incorporated | `INFERLANE_ENTITY_NAME` (for legal doc rendering) |
| Stripe Treasury live | `STRIPE_TREASURY_ENABLED=1` + `STRIPE_TREASURY_ACCOUNT_ID` |
| Fireblocks contracted | `FIREBLOCKS_ENABLED=1` + `FIREBLOCKS_API_KEY` + `FIREBLOCKS_PRIVATE_KEY` + `FIREBLOCKS_VAULT_ACCOUNT_ID` |
| Tether webhook partner contracted | `TETHER_WEBHOOK_ENABLED=1` + `TETHER_WEBHOOK_PUBLIC_KEY` |
| Solana payout partner contracted | `SOLANA_PAYOUT_ENABLED=1` + partner creds |
| Intel SGX Root CA cert obtained | `INFERLANE_INTEL_SGX_ROOT_PIN_HEX=<real hash>` |
| AMD ARK cert obtained | `INFERLANE_AMD_ARK_PIN_HEX=<real hash>` |
| Apple App Attest root obtained | `INFERLANE_APPLE_APPATTEST_ROOT_PIN_HEX=<real hash>` |
| Apple Developer Bundle ID registered | `INFERLANE_APPLE_APPID_RP_HASH=<real hash>` |
| Lawyer sign-off on legal docs | Remove "DRAFT" banners from `commercial/legal/*.md` and mirror to `/legal/*` on the site |
| Pen test passed | Add badge to `/transparency` page |
| SOC 2 Type I complete | Add badge; enable enterprise pricing tier |

None of these are code changes — they're runtime configuration
flips. The code is ready for all of them today.

## Summary

**Minimum viable launch (can accept paid buyers):**
- Items 1, 2, 3, 4 from the critical path
- Plus one pin (item 6) for whichever TEE vendor you want first
- Total time: 6-12 weeks, mostly waiting on Stripe KYB + lawyer
  review
- Total cost: $20K-$60K

**Full commercial launch with enterprise customers:**
- All of items 1-10
- Total time: 3-6 months
- Total cost: $100K-$300K

Everything else in the build is code and docs, which I can keep
grinding on without blocking.
