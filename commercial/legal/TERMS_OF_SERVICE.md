---
document: Terms of Service
version: 2.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
applies_to: buyers of compute via the InferLane marketplace
---

# InferLane Terms of Service

> **DRAFT — NOT YET IN FORCE.** This document is an AI-generated first draft
> prepared for counsel review. It is not legal advice. Specific provisions
> (governing law, arbitration, limitation of liability caps) require
> jurisdiction-specific tailoring by a licensed attorney.

## 1. Parties and scope

These Terms of Service ("Terms") form a contract between **InferLane, Inc.**
(a Delaware corporation, "InferLane", "we", "us") and the individual or
entity accessing the InferLane marketplace or API ("Buyer", "you").

InferLane operates a marketplace connecting buyers of AI compute (inference,
embedding, and related workloads) with independent third-party sellers who
operate compute capacity ("Operators"). InferLane is not itself a provider
of AI compute for workloads routed to Operators; it is an intermediary.

### 1.1 Definitions

Capitalized terms used in these Terms have the following meanings:

- **"Acceptable Use Policy"** or **"AUP"** means the InferLane
  Acceptable Use Policy published at inferlane.dev/legal/aup.
- **"Attestation"** means a cryptographic verification of an
  Operator's Trusted Execution Environment identity, collected
  and validated by InferLane as described on the Transparency
  page.
- **"Confidential Tier"** means the privacy tier described in
  Section 4 that requires cryptographically attested execution.
- **"Dispute Window"** means the 168-hour (7-day) period
  following Workload completion during which a Buyer may open
  a dispute under Section 7.
- **"DPA"** means the InferLane Data Processing Addendum.
- **"Operator"** means a third-party provider of compute
  capacity that accepts Workloads routed through InferLane.
- **"Platform Fee"** means the percentage of Workload price
  retained by InferLane as described in Section 3.2.
- **"Privacy Policy"** means the InferLane Privacy Policy.
- **"Reserve Fee"** means the 3% component of the total fee
  described in Section 3.2, accrued to InferLane's reserve pool.
- **"Service"** means the InferLane marketplace and all
  associated APIs, dashboards, and tools.
- **"Transport-Only Tier"** means the privacy tier described in
  Section 4 that uses transport layer encryption without TEE
  attestation.
- **"Workload"** means an inference, embedding, or other
  computational task submitted by a Buyer via the Service.

## 2. Account registration and assent

You accept these Terms by (a) clicking the "I agree" checkbox
during account registration, (b) accessing the InferLane API
with a valid Bearer token issued after registration, or (c)
otherwise using the Service after being notified of these
Terms. Your acceptance is recorded with a timestamp, your user
identifier, and the authentication method used; we will produce
that record on reasonable written request.

- You must be at least 18 years old and authorized to enter
  binding contracts. If you are a natural person resident in
  the EEA and under 18, you may use the Service only with the
  written consent of a parent or legal guardian, which we may
  require you to produce on request.
- You must provide accurate registration information and keep
  it current.
- You are responsible for all activity under your account.
- We may require additional verification (including KYC for
  high-value users) via our identity verification partner
  (Stripe Identity).

## 3. Marketplace mechanics

### 3.1 Routing

When you submit a workload, InferLane's router selects one or more Operators
based on price, quality, latency, and your stated privacy tier. You authorize
InferLane to route your workload accordingly.

### 3.2 Pricing

Before you submit a Workload, we display the maximum price you
will pay, including any applicable taxes and platform fees. By
submitting the Workload you commit to that price. The final
invoiced amount will not exceed the displayed maximum.

InferLane's revenue is composed of a platform fee (currently
10% for Standard tier Operators, 5% for Attested tier Operators)
and a reserve fee (currently 3%). The remainder is settled to
the Operator who performed the work. Current percentages are
always shown on our Transparency page.

### 3.3 Settlement and refunds

- Funds settle into an escrow controlled by InferLane for a
  dispute window of exactly 168 hours (7 days) after work
  completion.
- Successful, uncontested work releases funds to the Operator
  after the dispute window expires.
- Disputes raised within the window pause settlement and are
  resolved per Section 7.

## 4. Privacy tiers

You may select a privacy tier per workload. Each tier specifies
the maximum exposure of your data to Operators:

- **Transport-only** — encrypted in transit, visible to the
  executing Operator's process memory under standard TLS
  termination.
