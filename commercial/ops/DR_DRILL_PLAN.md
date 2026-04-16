---
document: Disaster Recovery Drill Plan
version: 1.0.0
status: Authoritative — run quarterly
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# Disaster Recovery Drill Plan

Closes the SOC 2 A1.3 gap identified in the readiness memo. This
document defines the quarterly DR drill — what we simulate, what
we verify, how we score, and what we document after.

## Quarterly drill schedule

| Quarter | Scenario | Owner | Duration |
|---|---|---|---|
| Q1 | Full database loss (Neon region outage) | SRE | 4 hours |
| Q2 | Vercel deploy rollback mid-incident | SRE | 2 hours |
| Q3 | Stripe Treasury partner lockout | Ops | 3 hours |
| Q4 | Key rotation across crypto + attestation pins | Security | 4 hours |

Each drill produces an after-action report in
`commercial/incidents/YYYY-Q#-dr-drill.md`.

## Q1 drill — Full database loss

### Scenario

Simulate the complete loss of the primary Neon database region.
We do not actually delete the production database; instead we
spin up a standby Neon branch from the latest PITR snapshot and
verify we can redirect the application to it within the RTO
window.

### RTO / RPO commitments

- **RTO (Recovery Time Objective):** 1 hour from detection
- **RPO (Recovery Point Objective):** 15 minutes of data loss
  (Neon's standard PITR granularity)

### Pre-drill checklist

- [ ] Announce the drill window 48 hours in advance
- [ ] Notify customer-facing status page: "Scheduled DR drill,
      no impact expected"
- [ ] Verify Neon PITR is enabled and the latest snapshot is
      within the RPO window
- [ ] Prepare a second Neon branch ready to promote
- [ ] Stage the DATABASE_URL env change in Vercel (without
      deploying)

### Drill steps

1. **T+0** — Declare the drill active. Pretend the primary DB
   is unreachable.
2. **T+5 min** — SRE starts the runbook, paged via PagerDuty
   simulation.
3. **T+10 min** — SRE opens an incident channel.
4. **T+15 min** — SRE creates a recovery Neon branch from the
   latest snapshot at (T-15 min).
5. **T+25 min** — SRE flips DATABASE_URL in Vercel to the
   recovery branch. Verify via `/status` that the database
   check passes.
6. **T+30 min** — Test the critical flows:
   - Sign in and load dashboard
   - Fetch wallet balance from `/api/wallet/balance`
   - Create a dispute from `/api/disputes`
   - Fetch dispute detail from `/api/disputes/:id`
   - Run ledger reconciliation from `/api/cron/reconcile-ledger`
7. **T+45 min** — Verify no data loss beyond the RPO window by
   comparing the last 30 minutes of operations against the
   pre-drill state.
8. **T+60 min** — Roll back to primary (DATABASE_URL restored).
9. **T+90 min** — After-action review begins.

### Grading rubric

- ☐ RTO met (60 min to full recovery)
- ☐ RPO met (≤15 min data loss)
- ☐ All critical flows tested
- ☐ Ledger reconciliation clean on recovery DB
- ☐ Incident channel was active and logged
- ☐ Status page updated
- ☐ After-action report written within 3 days

## Q2 drill — Vercel deploy rollback mid-incident

### Scenario

A bad deploy introduces a regression that affects production.
We practice rolling it back via Vercel one-click and verifying
the rollback restored behavior.

### Drill steps

1. Deploy a PR with an intentional regression (e.g., a
   feature flag that breaks wallet balance display).
2. Wait for the monitoring system to detect the regression.
3. SRE rolls back via Vercel dashboard.
4. Verify the rollback resolved the issue.
5. Document the time-to-rollback.

### Grading rubric

- ☐ Detection within 5 min of deploy
- ☐ Rollback within 10 min of detection
- ☐ Full rollback verification within 20 min
- ☐ No customer-impacting errors during rollback window

## Q3 drill — Stripe Treasury partner lockout

Runs the "Stripe Treasury account frozen" tabletop from
`commercial/ops/TABLETOP_SCENARIOS.md` Scenario 6 as a real
drill with simulated Stripe downtime.

### Grading rubric

- ☐ Maintenance mode activated within 30 min
- ☐ Customer + operator notifications within 2 hours
- ☐ Fireblocks fallback plan documented (if contracted)
- ☐ No wallet balances lost or corrupted during simulated outage

## Q4 drill — Key rotation

### Scenario

Practice rotating the master ENCRYPTION_KEY and each
attestation root pin.

### Drill steps

1. Generate a new ENCRYPTION_KEY.
2. Deploy with both old and new keys available; the envelope
   encryption facade should fall back to the old key for
   existing ciphertexts and use the new key for new encrypts.
3. Rotate the AMD ARK, Intel SGX Root, and Apple App Attest
   pins by reading the current vendor cert and computing SPKI
   SHA-256.
4. Update `INFERLANE_AMD_ARK_PIN_HEX`, etc.
5. Verify existing attestations still verify against the new
   pins.
6. Verify new attestations verify against the new pins.

### Grading rubric

- ☐ All legacy ciphertexts still decrypt
- ☐ All existing attestations still verify
- ☐ New writes use the new key/pin
- ☐ No downtime during rotation
- ☐ Rollback plan documented

## After-action report format

Each drill produces a markdown file in
`commercial/incidents/YYYY-Q#-dr-drill.md` with sections:

- Scenario
- Participants
- Timeline (exact timestamps)
- What went well
- What went wrong
- Action items (owner + due date)
- RTO/RPO achieved
- Recommendations for next drill

## Tooling

- **Status page:** `/status` (already shipped)
- **Incident channel:** Slack or equivalent
- **Pager:** PagerDuty or similar (pre-launch: founder's phone)
- **Drill tracking:** this document + individual reports

## What this drill plan does NOT cover

- Full data center loss on Vercel's side (we rely on Vercel's
  own DR guarantees)
- Cyber insurance claim filing (separate runbook when we have
  coverage)
- Legal notification to regulators (handled in Scenario 5 tabletop)

## References

- `commercial/ops/INCIDENT_RUNBOOK.md`
- `commercial/ops/TABLETOP_SCENARIOS.md`
- `commercial/memos/soc2-readiness.md` (A1.3 gap closed by this doc)
