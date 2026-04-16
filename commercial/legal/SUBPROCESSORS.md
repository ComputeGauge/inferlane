---
document: Subprocessor List
version: 1.0.0
status: Authoritative — updated when our subprocessors change
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# InferLane Subprocessor List

This list names every third-party InferLane uses to process customer
data and satisfies the transparency requirement in our Data Processing
Addendum. Changes to this list are announced at least 14 days before
they take effect to all customers on an enterprise contract; non-
enterprise customers see updates via this document's commit history
and the CHANGELOG.

## Core platform

| Subprocessor | Purpose | Data processed | Location | Certifications |
|---|---|---|---|---|
| Vercel, Inc. | Application hosting, edge network, log drain | All request traffic, structured logs | Global edge + US regions | SOC 2 Type II, ISO 27001 |
| Neon, Inc. | Managed Postgres database | All persistent application data | US East (Virginia) | SOC 2 Type II |
| Upstash, Inc. | Redis rate limiting + cache | Rate-limit counters, dedup cache keys (hashed) | Global | SOC 2 Type II |

## Payments + identity

| Subprocessor | Purpose | Data processed | Location | Certifications |
|---|---|---|---|---|
| Stripe, Inc. | Payment processing (cards, ACH, Connect) | Payment details, billing addresses, Connect KYB | Global | PCI DSS Level 1, SOC 2 Type II |
| Stripe Identity | KYC verification for operators + high-value buyers | Government ID images, selfie, verification result | Global | PCI DSS, SOC 2 |

## Communications

| Subprocessor | Purpose | Data processed | Location | Certifications |
|---|---|---|---|---|
| Resend, Inc. | Transactional email (verification, receipts, alerts) | Email addresses, email content | US | SOC 2 Type II |

## Observability

| Subprocessor | Purpose | Data processed | Location | Certifications |
|---|---|---|---|---|
| Grafana Labs | Log aggregation (Loki), dashboards, alerting | Structured logs with hashed user identifiers | US + EU | SOC 2 Type II, ISO 27001 |
| AWS, Inc. | S3 Object Lock for long-term log retention | Structured logs (immutable) | US East | SOC 2 Type II, FedRAMP |

## Optional / planned

These subprocessors will be added to the list BEFORE they begin
processing customer data. They are listed here to be transparent
about the direction of travel. Enterprise customers will be
notified before they become active.

| Subprocessor | Purpose | Status |
|---|---|---|
| Fireblocks, Inc. | USDT custody for marketplace settlement in non-Stripe jurisdictions | Planned — Phase F4 |
| Google Cloud (Vertex AI Confidential Space) | Attestation verification for operators on GCP | Planned — Phase 4.1 |
| Microsoft Azure Attestation Service | Attestation verification for operators on Azure | Planned — Phase 4.1 |

## LLM providers

When you use InferLane's routing layer, your workload data may be
processed by whichever upstream LLM provider handles the request.
Providers are not technically subprocessors of InferLane — they
are counterparties you direct us to send work to — but for
transparency we list the set we currently route to:

| Provider | Data processed | Data retention per provider |
|---|---|---|
| Anthropic | Prompt + response content | Per Anthropic ToS (30 days for abuse monitoring, 0 training by default for API) |
| OpenAI | Prompt + response content | Per OpenAI API Terms (30 days for abuse, 0 training for API by default) |
| Google (Gemini) | Prompt + response content | Per Google AI Terms |
| Mistral | Prompt + response content | Per Mistral ToS |
| xAI (Grok) | Prompt + response content | Per xAI API Terms |
| Groq | Prompt + response content | Per Groq ToS |
| Together AI | Prompt + response content | Per Together AI ToS |
| DeepSeek | Prompt + response content | Per DeepSeek ToS |
| OpenClaw decentralized nodes | Prompt + response content | Depends on the specific node operator's declared capabilities + attestation |

When you route through InferLane, you are subject to the terms of
the provider handling each specific request. You can restrict
routing to specific providers via the `provider` parameter in your
API calls, or by setting allow-lists in your dashboard.

## Individual operator nodes

Operators are third-party compute providers selling through the
InferLane marketplace. Each operator is a Data Processor on behalf
of the Buyer (you). Operators are contractually bound by the
Operator Agreement which mirrors the data handling terms of the
InferLane DPA. At the Confidential privacy tier, operators process
data inside a Trusted Execution Environment and are
cryptographically prevented from retaining or exfiltrating data.

The full list of active operators is too dynamic to include here;
enterprise customers can request the current list from their
account contact.

## How changes are communicated

- 14-day notice for new subprocessors (enterprise)
- Email notification to account owners
- CHANGELOG entry at https://inferlane.dev/changelog
- Updates to this file in the public repo

## Objections

Enterprise customers may object to a new subprocessor under the
terms of their DPA. If we cannot resolve the objection, the
customer may terminate the affected services for cause.

## References

- `commercial/legal/DATA_PROCESSING_ADDENDUM.md` — full DPA
- `commercial/legal/PRIVACY_POLICY.md` — privacy commitments
- Contact: privacy@inferlane.dev
