---
document: Record of Processing Activities (ROPA)
regulation: GDPR Article 30
version: 1.0.0
status: DRAFT -- requires DPO / counsel review
drafted_by: Claude (AI)
drafted_at: 2026-04-16
controller: InferLane, Inc.
dpo_contact: privacy@inferlane.dev
---

# Record of Processing Activities

GDPR Article 30 register for InferLane, Inc. This document maps every
processing activity to its purpose, legal basis, data categories,
recipients, international transfers, retention period, and technical
measures.

**Controller:** InferLane, Inc.
**DPO / Privacy Contact:** privacy@inferlane.dev
**Date of last review:** 2026-04-16

---

## Processing Activities Register

| # | Processing Activity | Data Categories | Data Subjects | Purpose | Legal Basis (Art. 6) | Recipients / Sub-processors | International Transfers | Retention Period | Technical Measures |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **User registration and authentication** | Name, email address, OAuth profile (avatar URL, provider account ID), OAuth tokens (access, refresh, id_token), session tokens, email verification timestamps | Users | Account creation, login, session management | Art. 6(1)(b) -- contract performance | Neon (DB), Vercel (hosting), Google/GitHub (OAuth providers) | Y -- US (Neon, Vercel). SCCs in place. | Active account + 30 days post-deletion. OAuth tokens: session lifetime. | TLS 1.3 in transit, AES-256 at rest, CSRF tokens, session expiry, RBAC |
| 2 | **API key management** | API key SHA-256 hash, key prefix (first 8 chars), key name, permissions JSON, last-used timestamp, expiry date | Users | Authenticate proxy/router API access | Art. 6(1)(b) -- contract performance | Neon (DB) | Y -- US. SCCs. | Until key revoked or account deleted. | Keys stored as SHA-256 hashes only -- raw key never persisted. RBAC on key creation/revocation. |
| 3 | **Provider connection management** | Provider type, encrypted API keys (AES-256), OAuth token references, sync status, display name | Users | Connect user accounts to upstream AI providers for spend tracking and routing | Art. 6(1)(b) -- contract performance | Neon (DB), upstream LLM providers (on user instruction) | Y -- US (Neon). Provider keys transmitted to provider APIs globally per user routing config. SCCs. | Until connection deleted or account deleted. | API keys AES-encrypted before storage. Envelope encryption with KMS. Never logged in plaintext. |
| 4 | **Proxy request routing** | Requested model, routed provider, routed model, routing reason, input/output token counts, cost (USD), latency (ms), status code, timestamp, API key ID, cost breakdown JSON | Users (via API keys) | Route inference requests to optimal provider, calculate cost, record savings | Art. 6(1)(b) -- contract; Art. 6(1)(f) -- legitimate interest (service improvement, fraud prevention) | Neon (DB), upstream LLM providers (prompt content in transit only -- not stored by InferLane) | Y -- US (Neon). Prompt content forwarded to provider regions globally. SCCs + provider DPAs. | 90 days for request logs. | Prompt content is transit-only (not persisted). Metadata logged without prompt content. TLS 1.3 for all upstream calls. Confidential tier uses TEE. |
| 5 | **Spend tracking and analytics** | Spend amounts (USD), token counts, request counts, model breakdown JSON, budget limits, budget usage percentages, period identifiers | Users | Cost monitoring, budget alerts, spend optimization recommendations | Art. 6(1)(b) -- contract; Art. 6(1)(f) -- legitimate interest (cost optimization) | Neon (DB) | Y -- US. SCCs. | 1 year, then aggregated and anonymised. | RBAC. Data scoped per user/team. No PII in aggregated snapshots beyond user ID. |
| 6 | **Usage records** | Provider, model, input/output/total tokens, cost (USD), latency, request type, timestamp | Users | Granular usage analytics, billing reconciliation | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | 1 year, then aggregated and anonymised. | Indexed by provider connection + timestamp. No prompt content stored. |
| 7 | **Scheduled prompt execution** | Prompt title, system prompt text, message content (JSON), model parameters, schedule type, cron expressions, execution results, token usage, cost | Users | Deferred and recurring prompt execution, cost optimisation via scheduling | Art. 6(1)(b) -- contract | Neon (DB), upstream LLM providers (at execution time) | Y -- US (Neon). Prompt content forwarded to providers at execution. SCCs. | Until user deletes prompt or account deleted. Execution results: 90 days. | Prompt content stored encrypted at rest (AES-256). Access restricted to owning user. Execution logs scoped per user. |
| 8 | **Prompt templates** | Template title, category, model, system prompt, messages JSON, parameters, auto-queue flag, usage count | Users | Reusable prompt storage for quick scheduling | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Until user deletes template or account deleted. | Encrypted at rest. User-scoped access only. |
| 9 | **Notification delivery** | Email address, Slack webhook URL, Telegram bot token + chat ID, Discord webhook URL, generic webhook URL, notification preferences (booleans) | Users | Alert delivery across user-chosen channels (budget alerts, trade notifications, payout confirmations, weekly digests) | Art. 6(1)(b) -- contract; Art. 6(1)(a) -- consent (marketing emails) | Neon (DB), Resend (email), Slack/Telegram/Discord (via user-provided webhooks) | Y -- US (Neon, Resend). Webhook destinations per user config. SCCs for Resend. | Until user removes channel config or account deleted. | Webhook URLs and bot tokens encrypted at rest. Marketing emails default OFF (opt-in). User can revoke channel config at any time. |
| 10 | **Payment processing** | Stripe customer ID, subscription ID, price ID, subscription tier/status, billing period dates, cancel-at-period-end flag | Users | Subscription billing, plan management | Art. 6(1)(b) -- contract; Art. 6(1)(c) -- legal obligation (tax records) | Stripe (PCI DSS Level 1), Neon (DB) | Y -- US (Stripe, Neon). SCCs. | 7 years for financial records (tax/regulatory). Active subscription data: account lifetime. | InferLane never stores full card numbers. Stripe handles PCI scope. Stripe IDs only in DB. |
| 11 | **Credit balance and marketplace** | Credit balances (allocated, available, delegated, earned), transaction history (amounts, counterparties, timestamps), offer details (price, quantity, status), pool delegations | Users | Prepaid compute credits, marketplace trading, pool delegation earnings | Art. 6(1)(b) -- contract | Neon (DB), Stripe (for purchases) | Y -- US. SCCs. | 7 years for financial transaction records. Active balances: account lifetime. | Sub-cent precision (Decimal 16,8). Append-only transaction log. Double-entry ledger integrity checks. |
| 12 | **Buyer wallet and deposits** | Wallet balance (available, reserved, deposited, spent), transaction history (source, external ID, amount, status, idempotency key), preferred currency | Users (buyers) | Wallet deposits, workload payments, refunds | Art. 6(1)(b) -- contract; Art. 6(1)(c) -- legal obligation | Neon (DB), Stripe (card/ACH), Tether (USDT -- planned) | Y -- US. SCCs. | 7 years for financial records. | Idempotency keys prevent duplicate charges. Ledger reconciliation nightly. |
| 13 | **KYC / Identity verification** | Stripe Identity session ID, KYC purpose, verification status, attestation hash, verified/rejected timestamps, rejection reason, expiry | Users (high-value buyers), Node operators (seller onboarding) | Regulatory compliance, fraud prevention, anti-money laundering | Art. 6(1)(c) -- legal obligation; Art. 6(1)(b) -- contract | Stripe Identity (processes government ID images, selfies -- InferLane stores only session ID and status) | Y -- US (Stripe). SCCs. | Session metadata: 7 years (regulatory). Stripe retains biometric data per its own retention policy. | InferLane never stores government ID images or biometric data -- only the verification session reference and outcome. |
| 14 | **Node operator management** | Display name, Stripe Connect account ID, payout enabled flag, pending/lifetime earnings, capabilities JSON, regions, privacy tier, TEE attestation status, reputation score, request/failure counts, latency, API endpoint, online status, heartbeat timestamps | Node operators | Operator registration, capacity management, earnings tracking, reputation scoring, payout processing | Art. 6(1)(b) -- contract | Neon (DB), Stripe Connect (payouts) | Y -- US (Neon, Stripe). Operator endpoints globally per operator location. SCCs. | Account lifetime + 7 years for financial records post-termination. | Stripe Connect Express for payouts. Reputation score calculated from verifiable metrics. API endpoint validated on registration. |
| 15 | **Node payouts and transactions** | Payout amounts, Stripe transfer IDs, payout status, period dates, request counts, transaction history (earnings, penalties, bonuses) | Node operators | Operator compensation, financial reconciliation | Art. 6(1)(b) -- contract; Art. 6(1)(c) -- legal obligation | Neon (DB), Stripe Connect | Y -- US. SCCs. | 7 years (financial records). | Append-only transaction log. Reconciliation against Stripe transfer records. |
| 16 | **Compute exchange (capacity offers and fills)** | Offer details (model, pricing, GPU type, memory, availability windows, attestation status), fill records (tokens, latency, costs, spread), provider type | Node operators (sellers), Users (buyers) | Marketplace for excess compute capacity -- matching buyers with sellers | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Offers: until expired/withdrawn. Fills: 7 years (financial records). | Attestation verification for TEE offers. Platform fee calculated transparently (spread in basis points). |
| 17 | **Compute trading (orders and futures)** | Order details (side, type, quality tier, quantity, price, fill status), futures contracts (strike price, delivery date, margin, settlement, P&L) | Users (traders) | Compute derivatives trading, hedging, price discovery | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | 7 years (financial records). | Margin/escrow held until settlement. Order matching engine with fill records. |
| 18 | **Settlement and ledger** | Double-entry ledger entries (event type, amounts in USD cents, account assignments), settlement records (lane, amount, status, escrow dates), trust snapshots | Users, Node operators | Financial settlement, escrow management, trust scoring, reconciliation | Art. 6(1)(b) -- contract; Art. 6(1)(c) -- legal obligation | Neon (DB) | Y -- US. SCCs. | 7 years (financial records). Ledger entries are append-only and never deleted. | Double-entry invariant enforced in application code. Nightly reconciliation job. Append-only ledger -- no UPDATE or DELETE. |
| 19 | **Disputes and appeals** | Dispute reason, description (buyer statement), amount at stake, evidence (content hash, signed URL), reviewer decisions, refund amounts, appeal statements | Users (buyers), Node operators, Reviewers (internal) | Dispute resolution, refund processing, quality enforcement | Art. 6(1)(b) -- contract; Art. 6(1)(f) -- legitimate interest (platform integrity) | Neon (DB), AWS S3 (evidence storage) | Y -- US. SCCs. | 7 years (financial/legal records). Evidence files: retained for dispute window + 1 year. | Evidence stored as content hashes. Signed URLs for time-limited access. Panel review for appeals. |
| 20 | **Analytics (PostHog)** | Anonymised usage events (no PII sent to PostHog). Consent preference cookie. | Users, Visitors | Product analytics, feature usage understanding | Art. 6(1)(a) -- consent (opt-in via cookie banner) | PostHog | Y -- US (PostHog Cloud). SCCs. | 1 year (PostHog retention). Consent cookie: 1 year. | No PII transmitted. Consent-gated -- cookies not placed until user opts in. Consent withdrawable at any time via account settings. |
| 21 | **Waitlist collection** | Email address, acquisition source | Visitors (prospective users) | Pre-launch interest capture, product launch notifications | Art. 6(1)(a) -- consent (voluntary submission) | Neon (DB) | Y -- US. SCCs. | 12 months, then deleted unless user creates an account. | Email stored in isolation from other user data. Unsubscribe honoured on request. |
| 22 | **Affiliate and referral tracking** | User ID (optional), provider, campaign ID, partner ID, source, destination URL, conversion status/timestamp, commission amount | Users, Visitors | Attribution of signups to referral sources, commission tracking | Art. 6(1)(f) -- legitimate interest (business operations); Art. 6(1)(b) -- contract (partner agreements) | Neon (DB) | Y -- US. SCCs. | 7 years (financial records for commissions). Non-converting clicks: 1 year. | Referral cookie (`il_partner`): 90 days. No sensitive PII beyond user ID linkage. |
| 23 | **Partner management** | Partner name, slug, callback key hash (bcrypt), revenue share percentage, contact email | Partners (integration partners) | Partner onboarding, revenue share tracking, API authentication | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Partner agreement lifetime + 7 years post-termination. | Callback keys stored as bcrypt hashes -- never in plaintext. |
| 24 | **Audit logging** | User ID, action, resource, details JSON, IP address, timestamp | Users, Admins | Security monitoring, compliance, forensic investigation | Art. 6(1)(c) -- legal obligation (compliance with sanctions/export controls); Art. 6(1)(f) -- legitimate interest (security) | Neon (DB), Grafana Loki (log aggregation), AWS S3 Object Lock (long-term retention) | Y -- US. SCCs. | 7 years. | Append-only. User IDs hashed in external log systems. IP addresses retained for compliance screening. S3 Object Lock for immutability. |
| 25 | **Fleet session tracking** | External session ID, runtime type, agent name/version, model, task title, lifecycle timestamps, active/idle runtime (ms), aggregated costs (token, runtime, web search), token counts, message/tool call counts, metadata JSON | Users | Multi-agent session cost tracking, fleet budget management | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | 1 year, then aggregated. | Costs aggregated per session. No prompt content stored in fleet records -- only metadata and cost totals. Budget guardrails enforced at fleet level. |
| 26 | **Privacy policy and canary management** | Policy name, privacy tier, allowed regions, TEE requirements, fragment counts, PII stripping flag, canary tokens, canary detection events | Users | User-configurable routing privacy controls, data leakage detection via canary injection | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Account lifetime. Canary events: 1 year. | Canary tokens are unique per user/request. Detection events trigger alerts. Privacy tiers enforce routing constraints. |
| 27 | **GPU cluster management** | Cluster name, agent token, GPU count/model/VRAM, electricity cost, hardware cost, amortization, location, online status, heartbeat, GPU metrics (utilization, memory, power, temperature, inference count, cost-per-token) | Users (self-hosted GPU operators) | On-premises GPU cost tracking, TCO calculation, utilisation monitoring | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Account lifetime. Metrics: 1 year, then aggregated. | Agent tokens unique per cluster. Metrics time-series indexed for dashboards. |
| 28 | **Team and governance** | Team name, slug, member roles (owner/admin/member/viewer), membership timestamps | Users | Multi-user team management, RBAC | Art. 6(1)(b) -- contract | Neon (DB) | Y -- US. SCCs. | Team lifetime. Membership records: until member removed or team deleted. | Role-based access control enforced at application layer. |
| 29 | **Alerts and budget management** | Alert type, provider, threshold, current value, message, channel, active/triggered status | Users | Budget monitoring, spend anomaly detection, provider health alerts | Art. 6(1)(b) -- contract | Neon (DB), notification channels (per activity #9) | Y -- US. SCCs. | Account lifetime. Triggered alert history: 1 year. | Alert thresholds user-configurable. ML-based anomaly detection for cost spikes. |
| 30 | **Provider recommendations** | From/to provider, task type, estimated monthly savings, savings percentage, dismissed/clicked status | Users | Cost optimisation suggestions | Art. 6(1)(f) -- legitimate interest (helping users reduce costs) | Neon (DB) | Y -- US. SCCs. | 1 year. Dismissed recommendations purged after 90 days. | No PII beyond user ID linkage. Recommendations are advisory -- user controls all routing. |
| 31 | **Promotion intelligence** | Provider, promotion title/type, source URL, dates, eligibility, multipliers, peak/off-peak windows, confidence score | N/A (no personal data) | Track AI provider promotions to optimise user costs | Art. 6(1)(f) -- legitimate interest | Neon (DB) | Y -- US. SCCs. | Until promotion expires + 90 days. | No personal data processed. Public promotional information only. |

---

## Notes

1. **Prompt content in transit:** When InferLane routes a proxy request,
   prompt content passes through InferLane's infrastructure to the
   selected LLM provider. InferLane does NOT store prompt content after
   delivery. At the Confidential privacy tier, prompt content is
   fragmented or processed inside a TEE such that InferLane cannot access
   it in plaintext.

2. **Scheduled prompts are an exception:** Unlike proxy requests,
   scheduled prompts and prompt templates DO store user-provided prompt
   content persistently (encrypted at rest) because they must be
   available for future execution.

3. **LLM providers as recipients:** When users route through InferLane,
   prompt content is forwarded to the selected upstream provider
   (Anthropic, OpenAI, Google, Mistral, xAI, Groq, Together, DeepSeek,
   decentralised nodes). Each provider's own data retention policy
   applies to content they receive. Users can restrict routing to
   specific providers.

4. **All international transfers** are to the United States and are
   covered by Standard Contractual Clauses (Module Two, 2021/914). See
   `DATA_PROCESSING_ADDENDUM.md` for the full SCC framework.

5. **Double-entry ledger integrity:** Financial records in the ledger
   are append-only. The sum of DEBIT legs equals the sum of CREDIT legs
   for every entry, enforced in application code and verified nightly.

---

## Review checklist

- [ ] Verify all processing activities are current against codebase
- [ ] Confirm retention periods match Privacy Policy (page.tsx)
- [ ] Validate sub-processor list matches SUBPROCESSORS.md
- [ ] DPO / counsel sign-off
- [ ] Schedule next review (recommend: quarterly or on schema change)
- [ ] File with supervisory authority if required by jurisdiction
