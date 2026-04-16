---
document: Privacy Policy
version: 2.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-14
---

# InferLane Privacy Policy

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Requires counsel
> review for GDPR, CCPA/CPRA, PIPEDA, LGPD, and APPs jurisdiction
> applicability before production.

## 1. Who we are

InferLane, Inc. ("InferLane", "we"), a Delaware corporation, operates the
marketplace available at inferlane.dev and via our API. This policy
explains what personal information we collect, why, and what rights you
have.

## 2. Information we collect

**Account information:** name, email, password hash, API keys (hashed),
company name (optional).

**Identity verification:** when required (high-value users, operators) we
collect identity documents via Stripe Identity. We store only the
verification result and an attestation hash, not the raw documents.

**Billing information:** payment method tokens via Stripe; we never see
card numbers directly.

**Usage metadata:** request counts, latencies, routing decisions, model
used, token counts, privacy tier, IP address, user agent, timestamps.

**Workload inputs and outputs:** we process these to route and
return results. Our retention depends on the privacy tier you
select for each workload:

- **Confidential tier:** we do not log or retain Workload inputs
  or outputs. The Trusted Execution Environment is designed to
  prevent both InferLane and the executing Operator from reading
  Workload data outside the TEE boundary. We retain only
  metadata (request id, operator id, token counts, latency,
  outcome status, attestation hash) for the purposes described
  in Section 3.
- **Transport-only tier:** we may retain a hashed or redacted
  copy of inputs and outputs for up to 7 days for abuse
  detection, dispute investigation, and legal compliance. Copies
  not used for these purposes within 7 days are automatically
  deleted. Copies relevant to an open dispute or legal hold are
  retained until the dispute is resolved or the hold is lifted.
- **Federated tier:** Workload data is not transmitted to
  InferLane. Only metadata is retained.

## 3. How we use information

- Provide the marketplace (routing, settlement, delivery).
- Prevent fraud, abuse, and attacks (rate limiting, anomaly detection).
- Comply with legal obligations (tax, sanctions, lawful requests).
- Improve the service in aggregate (never using individual workload data
  to train models).
- Send transactional and service-related communications.

## 4. Legal bases (GDPR)

**[REQUIRES LAWYER CONFIRMATION]**

- Contract — providing the service you signed up for.
- Legitimate interests — fraud prevention, service security, analytics.
- Consent — optional marketing, optional analytics cookies.
- Legal obligation — tax, sanctions, lawful access.

## 5. Sharing

We share personal information only with:

- **Operators** — routed workload data, at the privacy tier you selected.
  Operators are contractually bound not to retain or repurpose your data.
- **Service providers** — Stripe (payments, identity), hosting providers
  (Vercel, Neon), observability (OpenTelemetry collector), email
  (Resend), under data processing agreements.
- **Authorities** — when legally compelled.

We do not sell personal information. We do not share for cross-context
behavioral advertising.

## 6. Data retention

- Account records: retained while your account is active.
- Usage metadata: 90 days rolling, then aggregated.
- Workload inputs/outputs: see Section 2.
- Financial records: 7 years (tax compliance).
- Identity verification results: 5 years or as required by MSB regulations.
- Audit logs: 7 years.

## 7. Your rights

Depending on jurisdiction, you may have the right to:

- Access the personal information we hold about you.
- Correct inaccurate information.
- Delete your information (subject to retention obligations above).
- Export your information in a portable format.
- Object to or restrict processing.
- Withdraw consent for optional processing.
- Lodge a complaint with a supervisory authority.

Contact privacy@inferlane.dev to exercise rights.

**Response timelines:**

- For GDPR / UK GDPR / Swiss FADP requests: we respond within 30
  days of receipt, extendable by up to 60 days for complex
  requests (Article 12(3)).
- For CCPA / CPRA requests from California consumers: we confirm
  receipt within 10 business days and respond within 45 days
  (extendable by a further 45 days on notice for complex
  requests).
- For other jurisdictions: we aim to respond within the shorter
  of 30 days or the deadline imposed by your local law.

## 8. International transfers

Data may be processed in the United States and the European
Economic Area. For transfers of Personal Data out of the EEA,
United Kingdom, or Switzerland, we rely on the European
Commission's Module Two Standard Contractual Clauses (2021/914)
together with the following supplementary measures:

- Encryption in transit (TLS 1.3 minimum) and at rest
  (AES-256-GCM with envelope encryption).
- Strong key management (HKDF-derived keys, KMS-managed key
  encryption keys).
- Contractual commitment to challenge overbroad law enforcement
  requests to the extent permitted by applicable law.
- Logging of any government access request at a level of detail
  sufficient to satisfy a data subject access request.
- Commitment not to voluntarily disclose Personal Data to law
  enforcement beyond what is legally required.

For transfers from the UK we incorporate the UK International
Data Transfer Addendum (IDTA). For transfers from Switzerland we
apply the FDPIC-approved version of the SCCs with references to
GDPR read as references to the Federal Act on Data Protection
where appropriate.

## 8A. Automated routing decisions

InferLane's router automatically classifies each Workload by
complexity and privacy requirements and selects an Operator
based on price, quality, latency, and your stated privacy tier.
This routing is governed by publicly-documented code and
explicit user preferences. You can set routing preferences or
restrict routing to specific providers via your dashboard.

We disclose this automated processing in the interest of
transparency under GDPR Article 13(2)(f). The processing is not
fully automated within the meaning of Article 22 because (a)
you can override routing via your preferences and (b) the
decision does not have a legal or similarly significant effect
on you as a natural person.

## 9. Security

- Encryption in transit (TLS 1.3 minimum).
- Encryption at rest (AES-256-GCM) for all primary stores.
- Envelope encryption with KMS-managed KEKs.
- Confidential-tier workloads run inside attested TEE boundaries.
- Access control via least privilege, audited.
- Regular security reviews (see our security page).

No system is perfectly secure. We will notify affected users and
authorities of material breaches as required by law.

## 10. Children

Our service is not directed at children under 16 (EEA) or 13 (US). We do
not knowingly collect data from children. If we learn we have, we
delete it.

## 11. Changes

We will notify users of material changes at least 30 days in advance.

## 12. Contact

InferLane, Inc.
Data Protection Officer: privacy@inferlane.dev
[Mailing address to be added after incorporation]

---

## Review checklist (for counsel)

- [ ] GDPR Article 13/14 notice completeness
- [ ] CCPA/CPRA "Do Not Sell / Do Not Share" language
- [ ] Australian Privacy Principles coverage
- [ ] LGPD / PIPEDA / UK GDPR coverage
- [ ] SCCs version and supplementary measures
- [ ] DPO appointment requirements per jurisdiction
- [ ] Retention periods appropriate per data category
- [ ] Breach notification timelines confirmed
