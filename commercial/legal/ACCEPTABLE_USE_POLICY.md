---
document: Acceptable Use Policy
version: 1.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
applies_to: buyers and operators on the InferLane marketplace
---

# InferLane Acceptable Use Policy

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Counsel should
> confirm enforceability and that prohibited-content categories align
> with the underlying model providers' own policies and applicable law.

This Acceptable Use Policy ("AUP") defines the activities that are not
permitted on the InferLane marketplace. It applies to all users — buyers
of compute, operators selling compute, and anyone accessing the
marketplace API. Violating this AUP is a material breach of the Terms of
Service or Operator Agreement and may result in immediate suspension,
termination, forfeiture of pending balances, and referral to authorities.

## 1. Prohibited content

You may not submit, produce, distribute, or host content that:

- Depicts sexual content involving minors, or content that sexualizes
  minors in any form.
- Contains credible threats of violence against identified persons or
  groups.
- Facilitates or plans terrorism, mass casualty attacks, or genocide.
- Provides operational instructions for the synthesis of chemical,
  biological, radiological, or nuclear weapons.
- Contains malware, ransomware, or exploit code intended for deployment
  against systems you do not control.
- Infringes intellectual property rights, including generating derivative
  works trained on protected content in violation of license terms.

## 2. Prohibited uses

You may not use the marketplace to:

- Train or fine-tune a model using another party's Workload data.
- Attempt to extract model weights, training data, or system prompts of
  upstream models beyond what those models voluntarily disclose.
- Deanonymize any buyer or operator, or correlate Workloads across
  sessions to build profiles.
- Circumvent rate limits, attestation checks, routing controls, or
  billing.
- Operate a high-volume automated system that degrades service for
  others (denial-of-service by overuse).
- Use the service for automated mass-generation of misinformation,
  spam, or coordinated inauthentic content.
- Target individuals for harassment, doxxing, or stalking.
- Discriminate unlawfully against protected classes in automated
  decisions affecting employment, credit, housing, insurance, or access
  to public services.

## 3. Regulated applications — special rules

Certain application domains require additional controls. Using the
marketplace for these purposes without meeting the requirements below is
prohibited:

- **Medical diagnosis or treatment.** Requires clear disclosure to end
  users that outputs are not medical advice, human review of
  recommendations, and no processing of PHI outside a signed Business
  Associate Agreement (where applicable under HIPAA).
- **Legal advice.** Requires disclosure that outputs are not legal
  advice and review by a licensed attorney.
- **Financial advice.** Requires registration with applicable financial
  regulators (SEC, FINRA, ASIC, FCA, etc.) as relevant.
- **Employment decisions.** Requires compliance with NYC Local Law 144,
  EU AI Act Article 6 high-risk provisions, and equivalent.
- **Biometric identification.** Prohibited for remote real-time
  identification of individuals in public spaces except as authorized
  by law.
- **Elections and political campaigns.** Requires disclosure of AI
  generation in public-facing content per applicable law (e.g., several
  US states and the EU AI Act).

## 4. Operator-specific prohibitions

As an operator, you may not:

- Misrepresent hardware, model versions, supported privacy tiers, or
  region.
- Run workloads you were not routed to via the marketplace.
- Retain, copy, or transfer buyer Workload data beyond execution scope.
- Spoof, forge, or replay attestation reports.
- Collude with other operators to set prices or starve competitors.
- Operate multiple unlinked operator accounts to evade reputation
  scoring (Sybil behavior).

## 5. Security

You may not:

- Probe, scan, or test the vulnerability of any system or network
  connected to the marketplace without express written authorization.
- Interfere with or disrupt service or servers connected to the
  marketplace, or disobey any requirements, procedures, policies, or
  regulations of connected networks.
- Impersonate any person or entity, or misrepresent your affiliation
  with any person or entity.

Security research on your own account or on systems you control, with
timely responsible disclosure to security@inferlane.dev, is welcomed and
not prohibited under this section.

## 6. Export controls and sanctions

You may not use the marketplace:

- From a jurisdiction subject to comprehensive US sanctions (currently
  Cuba, Iran, North Korea, Syria, and the Crimea / DNR / LNR regions of
  Ukraine).
- On behalf of any person on the OFAC Specially Designated Nationals
  list, the UK HMT consolidated list, or the EU consolidated list.
- To develop nuclear, chemical, biological, or missile weapons.
- In a way that would violate applicable export control laws (EAR, ITAR,
  EU Dual-Use Regulation).

## 7. Reporting abuse

Report AUP violations to: abuse@inferlane.dev

Reports are reviewed within 1 business day and escalated within 4 hours
for imminent harm (child safety, credible violence threats, ongoing
attacks).

## 8. Enforcement

InferLane may at any time, without prior notice and in its sole
discretion, remove content or suspend access for any user who
violates this AUP. For material or repeated violations, InferLane
may:

- Terminate the account.
- Withhold operator pending balances up to the amount reasonably
  necessary to cover dispute refunds, investigation costs, and
  documented damages caused by the breach. This is a liquidated-
  damages provision, not a penalty, and is tied to actual loss.
- Report conduct to law enforcement where legally required or
  reasonably justified.
- Pursue civil or criminal remedies in cases of fraud, theft, or
  other unlawful conduct.
- Refer information to regulators as required by applicable law.

Nothing in this section limits InferLane's other rights under
the Terms of Service, the Operator Agreement, or applicable law.

## 9. Changes

Material changes to this AUP will be notified at least 30 days in
advance. Changes required to address imminent legal or safety issues may
take effect immediately on notice.

---

## Review checklist (for counsel)

- [ ] Prohibited content list aligned with upstream model provider AUPs
- [ ] Regulated application requirements aligned with jurisdictions served
- [ ] Sanctions jurisdiction list current
- [ ] Security research carve-out wording safe-harbor compliant
- [ ] Enforcement provisions enforceable
- [ ] Forfeiture of operator balances enforceable as contractual remedy