- **Confidential (TEE)** — cryptographic attestation required;
  Operator cannot read inputs or outputs outside the Trusted
  Execution Environment boundary.
- **Federated** — inference occurs on your own hardware or a
  locally-hosted node; only results are returned.

InferLane will use commercially reasonable efforts to verify
Operator capabilities against your selected tier and to route
Workloads only to Operators whose verified capabilities meet or
exceed that tier. Operator attestations are logged and
independently verified, and a workload will not be routed to an
Operator whose attestation record does not satisfy the
Confidential tier requirements. Section 8 (Warranties and
disclaimers) does not limit the specific operational commitment
in this section.

## 5. Acceptable use

You agree not to submit workloads that:

- infringe intellectual property rights;
- violate export controls, sanctions, or applicable law;
- attempt to exploit or disrupt InferLane or Operator infrastructure;
- produce sexual content involving minors, credible threats of violence, or
  deliberate misinformation harming health or elections;
- circumvent the rate limits, attestation checks, or routing controls of
  this service.

InferLane may terminate or refuse any workload that violates this section.

## 6. Content and IP

- You retain all rights to inputs you submit.
- You retain all rights to outputs returned to you, subject to any licenses
  bundled with the underlying model (e.g., upstream model provider terms).
- InferLane does not train on your data. Operators in the Confidential tier
  are cryptographically prevented from retaining data beyond job execution.
- You grant InferLane a limited license to process your inputs solely to
  route, execute, and return the workload.

## 7. Dispute resolution (workload)

A dispute is opened when a Buyer believes work was defective,
incomplete, or produced by an Operator who misrepresented
capabilities.

Process:

1. Buyer submits a dispute within 168 hours of completion.
2. Funds for the disputed work remain in escrow.
3. InferLane reviews attestation records, router logs, and any
   quality evidence either party submits.
4. InferLane will use commercially reasonable efforts to issue a
   determination within 7 business days. Where additional
   evidence is needed, the determination may take up to 14
   business days and we will notify both parties.
5. Refunds are drawn from the Operator's pending balance first;
   shortfalls are covered by the reserve fund.
6. Either party may appeal a determination within 7 days of
   issuance. Appeals are reviewed by a panel of two or more
   reviewers who did not issue the original determination. The
   appeal process is described in our Dispute Resolution Policy.

## 8. Warranties and disclaimers

**WORK IS PERFORMED BY INDEPENDENT OPERATORS.** InferLane does not warrant
the accuracy, completeness, or fitness for any particular purpose of any
output. The service is provided "as is" to the fullest extent permitted by
law, except that InferLane warrants it will act with reasonable care in
operating the routing, attestation, and settlement layers.

## 9. Limitation of liability

**[JURISDICTION-SPECIFIC — REQUIRES LAWYER TAILORING]**

To the maximum extent permitted by applicable law, InferLane's
aggregate liability to you arising from or related to these
Terms is limited to the greater of (a) amounts paid by you to
InferLane in the 12 months preceding the claim, or (b) USD
1,000. Enterprise customers may negotiate a higher cap in a
signed order form.

This limitation does not apply to, and nothing in these Terms
limits:

- Liability that cannot be excluded under applicable law,
  including liability for death, personal injury, fraud,
  willful misconduct, or gross negligence.
- Your obligation to pay fees due under these Terms.
- Either party's indemnification obligations.

**Australian consumers:** Nothing in this Section 9 excludes,
restricts, or modifies any right, guarantee, or remedy under
the Competition and Consumer Act 2010 or Schedule 2 (Australian
Consumer Law). Where a right cannot be excluded, our liability
is, at our option, limited to the re-supply of the services or
the cost of re-supply.

**EU and UK consumers:** Nothing in this Section 9 excludes
liability for intentional misconduct, gross negligence, or any
other liability that cannot be excluded under applicable
consumer protection law, including the Consumer Rights
Directive (2011/83/EU), UK Consumer Rights Act 2015, and
equivalent member state implementations.

## 10. Indemnification

### 10.1 By you

You agree to defend, indemnify, and hold harmless InferLane
and its officers, directors, employees, and contractors from
any third-party claim arising from:

- Content you submit as inputs to the Service;
- Your use of outputs returned by the Service;
- Your breach of these Terms or the Acceptable Use Policy; or
- Your violation of any applicable law in your use of the
  Service.

### 10.2 By InferLane

