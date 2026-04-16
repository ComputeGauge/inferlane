---
document: Incident Response Runbook
version: 1.0.0
status: Authoritative for InferLane SRE
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# InferLane Incident Runbook

## Severity levels

- **SEV-1** — Production outage affecting all users, money layer
  corruption, confirmed security breach, data exposure.
  **Response target:** 15 min page-to-ack, 1h mitigation, 24h RCA.
- **SEV-2** — Major feature broken for a subset of users, elevated
  error rate (>5% on proxy), dispute pipeline blocked, attestation
  verifier down. **Response target:** 30 min page-to-ack, 4h
  mitigation, 72h RCA.
- **SEV-3** — Minor degradation, non-critical cron failure, single
  customer impact. **Response target:** next business day.
- **SEV-4** — Cosmetic, documentation, or low-priority bug. Handled
  in normal sprint cadence.

## Paging matrix

| Signal | Severity |
|---|---|
| Ledger imbalance detected (reconcile-ledger cron) | SEV-1 |
| All proxy routes returning 5xx for >5 min | SEV-1 |
| Confirmed PII leak or credential exposure | SEV-1 |
| Suspicious authentication activity at scale | SEV-1 |
| Operator attestation BAD_SIGNATURE spike | SEV-1 |
| One provider's error rate >50% for >10 min | SEV-2 |
| Dispute engine returning 500s | SEV-2 |
| Rate limiter dropping >50% of legitimate requests | SEV-2 |
| Cron failure for 2 consecutive runs | SEV-3 |
| Dashboard loading slow (p99 >5s) | SEV-3 |

## First-hour checklist

When a SEV-1 fires:

