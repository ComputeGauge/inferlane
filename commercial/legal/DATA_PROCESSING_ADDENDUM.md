---
document: Data Processing Addendum (DPA)
version: 1.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
incorporates_by_reference: Standard Contractual Clauses (Module Two, 2021/914)
---

# InferLane Data Processing Addendum

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Requires
> counsel review for GDPR, UK GDPR, Swiss FADP, CCPA/CPRA, and
> jurisdiction-specific Module Two SCC annexes before production use.

## 1. Parties and scope

This Data Processing Addendum ("DPA") forms part of the Terms of Service
between **InferLane, Inc.** ("Processor") and the Customer identified in
the main agreement ("Controller") and governs Controller's Personal Data
processed by Processor when Controller uses the InferLane marketplace.

## 2. Definitions

Capitalized terms not defined here take the meanings given in the GDPR
or equivalent applicable data protection law.

- **Personal Data** — any information relating to an identified or
  identifiable natural person, as processed by Processor under this DPA.
- **Sub-processor** — a third party engaged by Processor to process
  Personal Data on behalf of Controller.
- **Workload** — an inference, embedding, or other computational task
  submitted by Controller via the marketplace.
- **Operator** — an independent third party selling compute through
  InferLane; an Operator is a Sub-processor for the purposes of this DPA.

## 3. Processing details (GDPR Article 28(3))

**Subject matter:** routing, execution, and return of Workloads submitted
by Controller to the InferLane marketplace.

**Duration:** the term of the main agreement plus any applicable
retention period described in Section 10.

**Nature and purpose:** receiving Workload requests, selecting and
routing to Operators, facilitating execution, returning results,
supporting settlement and disputes, preventing fraud, and complying with
legal obligations.

**Type of Personal Data:** account metadata (name, email, company),
Workload inputs (which may contain Personal Data at Controller's sole
discretion), Workload outputs, IP addresses, API key identifiers,
billing information (via Stripe), and identity verification results for
high-value users.

**Categories of Data Subjects:** Controller's end users, Controller's
employees, and any other data subjects whose Personal Data Controller
includes in Workload inputs.

## 4. Processor obligations

Processor will:

- Process Personal Data only on documented instructions from Controller,
  including with regard to transfers of Personal Data to third countries.
- Ensure persons authorized to process Personal Data are bound by
  confidentiality.
- Implement the security measures described in Annex II.
- Engage Sub-processors only under Section 6.
- Assist Controller in responding to Data Subject requests under Section 9.
- Assist Controller with Data Protection Impact Assessments and prior
  consultation to the extent required.
- Notify Controller of Personal Data Breaches under Section 8.
- Make available to Controller all information necessary to demonstrate
  compliance with Article 28 GDPR.
- Delete or return all Personal Data at the end of the provision of
  services, as specified in Section 10.

## 5. Controller instructions

Controller instructs Processor to:

- Route Workloads according to the privacy tier selected by Controller.
- Execute Workloads using Operators whose verified capabilities meet or
  exceed the selected privacy tier.
- Record metadata sufficient for billing, fraud prevention, and dispute
  resolution.
- Retain records as described in Section 10.

Additional instructions from Controller must be in writing and are
subject to Processor's right to charge reasonable fees for out-of-scope
processing.

## 6. Sub-processors

Processor uses the Sub-processors listed in Annex III. Processor may
engage additional Sub-processors subject to:

- Publication of the updated list at least 14 days before the change
  takes effect.
- Controller's right to object in writing within 14 days, in which case
  the parties will work in good faith to resolve the objection or
  terminate the affected Workloads.
- Binding the Sub-processor to data protection obligations no less
  protective than those in this DPA.

Operators are Sub-processors. Processor ensures Operators contractually
commit to:

- Processing Personal Data only to perform the assigned Workload.
- Not retaining Personal Data beyond Workload completion except as
  required by law.
- Not training models on Personal Data from Workloads.
- In the Confidential tier, processing Personal Data exclusively inside
  an attested Trusted Execution Environment.

## 7. International transfers

Where Personal Data is transferred outside the European Economic Area,
United Kingdom, or Switzerland, the transfer is governed by the Module
Two Standard Contractual Clauses (2021/914), incorporated by reference,
with:

- Clause 7 — docking clause: enabled.
- Clause 9(a) — sub-processor authorization: general authorization per
  Section 6 of this DPA.
- Clause 11(a) — redress: independent dispute resolution body not
  selected.
