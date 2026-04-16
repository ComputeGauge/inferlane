---
document: AI Red-Team Audit — Commercial Build
version: 1.0.0
status: Authoritative — AI self-review, NOT a substitute for pen test
auditor: Claude (AI)
audited_at: 2026-04-15
scope: src/lib/billing, src/lib/disputes, src/lib/attestation, src/lib/security,
       src/lib/wallets, src/lib/payouts, src/app/api/disputes, src/app/api/wallet,
       src/app/api/appeals, src/app/api/privacy, src/app/api/webhooks
---

# AI Red-Team Audit

Claude self-review of the commercial build looking for vulnerabilities
across auth, authz, business logic, cryptography, input validation,
injection, state machine abuse, and race conditions. This is a code
review, not a runtime pen test — runtime testing requires hostile
traffic and is a hard gate for an external firm.

## Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 1 | fixed this turn |
| Medium | 4 | 2 fixed, 2 tracked |
| Low | 6 | tracked |
| Informational | 8 | logged |

Total: 19 findings.

Single HIGH finding (race condition on wallet commit) is fixed
below. Everything else is either fixed inline or tracked for
follow-up.

## HIGH severity

### H-1 — Race condition on `commitFromWallet` allows double-spend of wallet balance

**File:** `src/lib/wallets/buyer-wallet.ts`
**Function:** `commitFromWallet`
**Severity:** HIGH

**Finding:** The commit function reads the balance projection, checks
it against `requiredCents`, then posts a ledger entry. Between the
projection read and the ledger write there is a time-of-check-to-
time-of-use window where two concurrent requests can both pass the
balance check and both commit, resulting in a negative wallet
balance.

**Impact:** A buyer with $100 wallet balance who fires two concurrent
$100 workloads can successfully commit both, debiting $200 against
their $100 balance. The imbalance is eventually caught by the nightly
`reconcile-ledger` cron, but during the window the operator has
already been credited and may have been paid out.

**Fix:** Wrap the read + write in a Postgres advisory lock keyed on
the userId so concurrent commits serialize per-user.

**Action:** Fixed this turn — see `advisoryLock` usage in
`commitFromWallet`.

## MEDIUM severity

### M-1 — Dispute engine `addEvidence` not protected against race on state transition

**File:** `src/lib/disputes/engine.ts#addEvidence`

**Finding:** After inserting a new evidence row, the function queries
the existing evidence list to decide whether to transition the case
to UNDER_REVIEW. Two simultaneous evidence submissions (one from
each party) could both observe the pre-transition state and neither
would fire the transition.

**Impact:** Dispute sits in OPEN state indefinitely even though both
parties have submitted. No money lost but workflow stalls until a
reviewer manually transitions.

**Fix:** Wrap the insert + transition in a transaction with SERIALIZABLE
isolation, OR restructure so the transition is driven by a
post-submit trigger that's idempotent (running twice produces the
same result).

**Status:** Tracked as follow-up (not critical enough to block
current turn).

### M-2 — Treasury stub adapter silently returns `ok:false` instead of throwing when not configured

**File:** `src/lib/treasury/adapters/stripe-treasury.ts`

**Finding:** When `STRIPE_TREASURY_ENABLED` is unset, `getPrimaryAccount`
returns `{ok: false, stub: true, ...}` rather than throwing. Downstream
callers that don't check `stub` but only check `!ok` may treat stub
mode as a transient failure and retry indefinitely.

**Impact:** Wasted CPU cycles during dev; potential infinite retry
loop in cron jobs that don't distinguish stub from error.

**Fix:** Audit all call sites and make sure they check `stub` before
treating failures as retryable. Document the distinction in the
adapter contract.

**Status:** Fixed this turn — treasury cron now treats `stub: true` as
a no-op, not a failure.

### M-3 — Redirect guard allows any path-only target, including `/admin` equivalents

**File:** `src/lib/security/redirect-guard.ts`

**Finding:** `safeRedirect` accepts any path-only target (`/foo/bar`) as
long as it doesn't start with `//` or contain backslashes. A
malicious OAuth callback could redirect the user to
`/dashboard/admin/disputes/xxx/resolve?prefilled=attacker_wanted_values`
to prefill a form the user doesn't realize is sensitive.

**Impact:** Low because actual form submission still requires the
user to click submit and provides the XSRF token via the step-up
flow. But the prefilled form is a clickjacking / social-engineering
vector.

**Fix:** Cap redirect targets to a documented allowlist of safe paths,
or strip query strings from redirects entirely unless the target
path is explicitly allowlisted with query preservation.

**Status:** Tracked.

### M-4 — Telemetry span sanitization doesn't cover span `name`

**File:** `src/lib/telemetry/index.ts`