1. **Acknowledge** the page within 15 min. Start the incident
   channel (#inc-YYYY-MM-DD-brief-name in Slack / equivalent).
2. **Assess the blast radius.** Is this one user, one route, one
   region, or the whole platform? Check Grafana dashboards first.
3. **Stop the bleeding.** Acceptable mitigations in priority order:
   - Rollback the last deploy (Vercel one-click).
   - Disable the affected feature via env var feature flag.
   - Rate-limit the abusive traffic source.
   - Scale down to reduce the surface area.
4. **Contain** — freeze writes on the money layer if ledger
   corruption is suspected (set LEDGER_FREEZE=1 env var — all
   postLedgerEntry calls will throw).
5. **Notify** — post to status page, send customer email for
   SEV-1 > 30 min.
6. **Preserve evidence** — snapshot logs, DB rows, Grafana panels.
7. **Call it** — once the mitigation is holding, declare the
   incident mitigated in the channel and schedule the RCA.

## Ledger imbalance protocol (SEV-1)

This is the most dangerous scenario because it means the money
layer is inconsistent. Strict protocol:

1. **Immediately** set `LEDGER_FREEZE=1` in Vercel production env.
   This causes `postLedgerEntry` to throw `LedgerFrozenError` on
   any new write.
2. Run the reconciliation manually:
   `curl -H "x-cron-secret: $CRON_SECRET" /api/cron/reconcile-ledger`
3. Identify the offending entry ids from the response sample.
4. **Do NOT** delete or update the offending rows. They are the
   evidence.
5. Open a TRI ticket with the entry ids, the settlement records
   they reference, and the timestamps.
6. If the cause is a known bug in a specific code path, roll back
   the deploy that introduced it. If the cause is unknown, keep
   the freeze in place until diagnosis is complete.
7. Compensating entries (type ADJUSTMENT) are the only way to fix
   the ledger once frozen. They require step-up re-auth + ADMIN
   role + two-person review.

(Note: `LEDGER_FREEZE` env check is a Phase 5.4 feature —
`postLedgerEntry` does not yet honor it. Tracked as a follow-up.)

## Attestation failure protocol (SEV-1/SEV-2)

If `BAD_SIGNATURE` outcomes start flooding in from `/api/nodes/attestation`:

- **First check:** is it one operator or many? A single operator is
  likely a compromised or misconfigured node — suspend them.
- **If many:** is it one attestation type? If every Azure MAA
  verification starts failing, Microsoft might have rotated JWKS
  and our cache is stale. Restart the function to flush the cache.
- **If all types:** something is wrong in our verifier path.
  Disable Confidential tier routing (set
  `CONFIDENTIAL_ROUTING_ENABLED=0`) so the router downgrades to
  Transport-only routing. Investigate.

## Credential rotation protocol

When `INFERLANE_API_KEY` rotation is needed (compromise, scheduled
annual):

1. Generate new key via `/api/api-keys` with step-up re-auth.
2. Deploy the new key to all production consumers (MCP server, node
   daemon, Vercel env vars).
3. Keep the old key active for a 24-hour grace window.
4. Revoke the old key.
5. Audit logs for any usage of the old key during the grace window
   to catch straggler consumers.

`ENCRYPTION_KEY` rotation:

- Is more complex — old ciphertexts were wrapped under the old key
  and need unwrap + rewrap before the old key is gone.
- Use the envelope encryption v1 key rotation procedure: KEK stays
  in place, DEKs are rewrapped. No ciphertext data movement.
- Step-by-step is in `commercial/ops/kek-rotation.md` (to be
  authored when the KMS provider is picked).

## Data exposure protocol (SEV-1)

If we suspect customer data has been exposed (log leakage, errant
database dump, unauthorized access):

1. Scope the exposure — how many users, what data fields,
   timeframe.
2. Contain — close the leak, rotate any affected credentials.
3. Notify the DPO (privacy@inferlane.dev) — within 1 hour.
4. Legal notification requirements per jurisdiction:
   - GDPR: 72 hours to supervisory authority, without undue delay
     to affected users if likely to result in high risk.
   - CCPA: "expedient" notice.
   - state breach notification laws: varying timelines.
5. Write the customer notification with legal review.
6. Post RCA publicly after resolution.

## Communication templates

### Status page (SEV-1 initial)

> **[Investigating] Elevated errors on the InferLane API**
>
> We're seeing elevated errors on our API as of HH:MM UTC.
> Impact: {affected surface}. We are investigating and will
> update in 15 minutes.

### Status page (mitigation)

> **[Identified] {brief root cause}**
>
> We've identified the cause as {brief}. Mitigation is in
> progress and affected customers will see recovery within
> {timeframe}.

### Customer email (SEV-1 > 30 min)

> We experienced an incident affecting the InferLane marketplace
> from HH:MM to HH:MM UTC today.
>
> **Impact:** {specific}
> **Cause:** {brief, non-speculative}
> **Resolution:** {what we did}
> **What's next:** We will publish a full post-mortem within 5
> business days at https://inferlane.dev/incidents/YYYY-MM-DD.

## RCA template

Every SEV-1 and SEV-2 generates a post-mortem at
`commercial/incidents/YYYY-MM-DD-brief-name.md` within 5 business
days. Sections:

- Summary
- Timeline (with exact timestamps)
- Impact (customers affected, duration, financial impact)
- Root cause (technical detail — no blaming people)
- What went well
- What went wrong
- What we're changing (action items with owners + due dates)

## On-call rotation

Pre-launch: solo founder is on-call 24/7. Acknowledge time is
best-effort overnight.

Post-launch: minimum 2-person rotation with weekly handoffs.
Paging via PagerDuty into Slack #oncall-alerts.

## Drill schedule

- **Monthly:** tabletop exercise of one SEV-1 scenario.
- **Quarterly:** full incident simulation including comms.
- **Annually:** disaster recovery exercise (full stack rebuild).

## References

- `commercial/security/stride-threat-model.md` — threat sources
- `commercial/security/asvs-l2.md` — security baseline
- `commercial/memos/siem-pipeline.md` — observability pipeline
  (where the alerts fire from)
- `src/lib/billing/escrow-ledger.ts` — reconciliation code
