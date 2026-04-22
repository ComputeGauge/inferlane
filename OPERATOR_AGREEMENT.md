# Operator Agreement

_Effective: 2026-04-22 · Last updated: 2026-04-22_

This agreement covers the relationship between InferLane and people running
our daemon to serve inference on the peer network. It sits alongside our
[Terms of Service](./TERMS_OF_SERVICE.md) and [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md).

**Not legal advice.** This is our operational agreement as of the date above.
Where it conflicts with local law in your jurisdiction, local law prevails.

## Your status

You are an **independent contractor**, not an employee, agent, partner, or
joint venturer of InferLane. You run a daemon on hardware you own or control,
and you earn kT credits (and, eventually, cash) in exchange for serving
inference requests routed to you by our coordinator.

You are responsible for your own taxes, insurance, and compliance with local
employment and business registration laws in your jurisdiction.

## What you agree to do

1. **Run only the approved daemon binary.** Signed releases are published at
   `https://releases.inferlane.dev` with SHA-256 hashes. Running modified
   binaries voids this agreement and forfeits pending payouts.
2. **Keep your daemon up to date.** Security patches are released via the
   daemon's self-update channel. Opt-out is limited to 14 days per release.
3. **Maintain reasonable uptime.** We target 95%+ uptime for active operators;
   sustained uptime below 70% over a 30-day rolling window deactivates your
   operator profile until hardware/network issues are resolved.
4. **Not log or persist prompts or responses** beyond the RAM lifetime of the
   inference request. This means:
   - No writing prompts to disk, stdout, remote endpoints, or any storage
   - No sampling, statistical collection, or training-data extraction
   - No retention of model-context windows beyond the single request
5. **Not modify model behaviour.** The coordinator routes specific model
   versions; you serve exactly the version requested. No substitution, no
   proxy-level transforms, no system-prompt injection.
6. **Serve all requests routed to you** subject to the moderation gate at the
   coordinator. You do not have personal veto power over routed content;
   InferLane's AUP is the single content policy surface.
7. **Keep your operator credentials secure.** Hardware-bound keys (Secure
   Enclave on macOS, TPM on Windows, hardware security module where available).
   Compromised keys must be rotated via `inferlane daemon rotate-key` within
   24 hours of discovery.

## What InferLane agrees to do

1. **Route inference fairly.** Routing decisions weight price, latency,
   reliability, and operator reputation — not personal relationships.
   Algorithm is documented at `/docs/routing`.
2. **Protect you from liability arising from end-user content**, provided
   you've complied with this agreement. We maintain the moderation gate;
   prohibited content is blocked before it reaches you.
3. **Pay you what you've earned** on the published schedule — weekly in
   credits, monthly in cash (when cash payouts launch). Disputes are
   resolved within 14 days.
4. **Not disclose your identity** without your consent or valid legal
   process. Operator profiles are pseudonymous unless you opt into public
   attribution.
5. **Give you 30 days' notice** of material changes to this agreement.
   Minor technical updates (daemon versions, routing tweaks) may be made
   without notice.

## Indemnification

**You indemnify InferLane** (including its officers, employees, and agents)
against all claims, damages, losses, liabilities, costs, and expenses
(including legal fees) arising out of or related to:

- Your operation of the daemon or participation in the network
- Your violation of this agreement, the [Terms of Service](./TERMS_OF_SERVICE.md),
  or the [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md)
- Your violation of any law (including local business registration, tax,
  employment, privacy, data protection, or export-control laws)
- Running modified, unauthorised, or out-of-date daemon code
- Logging, storing, analysing, or transmitting prompts or responses
- Abuse of the credit ledger or payout system
- Any claim brought against InferLane by a third party in connection with
  your node, your hardware, or your conduct as an operator

**InferLane does not indemnify operators.** You are an independent contractor
operating your own hardware in your own jurisdiction. You are responsible for
your own legal compliance, insurance, and tax obligations.

**What we do instead of indemnification:**

- We operate a moderation gate at the coordinator that rejects prohibited
  content *before* it is routed to your node. This reduces (but does not
  eliminate) the risk of you processing harmful content.
- We publish a clear [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md)
  that consumers must accept before using the network.
- We cooperate with valid legal process and may disclose operator-identifying
  information only when legally compelled.
- We do not proactively monitor your node beyond operational telemetry
  (uptime, response-code signals) required to route traffic.
- You benefit from intermediary-liability protections available in your
  jurisdiction (e.g. Section 230 in the US, Online Safety Act safe harbour
  in Australia, DSA hosting-service provisions in the EU) **to the extent
  applicable to your role and conduct**. Availability of those protections
  depends on your facts and jurisdiction and is not guaranteed by this
  agreement.

**You should consult your own legal counsel** before becoming an operator,
particularly regarding local law obligations. If you are not comfortable
accepting the liability position described here, do not register as an
operator.

## Payment

### kT credits (launch phase)

- Earned at the rate published in `/docs/rates` (initially 0.8 kT per
  1,000 Llama-70B-equivalent tokens served, with multipliers for frontier
  and confidential tiers)
- Credited to your operator balance within 15 minutes of request
  completion and moderation review
- Credits expire 6 months from earning, except contribution-kT earned
  via the marketplace which never expires
- Maximum balance: 10,000,000 kT (prevents speculation; adjust via
  governance vote)

### Cash payouts (Phase 2 — target Month 3)

When cash payouts launch:

- **Weekly** settlements via Stripe Connect (or alternative provider as
  available in your jurisdiction)
- **Minimum payout threshold**: USD $20
- **Platform fee**: 10% of gross operator earnings (InferLane retains)
- **Tax reporting**: we issue 1099-MISC (US) or equivalent where required
  above regulatory thresholds (USD $600/yr US; AUD $600/yr AU for PAYG)
- **KYC required** before first cash payout: verified ID + Stripe Connect
  onboarding + sanctions screening
- **Currency**: paid in USD by default; local currency via Stripe FX where
  supported

### Clawbacks

We may reverse credits or cash payouts within 30 days of issuance if:

- Post-review audit finds the request violated our AUP and was incorrectly
  routed (we absorb the cost; you aren't charged)
- The operator was found to have violated this agreement (your earnings for
  the violating period are forfeited)
- A consumer chargeback is upheld (pro-rata deduction; we maintain a 2%
  reserve against this risk)

## Termination

Either party may terminate at any time by notifying the other:

- **You leave**: deactivate your daemon. Any unearned future routing stops
  immediately. Pending credits/cash within the prior 30 days are paid out
  on the normal schedule. Credits older than 30 days can be redeemed for
  inference within 6 months of termination.
- **We terminate you for cause** (violation of this agreement, AUP, or ToS):
  immediate deactivation. Forfeiture of pending earnings. Public naming
  reserved for egregious violations.
- **We wind down the service**: 90 days' notice. All earned credits become
  cashable at the published rate during the wind-down period.

## Governing law

This agreement is governed by the laws of Australia. Disputes proceed in AU
courts, or by agreement in your local jurisdiction. If the service operates
in a jurisdiction where a specific operator-protection law applies (e.g. EU
platform-to-business regulation), that law prevails.

## Signing

You accept this agreement by:

1. Running the daemon's `register` command (`inferlane daemon register`)
2. Providing an email for operational notices
3. Clicking through the acceptance dialog on first start

A signed copy is stored locally at `~/.config/inferlane/operator-agreement.pdf`
and a hash is recorded on our coordinator for dispute resolution.

## Questions

- General: `operators@inferlane.dev`
- Legal: `legal@inferlane.dev`
- Support: Discord `#operator-support`
