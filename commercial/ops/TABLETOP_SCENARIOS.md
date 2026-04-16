---
document: Incident Tabletop Scenarios
version: 1.0.0
status: Authoritative — use for monthly drills
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# Incident Tabletop Scenarios

Ten scripted scenarios for monthly tabletop exercises, aligned with
`commercial/ops/INCIDENT_RUNBOOK.md`. Each has a description, the
"correct" response steps, and a grading rubric for facilitators.

Run these monthly per the drill schedule in the runbook. Rotate
scenarios so the team doesn't memorize the answers.

---

## Scenario 1 — Ledger imbalance detected overnight

**Time:** 03:15 UTC, Tuesday

**Trigger:** `/api/cron/reconcile-ledger` reports 3 violations across
a 15-minute window. Oncall is paged.

**Facts:**
- All three violations are `WORKLOAD_COMPLETE` entries from the
  same operator (`op_beta_42`).
- Imbalance on each: +$142.87 (credits exceed debits).
- The operator had 1,842 successful workloads in the same window.

**Correct response:**

1. Acknowledge the page within 15 min, start the incident channel.
2. Immediately set `LEDGER_FREEZE=1` in Vercel env — stop any new
   ledger writes.
3. Re-run reconcile-ledger manually to confirm the violations
   haven't grown.
4. Do NOT delete or modify the offending rows — they are evidence.
5. Query the ledger_legs for the affected groupIds to see which
   leg is wrong.
6. Identify whether the bug is in `splitWorkloadPayment` (static
   math) or in the settlement record generation (router path).
7. If the bug is a code regression, roll back the most recent
   deploy via Vercel one-click.
8. Compensating ADJUSTMENT entries restore balance — require
   step-up `ledger.adjust` + admin role + dual approval.
9. Unfreeze the ledger only after two separate engineers
   independently verify reconciliation passes.

**Grading rubric:**
- ☐ LEDGER_FREEZE set within 5 min of page
- ☐ Evidence preserved (no DELETE or UPDATE on offending rows)
- ☐ Root cause identified before compensating entries written
- ☐ Compensating entries have `approvedBy` + dual review
- ☐ Status page updated within 30 min

---

## Scenario 2 — Stripe webhook flood from an attacker

**Time:** 14:00 UTC, Wednesday

**Trigger:** `/api/webhooks/stripe-deposits` receiving 200 req/sec
with signatures that don't verify.

**Facts:**
- Vercel function log shows 12,000 requests in 60 seconds.
- All requests fail signature verification (expected — the
  rate-limit is keeping the DB safe, but bandwidth + logs are
  getting burned).
- No database writes attempted.
- No money at risk.

**Correct response:**

1. Acknowledge within 15 min.
2. Identify source IP / AS range from Vercel firewall logs.
3. Add a firewall rule at the Vercel edge to block the source.
4. Confirm rate limiting + signature verification are holding —
   they should be.
5. Check that our Stripe webhook retry backoff hasn't gotten the
   legit endpoint throttled.
6. Do NOT disable the webhook — that breaks legit deposits.
7. Post-mortem: was the attacker targeting a specific endpoint?
   What signature format were they trying?

**Grading rubric:**
- ☐ Firewall rule applied within 10 min
- ☐ Verified no DB writes (`LedgerEntry` count unchanged)
- ☐ Verified legit webhook delivery still working
- ☐ Did NOT disable the webhook endpoint

---

## Scenario 3 — Attestation BAD_SIGNATURE spike from one operator

**Time:** 22:30 UTC, Friday

**Trigger:** `/api/nodes/attestation` receiving 40 BAD_SIGNATURE
verdicts from a single operator (`op_prod_gamma_9`) in 10 minutes.
Normal is <1 per day for this operator.

**Facts:**
- Same operator had 100% VERIFIED attestations for 3 months prior.
- Current workloads from them are failing Confidential-tier gate.
- The operator is serving 12% of current Confidential tier traffic.

**Correct response:**

1. Acknowledge within 15 min.
2. **Suspect compromise.** Set operator's `payoutEnabled = false`
   and route no new Confidential workloads to them.
3. Notify the operator via their registered contact that we've
   paused routing and are investigating.
4. Check whether other operators are also failing — is the
   attestation service (Azure MAA / our verifier) broken?
5. If just this operator: inspect the exact BAD_SIGNATURE reason.
   Is it cert chain? Nonce? Signature?
6. If cert chain: check the operator's VCEK hasn't been rotated
   or revoked.
7. If nonce: check the operator daemon's clock drift.
8. If signature: treat as likely compromise; hold pending funds
   in escrow until resolved.

**Grading rubric:**
- ☐ Operator paused within 10 min
- ☐ Legit traffic shed to other operators
- ☐ Customer communication to the operator
- ☐ Root cause categorized (infra vs compromise)

