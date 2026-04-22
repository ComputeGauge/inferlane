# Privacy Policy

_Effective: 2026-04-22 · Last updated: 2026-04-22 · DRAFT — legal counsel review required before public launch_

This Privacy Policy describes what personal information we collect when you
use InferLane, how we use it, and the rights you have over it. It applies
to `inferlane.dev`, `inferlane.com.au`, the `@inferlane/mcp` package, the
Claude Code plugin, the node daemon, and any connected services
(collectively, the "Service").

If you only install the MCP plugin and use the local fuel gauge (no account
created, no cloud sync), very little of this policy applies — the data
stays on your machine. Details below.

## 1. What we collect

### 1.1 Data you give us

- **Account data**: email address, display name, organisation (optional)
- **Payment data**: processed entirely by Stripe; we never see your full
  card number. We receive a payment-method identifier, last 4 digits,
  country, and billing postcode for tax purposes.
- **Operator data**: if you run a node, we collect your Stripe Connect
  account identifier, tax residency, hardware specifications (GPU model,
  RAM), and regional information for routing. KYC data flows directly
  from Stripe Connect to their verification partners — we see only a
  pass/fail outcome.
- **Communications**: when you email us, post in the community Discord,
  or file a support ticket, we keep the messages and metadata.

### 1.2 Data we receive automatically

- **Usage metadata**: which API endpoints you call, when, from which IP
  address, which MCP tool triggered the call. We do NOT store prompt or
  response content when you use end-to-end encrypted routes.
- **Device data**: browser user-agent, operating system version,
  device identifiers (for fraud detection only), screen size (for
  responsive rendering).
- **Daemon telemetry**: for operators, we collect heartbeat signals
  (uptime, last-seen-at), aggregate throughput (tokens-per-second,
  concurrency), and error rates. We do NOT collect prompts, responses,
  or client identifiers from operator heartbeats.

### 1.3 Local-only data (never transmitted)

When you install the MCP plugin and run the local fuel gauge, the
following stays on your machine unless you explicitly enable cloud sync:

- Your Claude Code transcript file contents (read-only, for token counting)
- Your local SQLite database (`~/.inferlane/state.db`)
- Your budget configuration, provider API keys, routing policies
- Your aggregate spend history

We have no visibility into any of this unless you set
`INFERLANE_API_KEY` to enable cloud sync.

## 2. How we use what we collect

| Purpose | Examples | Lawful basis (GDPR) |
|---|---|---|
| **Run the Service** | Route inference, settle credits, issue payouts, keep you logged in | Contract |
| **Moderate abuse** | Apply AUP, investigate reports, terminate bad actors | Legitimate interest |
| **Security** | Detect fraud, protect accounts, prevent abuse | Legitimate interest |
| **Communicate with you** | Transactional emails, security alerts, service notices | Contract / Legitimate interest |
| **Improve the Service** | De-identified aggregate analytics, A/B tests on UI | Legitimate interest |
| **Comply with law** | Respond to subpoenas, meet tax reporting, NCMEC reporting | Legal obligation |
| **Marketing** | Community newsletter (opt-in only) | Consent |

## 3. What we don't do

- We do **not** train AI models on your prompts or responses
- We do **not** sell personal information to third parties
- We do **not** share your content with other operators or consumers
  beyond what's required to complete a specific inference request
- We do **not** access your local fuel-gauge data unless you enable
  cloud sync
- We do **not** use advertising cookies or third-party ad networks

## 4. Who we share with

- **Payment processors** (Stripe) for billing and payouts
- **Identity verification providers** (via Stripe Connect) for operator
  KYC
- **Cloud infrastructure** (Vercel, AWS, Cloudflare) for hosting and
  content delivery — they see encrypted data only
- **Analytics** (self-hosted Plausible or PostHog — never Google) for
  aggregate usage stats; no PII
- **Moderation partners** (OpenAI Moderation API, Anthropic Moderation
  API) — prompts are sent to them ONLY when routing through our hosted
  proxy (not E2EE routes). These providers are contractually restricted
  from using the data for training.
- **Law enforcement**, on receipt of a valid court order, subpoena, or
  equivalent legal process. We publish aggregate statistics in our
  annual transparency report.
- **Successors**, in the event of a merger, acquisition, or
  restructuring (with continued protection under this policy or a
  successor policy at least as protective).

We do not share data with anyone else without your explicit consent.

## 5. International transfers

