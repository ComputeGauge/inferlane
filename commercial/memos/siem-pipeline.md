---
document: SIEM / Log Shipping Pipeline Design
version: 1.0.0
status: Design — ready to build in Phase 1.6 window
drafted_by: Claude (AI)
drafted_at: 2026-04-15
covers: ASVS V7.1.4 (log access controlled) + V7.3 (time sync)
---

# SIEM Pipeline

## Goal

Route structured logs from every InferLane runtime environment to a
dedicated SIEM with independent IAM, ingestion authentication, and
retention control. Today logs live in Vercel's console; Vercel staff
have access by the nature of the hosting and we have no separate
audit role over them. ASVS V7.1.4 requires log access controlled
independently of the application.

## Options compared

### Option A — Grafana Cloud Logs (Loki + IAM)

- **Ingestion:** Vercel Log Drain → Grafana Cloud via HTTP.
- **Authentication:** API key per environment; Grafana IAM roles
  enforce who can query.
- **Retention:** configurable, 30d free tier / longer on paid.
- **Cost:** free tier covers dev, paid plan ~$8/month per 100GB.
- **Pros:** cheap, open source roots, good LogQL, Loki is the
  operations standard. Native Vercel Log Drain integration.
- **Cons:** query language is a learning curve.

### Option B — Datadog Logs

- **Ingestion:** Vercel Log Drain → Datadog HTTP.
- **Authentication:** API key + Datadog IAM.
- **Retention:** 15d / 30d / custom.
- **Cost:** starts at $0.10/GB ingested, premium features extra.
- **Pros:** polished UI, strong alerting, easy onboarding.
- **Cons:** expensive at scale; lock-in to their query language.

### Option C — Self-hosted OpenSearch

- **Ingestion:** Vercel Log Drain → our Fluentd / Vector proxy →
  OpenSearch.
- **Authentication:** OpenSearch IAM with fine-grained indices.
- **Cost:** ~$200/month for a small cluster on AWS.
- **Pros:** maximum control, no vendor lock-in.
- **Cons:** operational overhead; one more thing to run.

### Option D — Axiom

- **Ingestion:** Vercel Log Drain → Axiom HTTP.
- **Authentication:** Axiom IAM.
- **Retention:** flexible, tier-dependent.
- **Cost:** 500GB/mo free, paid plans reasonable.
- **Pros:** purpose-built for this exact flow; serverless pricing;
  great Vercel integration.
- **Cons:** smaller company than Grafana or Datadog.

## Decision

**Primary:** Grafana Cloud Logs (Loki).
**Secondary (archive):** S3 bucket via Vercel's S3 drain for 7-year
compliance retention.

### Why Grafana Cloud

- Good enough query language (LogQL) for our use cases.
- Open-source backing means we can move to self-hosted Loki later
  without a rewrite.
- Free tier covers the pre-launch window.
- Separate IAM from Vercel — tickbox for V7.1.4.
- Archive to S3 gives us ASVS V7.1.1 compliance on retention.

## Architecture

```
Vercel Function
  ↓ console.log (JSON line)
Vercel Log Drain
  ↓ HTTPS POST with InferLane API key
Grafana Cloud Loki
  ↓ LogQL queries
Grafana Cloud dashboard (read-only for ops, write for SRE)

Parallel:
Vercel Log Drain
  ↓ S3 drain (write-only IAM role)
S3 bucket with Object Lock
  ↓ lifecycle policy → Glacier at 90d, deleted at 7y
```

Key points:

- Two drains from the same log stream — loss of the primary doesn't
  lose data.
- S3 bucket has Object Lock enabled so logs cannot be deleted even
  by InferLane staff until the retention policy expires.
- Vercel → Grafana API key is rotated quarterly via Vercel's env
  secret rotation.
- SRE team has write access to Grafana; everyone else read-only.
- Alerting lives in Grafana; pages PagerDuty on severity patterns.

## Field schema

All logs are already JSON lines from the telemetry facade. We assign
Loki labels:

- `env` — production | staging | preview
- `service` — api | cron | mcp-server | node-daemon
- `route` — /api/fleet/sessions/:id/events (normalized)
- `level` — debug | info | warn | error
- `status` — HTTP status code (if applicable)

Labels are kept low-cardinality; high-cardinality fields (userId,
sessionId, requestId) go in the log body, not labels.

## Retention tiers

| Tier | Where | Duration | Reason |
|---|---|---|---|
| Hot | Grafana Cloud Loki | 30 days | Debugging, dashboards |
| Warm | S3 Standard-IA | 90 days | Incident investigation |
| Cold | S3 Glacier | 7 years | Tax / legal retention |

## Alerting

Initial rules in Grafana Cloud:

- **Error rate spike** — >10 errors/min for any route for 5min → page
- **Auth failures spike** — >50/min for 5min → page
- **Ledger imbalance error** — any occurrence → page (critical)
- **Attestation BAD_SIGNATURE** — any occurrence → page
- **Dispute opened** — any occurrence → notify #disputes channel
- **Rate limit 429s** — >500/5min → notify
- **Response latency p99** — >2s for 10min → notify

## Cost projection

Pre-launch (dev + preview + staging): free tier.

Launch (production, 10 req/sec avg, ~50GB/month): ~$5/month Grafana
Cloud Pro + ~$1/month S3 IA = $6/month.

Year 1 (100 req/sec avg, ~500GB/month): ~$50/month Grafana Cloud
Pro + ~$5/month S3 IA = $55/month.

## Hard gates

- [ ] Grafana Cloud account (free) — AI can sign up via the website
- [ ] Vercel Log Drain configuration — UI-only action on your
      dashboard; AI cannot do this for you
- [ ] S3 bucket with Object Lock — requires AWS account + bucket
      creation; AI cannot do this for you
- [ ] IAM role for Vercel → S3 — requires AWS IAM policy you
      create + attach

## Implementation checklist

1. Sign up for Grafana Cloud (free tier).
2. Create two Loki API keys: one write-only for Vercel, one
   read-only for dashboards.
3. In Vercel: Settings → Log Drains → add Grafana Cloud endpoint
   with the write-only key.
4. Create S3 bucket with Object Lock enabled, 7-year retention.
5. Create IAM role for Vercel with PutObject only on the bucket.
6. In Vercel: Settings → Log Drains → add S3 drain with that role.
7. Import InferLane dashboards from
   `commercial/observability/grafana-dashboards/` (to be authored
   in a future turn).
8. Configure alerting rules.
9. Do a failure-injection drill: trigger a ledger imbalance error
   and verify the page fires.

## References

- `src/lib/telemetry/index.ts` — log emission path
- `commercial/security/asvs-l2.md` — tracks V7.1.4
- [Vercel Log Drains docs](https://vercel.com/docs/observability/log-drains)
- [Grafana Cloud Loki](https://grafana.com/products/cloud/logs/)
