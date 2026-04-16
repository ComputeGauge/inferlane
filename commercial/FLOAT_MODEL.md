# InferLane Float Model — "Free at the Surface" Strategy

Date: 2026-04-14
Status: Strategic lock-in. See `DECISIONS.md` for the feeder decisions.

## Thesis

InferLane becomes free at the point of use and still compounds profit
through **four independent revenue legs**, each with its own compounding
moat. None of them depends on the others, but they reinforce each
other as the platform scales.

1. **Float on deposits** — Tether's model. We hold prepaid buyer
   balances, operator pending balances, and the reserve fund in
   yield-bearing instruments via a licensed custodian partner.
2. **Provider rebates** — Robinhood's PFOF model. Providers pay us to
   route uninformed retail flow into their idle capacity. We charge
   users near rack rate and are invoiced at partnership rate; the delta
   is our margin.
3. **Compute futures spread** — CME-style. Market-making, settlement
   fees, and data licensing on the compute futures and index layer we
   already shipped.
4. **Premium surfaces (Pro / Enterprise / Supplier)** — classic SaaS
   on top of the free routing layer. Pro for retail power users,
   Enterprise for SSO/DPA/SOC 2 customers, Supplier tiers for
   operators who want better visibility, reserved capacity, or
   advanced analytics. Pure margin; each tier is a stickiness lever
   rather than a volume lever.

## Leg 1 — Float on deposits

### Buyer wallets

- Users prefund USD or USDT into an InferLane wallet.
- Wallet balance is held in short-dated US Treasuries, overnight reverse
  repos, or equivalent SIPC-equivalent protected vehicles in jurisdictions
  served.
- Consumption is drawn down per workload at quoted price.
- We keep 100% of the float yield on held balances. Never passed through
  except as "loyalty rebates" for enterprise customers.

### Operator pending balances

- Completed work enters a 168h dispute window before release to operator
  pending.
- Operator pending balance carries until the next payout cycle (weekly
  minimum, or on-demand above $500).
- In practice operators run an average 10-14 days of settled work held by
  InferLane, earning yield that we keep.

### Reserve fund

- 3% of every workload accrues to the reserve fund.
- Reserve fund is held in a mix of US Treasuries (yield) and USDT
  (24/7 liquidity for dispute refunds).
- Target reserve floor: 3 months of payout volume.
- Excess yield (above the floor) flows back to InferLane as revenue.

### Estimated float revenue

Per customer segment, assuming 4.5% annual yield on Treasuries:

| Segment | Avg. float held | Annual yield per user |
|---|---|---|
| Consumer (Pro) | $20 | $0.90 |
| Small team | $500 | $22.50 |
| Enterprise | $150,000 | $6,750 |
| Whale enterprise | $1,000,000+ | $45,000+ |

Growth math:
- 10,000 consumer + 500 small team + 50 enterprise = $9,000 + $11,250 +
  $337,500 = $357,750/year float revenue.
- 100,000 consumer + 5,000 small team + 500 enterprise = $3.57M/year.
- Every additional user is perpetually accretive.

## Leg 2 — Provider rebates

### How rebates work

Anthropic, OpenAI, Groq, Cerebras, xAI, Google, Mistral, Together, and
others all have two pricing tiers:

- **Rack rate** — what you see on their pricing page.
- **Volume / partnership rate** — negotiated privately, typically 5-20%
  cheaper, sometimes with additional capacity guarantees.

InferLane routes billions of tokens per day (target). We negotiate
volume rates with every provider as we cross their minimum volume
thresholds. The delta is our rebate.

### How we capture it

- Users see quoted prices *near rack rate* (within a few percent for
  psychological anchoring).
- Providers invoice us at the rebated rate.
- Delta flows to InferLane as revenue.
- For enterprise customers we disclose a subset of the rebate as a
  "volume discount" to drive stickiness.

### Negotiation leverage

- Data exhaust: we know which providers win on which task types.
  Providers value this for capacity planning.
- Flow predictability: our router classifier tiers requests by
  complexity, making our flow unusually predictable.
- Idle-hour absorption: we can opportunistically schedule batch and
  non-realtime requests to provider off-peak, which is the most valuable
  flow for providers to receive.

### Moral hazard check

Robinhood was fined $65M by the SEC for not disclosing PFOF arrangements
clearly. Our equivalent:

- We will publish the list of providers we have rebate arrangements with
  on our transparency page.
- We will disclose the rebate structure in a percentage range (not exact
  amounts) in the DPA and on the public site.
- We will not route suboptimal decisions to chase rebates. The router
  still optimizes quality/cost/latency; rebate is a tiebreaker, not a
  driver.

## Leg 3 — Compute futures spread

Already built: `ComputeFuture`, `ComputeIndex`, `IndexSnapshot`,
`OrderFill`, `ComputeOrder`. This is the exchange layer.