---

## Scenario 4 — Credential leak: API key posted publicly

**Time:** 09:00 UTC, Monday

**Trigger:** GitHub secret scanning alert — a customer committed an
`il_live_*` API key to a public repo.

**Facts:**
- Key belongs to customer `user_corp_99`.
- Key has been live for 18 days, 420K requests.
- The public commit is 45 minutes old.

**Correct response:**

1. Immediately revoke the key.
2. Force-rotate any dependent resources (linked Stripe Customer
   subscriptions, dispatched tasks).
3. Notify the customer via their verified contact.
4. Audit the key's activity window for suspicious usage patterns
   (requests from unexpected IPs, unusual geographies, volume
   spikes).
5. If suspicious activity: freeze the wallet, notify customer,
   initiate a forensic export of recent requests.
6. Help the customer generate a replacement key via step-up flow.
7. Document whether the leak vector is user error or a product
   issue (e.g., we showed the raw key somewhere it shouldn't have
   persisted).

**Grading rubric:**
- ☐ Key revoked within 2 min of alert
- ☐ Customer notified within 10 min
- ☐ Audit log pulled for the key's lifetime
- ☐ Suspicious-activity assessment completed

---

## Scenario 5 — Data exposure via a misconfigured log drain

**Time:** 11:00 UTC, Thursday

**Trigger:** An engineer notices that a log line in Grafana Cloud
contains a full prompt body including what appears to be PII from
a buyer.

**Facts:**
- The log line came from a new route shipped last week.
- Grafana Cloud has 4 external users from an audit firm who
  currently have read access.
- The prompt body contains an email address and phone number for
  what appears to be a third party (not the caller).

**Correct response:**

1. Classify as SEV-1 data exposure.
2. Scope: how many similar log lines, which time window, which
   route.
3. Contain: patch the route to stop logging the prompt body.
4. Purge: Grafana Cloud retention is typically 30d, but we need
   to expedite deletion of the affected lines if we have that
   capability.
5. Rotate audit firm access — revoke until the cleanup completes.
6. Notify the DPO within 1 hour.
7. Check GDPR / CCPA notification requirements: is the exposed
   data subject to breach notification?
8. Draft customer notification if the affected data is
   identifiable.
9. Full RCA on why the route logged the body.

**Grading rubric:**
- ☐ Classified as SEV-1 within 15 min
- ☐ Route patched within 1 hour
- ☐ DPO notified within 1 hour
- ☐ Scope assessment completed within 4 hours
- ☐ Decision on customer notification made within 24 hours

---

## Scenario 6 — Stripe Treasury account frozen without warning

**Time:** 08:00 UTC, Friday

**Trigger:** Stripe Treasury API starts returning 403 on every
request. Customer support response: "Your account is under
review."

**Facts:**
- $142K USD currently in buyer wallet balances.
- $47K in operator pending.
- Stripe hasn't given a specific reason; says review takes 3-10
  business days.
- Buyers can't top up; operators can't be paid out.

**Correct response:**

1. Escalate to Stripe via the Treasury-specific support line.
2. Meanwhile, set the wallet top-up route to maintenance mode
   (503 for new deposits with a clear message).
3. Pause operator payouts but do NOT delete or modify pending
   balances in the ledger.
4. Communicate with affected customers and operators: explicit
   timeline, promise of interim workaround.
5. If delay exceeds 72 hours: activate the Fireblocks path for
   USDT operator payouts in parallel.
6. If delay exceeds 7 days: initiate legal escalation with Stripe.
7. Post-resolution: review whether we were violating any Stripe
   Treasury ToS clauses.

**Grading rubric:**
- ☐ Maintenance mode activated within 30 min
- ☐ Customer + operator notifications within 2 hours
- ☐ Escalation to Stripe Treasury support initiated
- ☐ Fireblocks fallback plan documented

---

## Scenario 7 — Dispute fraud: coordinated buyer refund campaign

**Time:** Rolling, noticed Tuesday morning

**Trigger:** Reviewer notices 15 disputes opened in 3 hours, all
from newly-created accounts, all against the same operator, all
claiming the same "WORK_INCOMPLETE" reason.

**Facts:**
- Accounts are 1-3 days old.
- All from the same /24 IP block.
- Workloads all completed with 200 OK per router logs.
- Operator has 99.4% historical completion rate.

**Correct response:**

1. Escalate to the trust & safety team (per runbook §10 fraud).
2. Do NOT process any of the refunds pending investigation.
3. Suspend the accounts pending investigation.
4. Hold the operator harmless — flag the disputes as likely
   fraudulent.
5. Check whether these accounts share other signals (same
   device fingerprint, same email domain, same billing card).
