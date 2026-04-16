---
document: MSB / Money Transmitter Determination Memo
version: 1.0.0-draft
status: DRAFT — for counsel review. NOT a legal opinion.
drafted_by: Claude (AI)
drafted_at: 2026-04-15
scope: InferLane compute marketplace, Phase F1-F4
---

# Money Transmitter / MSB Determination — InferLane

> **This memo is AI-drafted for counsel review. It is not legal
> advice. Every state-level conclusion requires verification by a
> licensed attorney familiar with money transmitter law in that
> jurisdiction.**

## 1. Facts

InferLane operates a compute marketplace with the following money
flows:

1. **Buyer deposits USD or USDT into a wallet.** Funds are held in
   FDIC-insured partner accounts via Stripe Treasury (USD) or
   Fireblocks-custodied vaults (USDT). InferLane does NOT directly
   custody customer funds in its own bank accounts.
2. **Workload dispatch.** When a buyer submits a request, funds
   move from wallet → escrow as a ledger entry. Physical money
   stays in the partner account.
3. **Workload completion.** Escrow → operator pending (87%),
   platform fee (10%), reserve fund (3%). Again, all as ledger
   entries — no physical money movement.
4. **Operator payout.** Periodic batch transfers via Stripe
   Connect (USD) or Fireblocks (USDT), on a weekly schedule,
   $50 minimum.
5. **Dispute refunds.** Buyer-won disputes move operator pending
   → buyer wallet as a ledger entry. No physical movement.
6. **Withdrawal.** Buyer withdraws remaining wallet balance back
   to their original payment method via Stripe refund or an
   outbound USDT payout.

Key properties:

- InferLane never holds customer money in its own name. All funds
  sit with licensed partners (Stripe Treasury, Fireblocks).
- InferLane's own revenue (platform fee + float yield + rebate)
  accrues to an operational cash account that IS held in
  InferLane's own bank account.
- Settlement between buyer and seller is INSTRUCTIONAL — we tell
  the partner to pay out — not direct custody.

## 2. Federal determination (FinCEN / BSA)

### 2.1 The FinCEN MSB rule

31 CFR § 1010.100(ff) defines "money services business" (MSB) to
include "money transmitter" under § 1010.100(ff)(5), which in
turn covers:

> "(A) A person that provides money transmission services. The
> term 'money transmission services' means the acceptance of
> currency, funds, or other value that substitutes for currency
> from one person and the transmission of currency, funds, or
> other value that substitutes for currency to another location
> or person by any means."

### 2.2 Payment processor exemption

FinCEN has recognized a payment processor exemption where the
processor:

(a) facilitates the purchase of goods or services, or the
    payment of bills;
(b) operates through clearance and settlement systems that admit
    only BSA-regulated institutions;
(c) provides services pursuant to a formal agreement with the
    seller; and
(d) only transmits funds between the seller and the buyer (not to
    third parties).

### 2.3 Preliminary analysis for InferLane

- **Are we "accepting currency" from buyers?** Yes — buyer
  deposits go into the wallet system. Even though the money
  physically sits at Stripe, InferLane directs its use.
- **Are we "transmitting" funds?** Yes — operator payouts move
  funds to a third party (the operator) at our direction.
- **Does the payment processor exemption apply?**
  - (a) Yes — we facilitate payment for compute services.
  - (b) Yes — Stripe, Fireblocks, and our ACH rails are all
    BSA-regulated financial institutions.
  - (c) Yes — we have a written Operator Agreement with every
    seller.
  - (d) Yes — funds only move between the buyer and the specific
    seller whose compute was consumed, plus our own platform fee.

**Preliminary conclusion:** The payment processor exemption
likely applies for the fiat USD path via Stripe Treasury / Stripe
Connect. Counsel should confirm.

### 2.4 Crypto path

The USDT path is more complex. FinCEN's 2019 guidance "Application
of FinCEN's Regulations to Certain Business Models Involving
Convertible Virtual Currencies" holds that a business that
"accepts and transmits convertible virtual currency" is a money
transmitter regardless of the payment processor exemption.

**Preliminary conclusion:** InferLane's USDT flow likely triggers
MSB registration with FinCEN, even though the physical custody is
with Fireblocks. Mitigation: have Fireblocks be the registered
money services business on the chain leg, and position InferLane
as their API customer rather than the originator.

**Counsel action item:** confirm whether (a) Fireblocks'
regulatory status covers InferLane's use case as a principal, and
(b) whether our non-custodial USDT flow qualifies for the
"sponsor bank" model used in fintech for ACH.

## 3. State-level determination

State money transmitter laws vary enormously. The table below is a
first-pass assessment of the top 15 jurisdictions by population.
**Every cell requires counsel verification.**