We are based in Australia; some processors (Stripe, Cloudflare, Vercel)
are based in the United States, European Union, or other jurisdictions.
Transfers occur under:

- Standard Contractual Clauses (SCCs) where the recipient is in a
  non-adequacy jurisdiction under GDPR
- APEC Cross-Border Privacy Rules where applicable
- Equivalent safeguards for Australian Privacy Principles compliance

Request a copy of the SCCs at `privacy@inferlane.dev`.

## 6. How long we keep it

| Data type | Retention |
|---|---|
| Account profile | Duration of your account + 30 days after closure |
| Billing records | 7 years (tax law requirement) |
| Payout records | 7 years (tax law requirement) |
| Usage metadata (non-content) | 24 months |
| Abuse reports + moderation decisions | 5 years (safety) |
| Daemon telemetry (operator) | 12 months |
| Support correspondence | 24 months |
| KYC outcomes | 7 years post-closure (AML requirement) |
| Local fuel-gauge data | Until you delete it (on your machine) |

Deletion requests: see Section 9.

## 7. How we protect it

- TLS 1.3+ in transit; AES-256 at rest
- Credentials hashed with Argon2id or bcrypt (per OWASP current standard)
- Stripe holds all payment card data — we never do
- Role-based access control on staff access; audit logs retained 2 years
- Encryption keys rotated annually
- Incident response: we notify affected users within 72 hours of
  confirming a breach involving personal data
- Third-party penetration test annually (post-launch)

We can't guarantee absolute security, but we commit to the posture
above.

## 8. Cookies and similar tech

- **Essential cookies** (session auth, CSRF): required; can't opt out
  without breaking login
- **Analytics**: self-hosted Plausible, no third-party trackers, no
  cross-site tracking
- **No advertising cookies, no ad retargeting, no third-party analytics**

See our [Cookies page](./COOKIES.md) for the full list.

## 9. Your rights

Regardless of jurisdiction, you have the right to:

- **Access**: see what we have about you → `privacy@inferlane.dev`
- **Correct**: update inaccurate data in your account settings, or email us
- **Delete**: request deletion; we'll complete within 30 days except where
  law requires retention (e.g. tax records)
- **Export**: receive a machine-readable copy of your data
- **Restrict**: ask us to limit processing while we investigate a dispute
- **Object**: to marketing emails (click unsubscribe) or to legitimate-
  interest processing (email us)
- **Withdraw consent**: for anything we process on a consent basis
- **Complain**: to your local data protection authority (OAIC in
  Australia, ICO in UK, your national DPA in the EU, relevant state AG
  in the US)

Submit requests to `privacy@inferlane.dev`. We respond within 30 days
(GDPR) or 45 days (CCPA).

## 10. Children

The Service is not directed at children under 18. We do not knowingly
collect information from children. If we learn we've collected data
from a child, we delete it promptly. Contact
`privacy@inferlane.dev` to report.

## 11. Regional disclosures

### GDPR (EU / UK)

- **Data controller**: the legal entity operating `inferlane.dev`
- **Lawful basis** for each purpose: listed in Section 2
- **DPO**: not currently required under Article 37 thresholds; contact
  `privacy@inferlane.dev` for privacy matters

### CCPA / CPRA (California)

- **Categories collected** in the last 12 months: identifiers, commercial
  information, internet/electronic network activity, geolocation
  (approximate), professional information (for operators)
- **Sold or shared**: we do not "sell" or "share" personal information
  as those terms are defined under CCPA/CPRA
- **Right to opt out**: not applicable (we don't sell or share)
- **Authorized agent requests**: submit to `privacy@inferlane.dev` with
  proof of authorisation

### Australian Privacy Principles

- **Complaints**: email first, escalate to OAIC if unresolved in 30 days
- **Anonymity**: you can use the MCP plugin anonymously (no account
  needed for local-only mode)
- **Cross-border**: see Section 5

## 12. Changes to this policy

Material changes are announced at least 30 days before taking effect.
Continued use after the effective date constitutes acceptance.

## 13. Contact

- General: `privacy@inferlane.dev`
- Security incidents: `security@inferlane.dev`
- Data-protection authority escalation: as listed in Section 11

---

_Legal counsel review required before public launch. This draft covers
the operational posture but has not been audited for GDPR Article 28
processor addendum obligations, CCPA/CPRA-specific notices, APP
compliance, or jurisdiction-specific retention requirements. Engage
counsel in each primary market before going live._