6. Pull the original workload inputs/outputs (if permitted by
   privacy tier) for forensic review.
7. Report to authorities if coordinated fraud is confirmed.
8. Notify the operator of the suspected attack and the
   protection we're applying.

**Grading rubric:**
- ☐ Refunds blocked within 1 hour
- ☐ Accounts suspended within 2 hours
- ☐ Cross-account correlation check done
- ☐ Operator notified within 4 hours

---

## Scenario 8 — Public vulnerability disclosure (0-day) in Next.js

**Time:** Any, pushed via security.txt

**Trigger:** A security researcher reports a vulnerability in the
version of Next.js we're running that allows authentication bypass
under specific conditions.

**Facts:**
- Researcher has posted a PoC to the public responsible disclosure
  list but is waiting 48 hours before full public disclosure.
- Our Vercel deploys use Next.js 16.1.6.
- The vulnerability affects all versions ≥ 16.1.0.

**Correct response:**

1. Acknowledge via security@inferlane.dev within the SLA from
   security.txt (2 business days; aim for <4 hours).
2. Verify the PoC works against our production endpoints
   (carefully, in a test environment).
3. Patch by upgrading Next.js to the fixed version OR by adding
   a WAF rule at the Vercel edge that blocks the specific
   exploit pattern.
4. Deploy the fix.
5. Re-verify exploit no longer works.
6. Thank the researcher and credit them in the CHANGELOG if
   they consent.
7. Internal RCA: should we have been running the latest patch
   version? Did our dependency scanner catch this?

**Grading rubric:**
- ☐ Acknowledgment within 4 hours
- ☐ Fix deployed within 24 hours
- ☐ Public disclosure coordinated with researcher
- ☐ Dependency scanner updated to catch similar in future

---

## Scenario 9 — Regulatory inquiry (subpoena or similar)

**Time:** 10:00 UTC, Monday

**Trigger:** Email from an agent of a US Attorney's office
requesting records related to a specific user account,
referencing an ongoing investigation.

**Facts:**
- The request is a Grand Jury subpoena for account metadata and
  financial records.
- The target account is `user_corp_77`.
- The subpoena is properly executed and legally valid.

**Correct response:**

1. Do NOT delete, modify, or notify the user (non-disclosure
   provisions are common on grand jury subpoenas).
2. Engage counsel IMMEDIATELY. Do not respond without legal
   review.
3. Log the request in the internal legal tracker (not the
   main audit log — those are customer-visible).
4. Scope the data: exactly what does the subpoena cover? Do
   NOT over-comply.
5. Produce only what's required, in the format specified.
6. Retain a copy for our internal records (7 years).
7. Bill the customer for response time if the subpoena permits
   (rare but sometimes allowed).

**Grading rubric:**
- ☐ Counsel engaged within 4 hours
- ☐ No accidental user notification
- ☐ Scope pushback if request is overbroad
- ☐ Response delivered within the subpoena deadline

---

## Scenario 10 — Apple MDM attestation chain pin rotation

**Time:** 16:00 UTC, Monday

**Trigger:** Apple announces rotation of the App Attestation Root CA
with a 60-day transition window. Our pinned SPKI hash is now
outdated.

**Facts:**
- 2,400 Apple Silicon operators currently attested against the
  old pin.
- The old root expires in 60 days.
- The new root is already signing fresh attestations.

**Correct response:**

1. Note in the runbook that this is a scheduled rotation, not
   an incident.
2. Pull Apple's published new root certificate.
3. Compute its SPKI SHA-256 hash.
4. Update `commercial/pins/apple-appattest-root.sha256` or
   set `INFERLANE_APPLE_APPATTEST_ROOT_PIN_HEX` in env.
5. Test: a fresh attestation from a known operator should
   VERIFY against the new pin.
6. Deploy the pin update.
7. Consider a transition window where we accept BOTH pins
   (requires code change to `verifyAppleChain`).
8. Email affected operators about the required cert update.

**Grading rubric:**
- ☐ New pin captured within 24 hours of Apple's announcement
- ☐ Deployed within 1 week (well before 60-day deadline)
- ☐ Transition period during which both pins are accepted
- ☐ Operator communication before any rejections happen

---

## Facilitation notes

- Each scenario takes 30-45 min to walk through in a group.
- Rotate roles: one person reads the scenario, others respond.
- Focus on decision points, not execution details — the runbook
  has the technical steps.
- Score the grading rubric collectively.
- If a rubric item fails, open a ticket to close the gap before
  the next drill.

## References

- `commercial/ops/INCIDENT_RUNBOOK.md`
- `commercial/security/asvs-l2.md`
- `commercial/security/stride-threat-model.md`
- `commercial/security/red-team-audit.md`