**Finding:** The sanitization layer covers user-supplied attribute
values but not the span name. If a caller ever passes user-supplied
content as a span name (bad practice but possible), control
characters would leak into the log stream.

**Impact:** Informational. Current call sites all use code-defined
names (e.g. `'ledger.post'`). But this is a defense-in-depth gap.

**Fix:** Sanitize the name in the span constructor.

**Status:** Fixed this turn.

## LOW severity

### L-1 — Dispute `open` accepts description up to 2000 chars without HTML encoding

**File:** `src/app/api/disputes/route.ts`

**Finding:** Dispute descriptions are stored as raw strings and
displayed on the detail page via React. React escapes by default so
XSS is not possible via this path, but a user could submit a
description containing null bytes or other control characters.

**Fix:** Reuse the `sanitizeValue` helper from the telemetry facade
on dispute descriptions at submission time.

**Status:** Tracked.

### L-2 — Wallet top-up maximum ($500K) is too high without admin approval

**File:** `src/app/api/wallet/topup/route.ts`

**Finding:** Any authenticated user can create a Stripe Checkout
session for up to $500,000. Deposits this large cross AML thresholds
and should require additional screening.

**Fix:** Gate top-ups above $25,000 on step-up re-auth + admin
notification.

**Status:** Tracked.

### L-3 — KYC session expiry not enforced on read

**File:** `src/lib/kyc/stripe-identity.ts`

**Finding:** `getKycStatus` returns the Stripe session result but
doesn't check whether the session has expired (72h default). An
expired session might still report as IN_PROGRESS if Stripe doesn't
explicitly flag it.

**Fix:** Compute expiration from `createdAt + 72h` and override
status to `EXPIRED` at read time if we're past the window.

**Status:** Tracked.

### L-4 — Nonce store for attestation is in-memory (not Redis)

**File:** `src/app/api/nodes/attestation/nonce/route.ts`

**Finding:** The nonce store is a module-scoped `Map`. Under
Vercel's multi-region deployment, a nonce issued from us-east-1
won't be visible to a request served from eu-west-1. In practice
Vercel pins requests to the same region for a session, but this is
a brittle assumption.

**Fix:** Move the nonce store to Redis via the existing
`@/lib/rate-limit` helper pattern.

**Status:** Tracked.

### L-5 — Step-up token doesn't include device fingerprint

**File:** `src/lib/security/step-up.ts`

**Finding:** Step-up tokens are bound to (userId, scope, expiry) but
not to the device that obtained them. A stolen session cookie could
be used to mint a step-up token and perform privileged operations.

**Fix:** Bind step-up to a device fingerprint (user agent + IP
prefix) and reject if the fingerprint doesn't match. Or require
WebAuthn for step-up, which is device-bound by construction.

**Status:** Tracked — real fix comes with WebAuthn integration.

### L-6 — Appeal engine `decideAppeal` doesn't check panel completeness

**File:** `src/lib/disputes/appeals.ts`

**Finding:** A panel reviewer can decide an appeal unilaterally as
long as they're on the panel. Policy says appeals should require a
panel majority, not a single reviewer.

**Fix:** Track votes per reviewer; only transition to OVERTURNED or
UPHELD when a majority of the panel has voted.

**Status:** Tracked — requires schema addition.

## INFORMATIONAL

- I-1 — Many API routes duplicate the authentication + role check
  pattern. Extract into a middleware helper.
- I-2 — `LedgerFrozenError` is thrown but not caught by any caller.
  Oncall should have a dashboard that surfaces these.
- I-3 — `AttestationRecord` table has no TTL — stale records
  accumulate forever. Add a periodic cleanup cron.
- I-4 — Fireblocks adapter uses synthetic stub returns rather than
  simulating the real API shape. Consider adding a test fixture
  that mimics a real vault response.
- I-5 — `commercial/legal/*` docs are not linked from the main
  site navigation. Add a footer link set.
- I-6 — `/api/openapi.json` is served without auth. Fine for a
  public API contract but worth confirming we're not leaking
  internal endpoint shapes.
- I-7 — The attestation verifier pins are placeholder zero hashes.
  Must be replaced with real SPKI hashes from the respective
  vendors before production.
- I-8 — No security.txt for the node-daemon package. Add for
  parity with the main site.

## Fixed this turn

Three findings were fixed during this audit pass:

1. **H-1** — Advisory lock added to `commitFromWallet`
2. **M-2** — Treasury cron checks `stub` flag
3. **M-4** — Telemetry span constructor sanitizes the span name

## Not a substitute

This audit is a code review by an AI reviewer. It does NOT replace:

- An external penetration test (hard gate for high-value workloads)
- A bug bounty program (recommended after launch)
- A SOC 2 Type II audit (recommended for enterprise customers)
- A formal threat modeling exercise with a qualified expert

The hard gates are tracked in `commercial/DECISIONS.md`.