- Clause 17 — governing law: Ireland.
- Clause 18(b) — forum: Ireland.
- Annex I.A — Parties: as identified in the main agreement.
- Annex I.B — Description of transfer: as described in Section 3.
- Annex II — Technical and organisational measures: as described in
  Annex II of this DPA.
- Annex III — Sub-processors: as described in Annex III of this DPA.

For transfers from the United Kingdom, the UK International Data
Transfer Addendum (IDTA) is incorporated. For transfers from Switzerland,
the FDPIC-approved version of the SCCs applies with references to GDPR
read as references to FADP where appropriate.

## 8. Breach notification

Processor will notify Controller without undue delay and no later than
48 hours after becoming aware of a Personal Data Breach. The notification
will include, to the extent known:

- Nature of the breach, categories and approximate numbers affected.
- Likely consequences.
- Measures taken or proposed to address the breach.
- Contact point for further information.

## 9. Data subject rights

Processor will assist Controller in fulfilling Controller's obligations
to respond to requests from Data Subjects exercising their rights. Where
Processor receives a request directly, it will:

- Not respond to the Data Subject except on Controller's instruction or
  as required by law.
- Promptly forward the request to Controller.

## 10. Return or deletion

Within 30 days of termination of the main agreement, Processor will:

- Delete all Personal Data from active systems.
- Retain financial records, audit logs, and sanction screening records
  as required by applicable law (minimum 7 years for US federal tax,
  similar in most jurisdictions).
- Delete backups on their natural expiry cycle (maximum 90 days).

Controller may request a portable export of its Personal Data at any
time during the term.

## 11. Audits

Controller may audit Processor's compliance with this DPA:

- Once per year, on 30 days' written notice, during business hours.
- Subject to Processor's confidentiality and security requirements.
- With reasonable costs borne by Controller unless material
  non-compliance is found.

Processor will maintain SOC 2 Type II certification (target: year 2 of
operation) and share the report in lieu of on-site audits where the
scope is sufficient.

## 12. Liability

This DPA is subject to the limitation of liability clauses in the main
agreement, except where applicable law prohibits such limitation.

---

## Annex I — Parties

**Controller:** [Customer name, address, contact]

**Processor:** InferLane, Inc., [Delaware address — to be added],
privacy@inferlane.dev

## Annex II — Technical and organisational measures

### Encryption and cryptography

- TLS 1.3 minimum for all data in transit.
- AES-256-GCM for data at rest.
- Envelope encryption with KMS-managed key encryption keys.
- Confidential-tier Workloads run inside attested TEEs with hardware
  root-of-trust.

### Access control

- Least-privilege role-based access to all production systems.
- Multi-factor authentication required for all administrative accounts.
- Quarterly access reviews.

### Physical security

- Hosting via Vercel (SOC 2 Type II) and Neon (SOC 2 Type II).

### Pseudonymisation

- Workload inputs in non-Confidential tiers are redacted or hashed
  before storage for abuse detection.

### Resilience

- Daily backups with point-in-time recovery.
- Disaster recovery tested semi-annually.

### Testing and evaluation

- External penetration testing annually (once live traffic begins).
- Internal security reviews quarterly.
- Automated dependency scanning on every build.

### Incident response

- 24/7 on-call rotation for Severity 1 incidents.
- 48-hour breach notification SLA per Section 8.

### Data minimisation

- Confidential-tier metadata excludes Workload inputs and outputs.
- Logs are redacted of known sensitive patterns before storage.

## Annex III — Sub-processors

| Sub-processor | Service | Location | Role |
|---|---|---|---|
| Vercel, Inc. | Hosting, edge network | Global | Processor |
| Neon, Inc. | Managed Postgres | US | Processor |
| Stripe, Inc. | Payments, identity verification | US | Processor |
| Upstash, Inc. | Redis, rate limiting | Global | Processor |
| Operators | Workload execution | Per routing | Processor |

---

## Review checklist (for counsel)

- [ ] SCC Module Two annexes completed with actual party info
- [ ] UK IDTA and Swiss FADP references correct per jurisdiction served
- [ ] Sub-processor list verified (especially Operators category)
- [ ] Breach notification SLA achievable given on-call staffing
- [ ] TOMs in Annex II match actual deployed measures
- [ ] Retention periods aligned with Privacy Policy
- [ ] CCPA/CPRA service provider terms added (US customers)
- [ ] Audit clause scope reviewed for enterprise negotiation