InferLane will defend, indemnify, and hold harmless Buyer
against any third-party claim alleging that the Service as
provided by InferLane (excluding Buyer inputs and excluding
outputs insofar as the claim arises from Buyer's prompts)
directly infringes that third party's patent, copyright,
trademark, or trade secret. InferLane's obligation does not
apply to (a) use of the Service in combination with other
products or services not supplied by InferLane, (b) modified
versions of outputs, or (c) claims arising from Buyer's own
inputs.

### 10.3 Process

The indemnified party will promptly notify the indemnifying
party of any covered claim, grant reasonable control over the
defense and settlement (provided no settlement imposes
non-monetary obligations without consent), and provide
reasonable cooperation.

## 11. Termination

- You may terminate your account at any time.
- We may suspend or terminate your account for breach,
  suspected fraud, or as required by law.
- Sections 1 (parties), 3 (to the extent fees are outstanding),
  5 (Acceptable Use Policy violations are grounds for
  termination that survive for enforcement purposes), 6 (IP),
  8 (warranty disclaimers), 9 (limitation of liability),
  10 (indemnification), 11 (this termination section),
  12 (changes), 13 (governing law), 14 (force majeure),
  15 (notices), and 16 (miscellaneous) survive termination, as
  do any other provisions that by their nature should survive.

## 12. Changes to the Terms

We may update these Terms. Material changes will be notified at least 30
days in advance via email and the dashboard. Continued use after the
effective date constitutes acceptance.

## 13. Governing law and venue

**[REQUIRES LAWYER DECISION]** — Expected default: Delaware law, with
individual arbitration in San Francisco, CA, under JAMS rules, with a
class action waiver. **Not in force until finalized by counsel.**

## 14. Force majeure

Neither party is liable for any failure or delay in performance
caused by events beyond its reasonable control, including natural
disasters, acts of war, terrorism, civil disturbance, pandemic,
government actions, internet or telecommunications failures,
denial-of-service attacks, or failure of a third-party service
provider upon which the affected party reasonably depends (such
as Vercel, Stripe, or Neon). This section does not excuse
payment obligations for services already rendered.

## 15. Notices

Notices to InferLane must be sent to legal@inferlane.dev and,
where a physical address is specified on our website, by
registered mail to that address. Notices to you are given by
email to your registered address and through the dashboard;
notices are deemed received one business day after being sent.

## 16. Miscellaneous

- **Entire agreement.** These Terms, together with our Privacy
  Policy, Acceptable Use Policy, Dispute Resolution Policy,
  and any order form or statement of work you enter with us,
  constitute the entire agreement between you and InferLane
  regarding the subject matter. This section does not exclude
  liability for fraud or fraudulent misrepresentation.
- **Severability.** If any provision is held unenforceable,
  the remainder continues in full effect and the unenforceable
  provision is modified to the minimum extent necessary to be
  enforceable.
- **No waiver.** No waiver of any breach constitutes a waiver
  of any subsequent breach.
- **Assignment.** You may not assign these Terms without our
  prior written consent. We may assign these Terms to an
  affiliate or in connection with a merger, reorganization, or
  sale of all or substantially all of our assets.
- **No third-party beneficiaries.** These Terms create no
  rights in favor of third parties.
- **Independent contractors.** Nothing in these Terms creates a
  partnership, joint venture, agency, or employment
  relationship between the parties.

---

## Review checklist (for counsel)

Items marked ✓ are fixed in this draft per the deep legal
review (`LEGAL_REVIEW_DEEP.md`); items remain for counsel:

- [ ] Entity name and jurisdiction of incorporation confirmed
- [x] Platform fee and reserve percentages updated (Standard
      87/10/3 and Attested 92/5/3 disclosed)
- [x] Dispute window (168h) stated as exact, not "up to"
- [x] Privacy tier language consistent with DPA (§4 now
      explicitly preserved against the §8 disclaimer)
- [ ] Limitation of liability cap jurisdiction-tailored (floor
      raised from $100 to $1,000; ACL + EU/UK carve-outs added)
- [ ] Arbitration / class waiver enforceability reviewed
- [x] EU/UK consumer exceptions in §9
- [ ] Export control / sanctions clause reviewed (currently in
      AUP only)
- [x] Indemnification now mutual (IP claims)
- [x] Definitions section added
- [x] Force majeure, notices, severability, assignment added
- [x] Clickwrap assent mechanism described (implementation
      still required in the signup UI)
- [ ] Age minimum verified against jurisdictions served
- [ ] Governing law and arbitration venue selected
