---
document: Seller (Operator) Agreement
version: 1.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
applies_to: independent operators selling compute via InferLane
---

# InferLane Operator Agreement

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Requires counsel
> review on independent contractor classification, tax withholding, and
> consumer protection rules before production use.

## 1. Parties

This Operator Agreement ("Agreement") is between **InferLane, Inc.**
("InferLane", "we") and the individual or entity operating compute
capacity and accepting workloads through the InferLane marketplace
("Operator", "you").

## 2. Independent contractor

You are an independent contractor operating a compute-provision
business. Nothing in this Agreement creates an employment,
partnership, joint venture, or agency relationship between you
and InferLane. In particular:

- **Control:** You determine your own hours of availability, the
  specific hardware you operate, the regions you serve, the
  privacy tiers you offer, and the maximum price you are willing
  to accept (within the platform's published floor). InferLane
  does not direct the manner or method of your work.
- **Usual course of business:** InferLane operates a technology
  platform that matches buyers of compute to independently
  operated compute providers. You provide compute services that
  are distinct from our platform business.
- **Independent trade:** You warrant that you are customarily
  engaged in an independently established trade, occupation, or
  business of the same nature as the work you perform under this
  Agreement. If you are an individual, you warrant that you
  operate through a registered entity (LLC, sole proprietorship
  with tax identification number, or equivalent) and will
  provide proof of business registration on request.
- **No exclusivity:** You are free to provide the same or similar
  compute services through other platforms, directly to
  customers, or otherwise, without restriction.
- **No training or direction:** InferLane does not require you to
  undergo proprietary training. Our onboarding verification
  (KYC, attestation suite) is a gatekeeping check, not a
  direction on how to perform your work.

You are solely responsible for your own taxes, benefits, workers'
compensation, licensing, insurance, and compliance with all
applicable labor and employment laws in your jurisdiction.

**Note for California operators:** This Agreement is drafted to
align with the California Labor Code § 2775 ABC test. Nothing in
this Agreement should be construed to create indicia of control
that would reclassify the relationship as employment under that
statute or any analogous law.

## 3. Onboarding requirements

Before accepting any paid workloads you must:

- Complete identity verification via our KYC partner (Stripe Identity).
- Complete a Stripe Connect onboarding for payouts.
- Declare your hardware, supported models, regions, and privacy tier.
- Pass our attestation test suite for any privacy tier you want to serve
  in the Confidential or Federated tiers.
- Accept these Terms and the InferLane Acceptable Use Policy.

## 4. Capability declarations and honesty

You warrant that:

- Hardware declarations (GPU model, memory, interconnect) are accurate.
- Model versions declared match what actually runs.
- Attestation reports are unmodified and signed by hardware you control.
- Latency class claims are consistent with measured performance.

Misrepresentation is a material breach and grounds for immediate
termination, forfeiture of pending balance, and referral to authorities
where fraud is suspected.

## 5. Service standards

- **Uptime:** You must respond to heartbeat checks within the
  interval you declare in your availability window. A breach is
  counted only after three consecutive missed heartbeats during
  a window where you have not manually paused. You may pause
  availability at any time without penalty.
- **Completion:** You must complete accepted workloads within
  their declared deadline, or signal failure within 60 seconds
  of detecting you cannot complete.
- **Latency consistency:** Latency class claims are measured at
  the p95 of your rolling 7-day workload history. Sustained
  latency exceeding 150% of your declared class over any two
  consecutive 7-day windows is grounds for tier downgrade.
- **Data handling:** Operators in Confidential tier must execute
  work inside an attested TEE boundary; decrypted data must
  never leave that boundary. Operators in the Transport-only
  tier must not retain inputs or outputs beyond the duration
  needed to complete the workload.
- **Logging:** You must retain execution logs for 30 days for
  dispute investigations (hashed or redacted as per the DPA).

## 6. Payment

- You are paid a percentage of the quoted buyer price based on your
  operator tier, for each completed and uncontested workload:
    - **Standard tier** — 87% to Operator; 10% platform fee;
      3% reserve fee.
    - **Attested tier** — 92% to Operator; 5% platform fee;
      3% reserve fee. Available to Operators who maintain a fresh
      VERIFIED attestation record on the InferLane attestation
      endpoint and accept the enhanced dispute liability described
      in Section 9.
- Tier assignment is re-evaluated at least monthly based on your
  attestation status and dispute history. We publish the live
  tier on your Operator dashboard.
- Payouts are made via Stripe Connect (or an equivalent regulated
  payout channel) on a weekly cadence after the dispute window
  expires for each workload. The dispute window is exactly 168
  hours from workload completion.
- Minimum payout threshold: USD 50. Balances below this roll
  forward to the next cycle.

## 6A. Insurance

For workloads served at the Confidential privacy tier, you shall
maintain general liability insurance with minimum coverage of
USD 1,000,000 per occurrence and USD 2,000,000 aggregate, and
cyber liability coverage with minimum USD 1,000,000 per claim.
Proof of coverage must be provided on request. This requirement
does not apply to Transport-only or Federated tier operators
below a USD 10,000 monthly payout threshold.

## 7. Taxes

You are solely responsible for reporting and paying all taxes on income
from the marketplace. InferLane issues Form 1099-NEC (US) or equivalent
where required.

## 8. Reserve fee

The 3% reserve fee is a platform fee charged in addition to the
base platform fee described in Section 6. It is not held in trust
for you and is not refundable to you individually. InferLane uses
the reserve fee to fund a loss-offset pool covering dispute
refunds, slashing offsets, and fraud losses. Aggregate inflow,
outflow, and balance of the pool are published on the operator
dashboard and the public Transparency page.

The reserve fee is InferLane's revenue at the time of collection.
It is not a deposit, trust, or escrow. Tax treatment: operators
may treat the reserve fee as an expense deductible from gross
marketplace income, consistent with Form 1099-NEC reporting
described in Section 7.

## 9. Disputes and slashing

If a Buyer opens a dispute and we find against you:

- The disputed amount is drawn from your pending balance or deducted from
  future earnings.
- For repeated or severe violations (fraud, capability misrepresentation,
  data exfiltration), we may slash reputation score and terminate you.
- You have 7 days to appeal any determination; appeals are reviewed by a
  second InferLane reviewer and our dispute committee.

## 10. Prohibited activities

You may not:

- Run workloads you have not been routed to via the marketplace.
- Retain, copy, or train models on Buyer data outside of what the privacy
  tier explicitly permits.
- Attempt to deanonymize buyers or correlate workloads across sessions.
- Sybil the reputation system with multiple unlinked operator accounts.
- Modify or spoof attestation reports.
- Collude with other Operators to set prices or degrade competitors.

Violation is a material breach and grounds for immediate termination,
forfeiture of pending balance, and legal action.

## 11. Intellectual property

You retain rights to your hardware, firmware, and operator software. You
grant InferLane no rights beyond those necessary to route workloads to
you, process settlement, and publish aggregate performance metrics.

## 12. Data protection

You are a Data Processor on behalf of the Buyer (the Data Controller). You
will sign the InferLane Data Processing Addendum and comply with its
terms for any workload tier that exposes Buyer data to you in plaintext.

## 13. Termination

- You may terminate by withdrawing your operator status with 7 days'
  notice, after completing all in-flight workloads.
- We may terminate you for breach, fraud, repeated disputes, or as
  required by law.
- Sections 4, 7, 8, 9, 10, 11, 12, 13, 14, 15 survive termination.

## 14. Limitation of liability

**[JURISDICTION-SPECIFIC — REQUIRES LAWYER TAILORING]**

Subject to applicable law, our aggregate liability to you is limited to
platform fees collected from you in the 12 months preceding the claim.

## 15. Governing law and disputes

**[REQUIRES LAWYER DECISION]** — expected default Delaware law, JAMS
arbitration in San Francisco.

---

## Review checklist (for counsel)

- [ ] Independent contractor classification reviewed for all jurisdictions
- [ ] 1099 / international tax reporting obligations confirmed
- [ ] Reserve fund structure reviewed under marketplace regulations
- [ ] Slashing provisions enforceable under applicable law
- [ ] Data Processor / DPA wording aligned with GDPR / CCPA
- [ ] Arbitration clause enforceable against small sellers
- [ ] Termination notice period appropriate
- [ ] Sanctions screening obligations documented
