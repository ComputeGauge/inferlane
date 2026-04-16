---
document: Dispute Resolution Policy
version: 1.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
applies_to: buyers and operators contesting workload outcomes on InferLane
---

# InferLane Dispute Resolution Policy

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Requires
> counsel review for consumer-protection carve-outs, SLA enforceability,
> and arbitration clause interaction before production use.

This policy describes how InferLane resolves disputes between buyers
and operators about workloads executed on the marketplace. It
complements (and does not replace) the dispute language in the Terms of
Service and the Operator Agreement.

## 1. Scope

This policy covers disputes about:

- Work that was incomplete, refused, or timed out.
- Work that was returned but produced substantively wrong or unusable
  output.
- Work where the operator misrepresented hardware, model version,
  region, or privacy tier capability.
- Work where TEE attestation failed, was stale, or did not match the
  required privacy tier.
- Work where latency claims were materially exceeded.
- Work where buyer data was mishandled by the operator (retention,
  exfiltration, training use).

This policy does NOT cover:

- Disagreements about subjective quality ("the poem wasn't creative
  enough"). These are out of scope; InferLane is not the judge of
  model quality.
- Pricing disputes. The quoted price at dispatch is final.
- Account access issues. Use the support channel for those.
- Claims against the buyer's upstream model provider (e.g., Anthropic,
  OpenAI). These should be raised with the provider directly.

## 2. Dispute window

A dispute must be opened within **168 hours (7 days) of workload
completion**. After the window expires:

- Funds escrowed for the workload are released to the operator.
- No dispute may be opened for that workload absent fraud or material
  misrepresentation, which have their own channel (Section 10).

## 3. How to open a dispute

Buyers open a dispute via:

- The dashboard: **Workloads → [workload] → Dispute**
- The API: `POST /api/disputes`
- The MCP tool: `dispute_open`

The dispute submission must include:

- The workload id.
- A reason code (see the enum in `src/lib/disputes/engine.ts`).
- A short factual description of what went wrong.
- Any evidence the buyer already has (output hash, latency reading,
  screenshots).

Once opened, InferLane places the workload's escrowed funds on hold and
notifies the operator.

## 4. Dispute lifecycle

1. **OPEN** — the dispute is created and both parties are notified.
2. **EVIDENCE_REQUESTED** — InferLane may request specific evidence
   (router logs, attestation reports, output samples). Both parties
   have 72 hours to respond.
3. **UNDER_REVIEW** — a dispute reviewer examines the evidence.
4. **RESOLVED** — the reviewer issues a determination (BUYER,
   OPERATOR, or SPLIT). The resolution includes a refund amount and
   reasoning.

All state changes and evidence submissions are appended to an
append-only audit log. Nothing is ever deleted.

## 5. Evidence

Acceptable evidence includes:

- **Router logs** — timestamped records of routing decisions, latency,
  retry history (automatically attached by InferLane).
- **Attestation logs** — TEE attestation verdicts and measurements
  (automatically attached if applicable).
- **Output samples** — the buyer's output for the workload, with
  redactions as needed.
- **Performance measurements** — latency, error codes, rate-limit
  signals.
- **Operator declarations** — the operator's version of events.

Evidence is stored by SHA-256 hash. The underlying content is kept in
object storage with a signed URL and expires 90 days after the dispute
is resolved, unless the dispute is referred to law enforcement or
escalated to an appeal.

## 6. Reviewer assignment

Disputes are assigned to a reviewer following these rules:

- A dispute involving an operator is not assigned to a reviewer who has
  any commercial relationship with that operator.
- Reviewers rotate on a round-robin basis to avoid patterns.
- Disputes over USD 10,000 are always reviewed by two reviewers who
  must agree before resolution.
- Disputes raising ATTESTATION_FAILED or DATA_HANDLING concerns are
  escalated to the security team before any resolution is issued.

## 7. Standard of proof

- **Buyer burden (initial):** the buyer must show on the balance of
  probabilities that the operator's work did not meet the declared
  tier, capability, or privacy posture.
- **Operator response:** the operator may produce evidence rebutting
  the claim. Silence is not an admission but weighs against the
  operator in the balance.
- **Reviewer determination:** the reviewer decides on a balance of
  probabilities using all available evidence, including InferLane's
  own logs, attestation records, and the operator's declared
  capabilities.

## 8. Possible outcomes

- **RESOLVED_BUYER** — full refund to the buyer's wallet. Funds come
  from operator pending balance if sufficient; otherwise from the
  reserve fund and charged back against the operator's future
  earnings.
- **RESOLVED_OPERATOR** — no refund. Escrow releases to the operator
  on the normal schedule.
- **RESOLVED_SPLIT** — partial refund. The reviewer specifies the
  split in percentage points, e.g. "50/50". The refund portion flows
  as RESOLVED_BUYER; the remainder as RESOLVED_OPERATOR.

In addition to monetary outcome, the reviewer may recommend:

- **Reputation adjustment** — operator reputation score is decreased.
- **Capability revocation** — operator temporarily loses the right to
  serve a specific privacy tier or model class.
- **Suspension** — operator is suspended pending further review.
- **Termination** — for severe or repeated violations.

## 9. Appeals

Either party may appeal a resolution within 7 days by submitting:

- The disputed resolution id.
- A written statement of why the outcome was incorrect.
- Any new evidence not previously submitted.

Appeals are reviewed by:

- A second reviewer (not the original).
- For disputes over USD 10,000, a panel of two reviewers plus a
  member of the InferLane dispute committee.

Appeal determinations are final for matters inside this policy. Nothing
in this policy forecloses the right of either party to pursue legal
remedies in the venue specified by the Terms of Service or Operator
Agreement.

## 10. Fraud and misrepresentation

Disputes that allege fraud, coordinated fraud, or Sybil behaviour are
not handled in the standard dispute workflow. They are referred
immediately to the InferLane trust & safety team and may result in:

- Account suspension without the 168h window applying.
- Referral to law enforcement.
- Retention of the affected funds pending investigation.
- Civil action to recover losses.

## 11. Transparency

InferLane publishes aggregate dispute metrics quarterly on its
transparency page, including:

- Number of disputes opened.
- Outcomes by category (BUYER / OPERATOR / SPLIT).
- Median time to resolution.
- Number of appeals and appeal reversal rate.

Individual disputes are never published; only aggregate counts.

## 12. Policy changes

Material changes to this policy will be notified at least 30 days in
advance to active buyers and operators. Changes required to address
imminent safety, legal, or fraud issues may take effect immediately
on notice.

---

## Review checklist (for counsel)

- [ ] Dispute window (168h) enforceable in consumer-protection
      jurisdictions
- [ ] Evidence retention (90 days) aligned with Privacy Policy
- [ ] Appeal finality clause enforceable against arbitration rights
- [ ] Reserve fund drawdown structure reviewed under marketplace
      regulations
- [ ] Reviewer independence provisions meet natural justice
      expectations
- [ ] Transparency reporting aligned with data minimisation