Revenue from:
- Spread on market-making when we're the counterparty.
- Settlement fees (50bps typical) when we're the venue.
- Data licensing — compute price index feeds to hedge funds.

This is long-tail. Real revenue begins once the market has >1000 active
traders. Not a day-one moneymaker but a powerful category expansion.

## Moat structure

Four compounding effects:

1. **Liquidity depth.** More buyers → more operator demand → more
   operators → better prices → more buyers.
2. **Data moat.** Every request improves the router classifier.
   Classifier quality = routing quality = retention.
3. **Float scale.** More float → better yield vehicles available →
   cheaper to run free tier → faster user acquisition.
4. **Rebate leverage.** Higher flow volume → stronger negotiation with
   providers → lower marginal cost → can absorb more free users.

All four reinforce each other. The right growth tactic is to scale users
aggressively because each new user compounds the flywheel at zero
marginal cost.

## Leg 4 — Premium surfaces (Pro / Enterprise / Supplier)

The fourth leg is conventional SaaS layered on top of the free routing
surface. The routing itself never goes behind a paywall — only the
value-add tooling and the compliance posture do.

### Pro ($20/mo retail)

- Session history across providers and devices
- Chain builder (multi-provider prompt pipelines)
- Dispatch (async + batch queue)
- Scheduling (cron + price-triggered prompts)
- Priority support, custom models, extended rate limits
- Target: 5% of free users convert. 75% LTV margin.

### Enterprise ($2K–$20K/mo)

- SAML / OIDC SSO
- Custom DPA terms, BAA (HIPAA), GDPR Art. 28 documentation
- SOC 2 Type II report sharing (post year-2)
- Private routing pools, dedicated reserved capacity
- Named account manager, 99.95% SLA, incident response
- Audit log exports, enterprise dashboards
- Target: 30% of platform revenue eventually.

### Supplier subscriptions ($29 / $99 / $299/mo)

- Operators pay for better dashboards, faster payouts, advanced
  routing priority, reputation score insights, regional placement
- Already modelled in Prisma as `SupplierSubscription`
- Stickiness lever; low-volume but high-margin

### Why this is a distinct leg

Legs 1–3 monetize the flow and the float; Leg 4 monetizes the
*experience*. It's independent revenue because:

- It doesn't depend on float yield rates (rate-environment neutral).
- It doesn't depend on provider rebate negotiations.
- It doesn't depend on futures volume.
- It has its own retention + expansion dynamics driven entirely by
  product velocity.

Crucially, Leg 4 revenue is recognized as SaaS rather than transaction
revenue, which is valued at a higher multiple at fundraising time.

## Implementation phases

| Phase | Component | Status | Owner |
|---|---|---|---|
| F1 | Buyer wallet + deposit flow | 🟡 | code |
| F2 | Treasury management service | ⚪ | code + 🔒 brokerage account |
| F3 | Operator payout cycle w/ Stripe Connect | 🟢 | existing |
| F4 | Operator payout cycle w/ USDT | ⚪ | code + 🔒 Tether integration |
| F5 | Reserve fund split (T-bills + USDT) | ⚪ | code + 🔒 custody |
| F6 | Provider rebate tracking | ⚪ | code |
| F7 | Router tiebreaker on rebate | ⚪ | code |
| F8 | Transparency page listing rebate providers | ⚪ | content |
| F9 | Compute futures MM bot | ⚪ | code |

## Hard gates specific to this model

- **Securities / money transmission compliance.** Holding prepaid
  balances may trigger state money transmitter licenses in the US and
  equivalent licensing elsewhere. Requires lawyer + likely a licensed
  partner (e.g., Stripe Treasury, Modern Treasury, Mercury, or similar)
  rather than holding the balances ourselves day one.
- **Investment advisor rules.** The moment we put customer balances into
  interest-bearing instruments we need either a broker-dealer or a
  licensed custodian intermediary. Default plan: use Stripe Treasury
  (which already holds customer funds in FDIC-insured accounts and
  shares interest back to us). Secondary: a sweep arrangement with a
  licensed broker-dealer.
- **Tether integration.** Using USDT requires a MSB registration in most
  US states, and a Money Transmitter License in some. Same as above —
  likely via a licensed processor rather than holding directly.
- **Rebate disclosure.** Counsel review of how much detail to publish
  on the transparency page.

## Next concrete build steps

1. `src/lib/treasury/` — treasury management service skeleton
2. `src/lib/wallets/` — buyer wallet service (deposit, withdraw, balance)
3. `src/lib/tether/` — Tether payment integration facade
4. `src/lib/rebates/` — provider rebate tracking
5. Prisma schema additions: `BuyerWallet`, `WalletTransaction`,
   `TreasuryHolding`, `ProviderRebate`