| State | License type | Applies to InferLane? | Notes |
|---|---|---|---|
| California | MTL under Ch. 13 FIN Code | **Likely yes** for crypto, **maybe** for fiat path | Specific virtual currency law (AB 39) — requires a DFPI license for "digital financial asset business activity" from July 2025 |
| Texas | Money Services Act license | **Likely yes** | Texas Department of Banking explicitly covers the stored-value model |
| Florida | Chapter 560 "Money Transmitter" | **Likely yes** | Broad definition; any "sale of monetary value" |
| New York | BitLicense (22 NYCRR Part 200) | **Yes** for crypto, **maybe** for fiat | BitLicense is NY's crypto-specific regime; $5K-$500K bond + ongoing compliance |
| Pennsylvania | Money Transmitter Act | **Likely yes** | Low bond (~$1K-$250K) |
| Illinois | Transmitters of Money Act | **Likely yes** | Specifically exempts "payment processor under a contract" in some cases |
| Ohio | Money Transmitters Act | **Likely yes** | Reciprocity available through MMLA |
| Georgia | Sale of Checks / Money Transmitter Act | **Likely yes** | $100K net worth minimum |
| North Carolina | Money Transmitter Act | **Likely yes** | Standard framework |
| Michigan | Money Transmission Services Act | **Likely yes** | Payment processor exemption in § 487.1007 |
| New Jersey | Money Transmitter License | **Likely yes** | Relatively strict |
| Virginia | Money Transmitter Act | **Likely yes** | Standard |
| Washington | Uniform Money Services Act | **Likely yes** | Specifically covers "stored value" |
| Arizona | Money Transmitter Act | **Likely yes** | Standard |
| Massachusetts | MA Money Transmitter Act | **Likely yes** | One of the older regimes |

**Preliminary conclusion (all states):** The fiat USD path via
Stripe Connect probably qualifies for payment processor exemption
in most states (Stripe is the regulated entity). The USDT path
and any direct deposit holding almost certainly triggers state
MTL requirements unless we position Fireblocks as the principal.

## 4. Recommended structure

Based on this preliminary analysis, the recommended launch
structure is:

### Tier 1: Fiat-only, payment processor structure

- Stripe Treasury (FDIC-insured) holds buyer wallet balances.
- Stripe Connect handles operator payouts.
- InferLane's role: instruction-based API customer, not
  principal money transmitter.
- **MTL posture:** relies on Stripe's existing licensing. Low
  regulatory risk but requires contractual acknowledgment from
  Stripe that they're the money transmitter.

### Tier 2: USDT optional, custodian structure

- Fireblocks holds USDT balances under their own MSB + qualified
  custodian charter.
- InferLane is an API customer of Fireblocks.
- **MTL posture:** relies on Fireblocks' existing licensing.
  Acceptable risk if Fireblocks confirms this model matches their
  standard operator arrangement.
- Revenue recognition: any FX spread between USD pricing and USDT
  settlement goes to InferLane's operational cash account.

### Tier 3 (future): InferLane as direct transmitter

- Only if the business case requires us to hold customer funds
  directly in our own accounts.
- Requires FinCEN MSB registration + MTL in every applicable
  state. Estimated cost: $500K–$2M in bonds + filing fees +
  ongoing compliance.
- **Not recommended for launch.**

## 5. Open questions for counsel

1. Does Stripe's existing license cover our payment processor
   posture for the fiat path in all 50 states? (Stripe has a
   letter to this effect for some merchants — do we qualify?)
2. Can Fireblocks be contractually positioned as the principal
   money transmitter for the USDT path?
3. Do we need a separate MSB registration for the platform fee
   flow (revenue we collect ourselves), or does that fall under
   "own funds" which isn't transmission?
4. NY BitLicense — does the USDT path require one for NY
   customers, or can we geo-block NY until we're licensed?
5. California's new DFAL (AB 39) — does InferLane qualify as a
   "digital financial asset business" in scope? If yes, the
   license is required from July 2025.
6. How do we handle refunds — if a buyer withdraws their balance
   to an address InferLane didn't originally receive from, does
   that count as transmission even if the amounts match?
7. Is the 3% reserve fund "customer funds" for regulatory
   purposes, or is it platform revenue the moment it's collected?
8. Does operator pending balance count as "stored value" for NY
   DFS / California DFPI purposes?

## 6. Hard gates (require human action)

- [ ] Engage a fintech lawyer to review this memo and answer §5
- [ ] Obtain written confirmation from Stripe about our payment
      processor status in each state we serve
- [ ] Obtain written confirmation from Fireblocks about their
      principal MSB coverage of our USDT flow
- [ ] If MTL is required: select a licensing agent (Bridge2
      Solutions, Bsafe, etc.) to manage the 40+ state filings
- [ ] Obtain NMLS identification
- [ ] Arrange surety bonds in each state requiring them
- [ ] Set up ongoing NMLS reporting cadence (quarterly)
- [ ] Incorporate the MTL cost into the FLOAT_MODEL.md economics
      if the license path is required

## 7. Contingency: if licensing is needed

If counsel determines InferLane does require direct MTL
registration:

- Budget $800K–$1.5M in year-one licensing costs (bonds + filing
  fees + licensing agent + compliance officer).
- Target states in order of cost-efficiency: Ohio → PA → MI → IL
  (MMLA reciprocity network) first, then CA → TX → FL → NY.
- Plan for a 6–12 month timeline before accepting customers in
  each state.
- Restructure the FLOAT_MODEL.md economics: the licensing overhead
  roughly doubles the effective per-customer fixed cost, but only
  for enterprise-scale float that justifies it.

## 8. References

- 31 CFR § 1010.100(ff) — FinCEN MSB definition
- FinCEN 2019 Guidance FIN-2019-G001 (CVC)
- NCLC State Money Transmitter Laws Survey
- NMLS Resource Center (https://nationwidelicensingsystem.org/)
- Stripe Treasury master services agreement
- Fireblocks enterprise services agreement

## 9. Next steps

1. User (not AI) forwards this memo to a fintech attorney with
   the specific questions in §5.
2. Attorney response within 14 days.
3. If Tier 1 structure holds: proceed with Stripe Treasury
   activation under the existing Stripe merchant agreement.
4. If MTL required: halt USDT path, incorporate licensing cost
   into the fundraising narrative.

---

**Prepared by Claude (AI) as a starting document for legal
review. This is not legal advice.**
