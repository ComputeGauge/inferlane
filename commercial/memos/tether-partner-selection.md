---
document: Tether / USDT custodian partner selection
version: 1.0.0
status: Decision memo — approved via AI-only build track, subject to
        lawyer and compliance review before production deployment
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# Tether / USDT Custodian Partner Selection

This memo compares the four realistic options for how InferLane should
integrate USDT settlement into the Float Model (see
`commercial/FLOAT_MODEL.md`, Leg 1 + Tether Integration section).

**Bottom line up front:** **Fireblocks** is the recommended primary
partner for launch, with **Tether merchant API (via Plasma)** as a
fast-follow secondary path for operator payouts. The decision is
informed by regulatory surface area, API quality, chain coverage, and
counterparty concentration risk. None of the options can be
contractually signed by AI; this memo is the paper trail for when you
sit down with a lawyer.

## 1. Why we need a custodian partner

InferLane is NOT going to hold USDT in its own hot wallets. Running a
hot wallet at the scale we target would require:

- Money Transmitter Licenses in most US states (~40, ~$200K+ in bonds
  and filing fees).
- FinCEN MSB registration + FBAR filings.
- OFAC screening infrastructure for every inbound and outbound transfer.
- Travel Rule compliance for transfers over $3,000 (US) / €1,000 (EU).
- HSM key custody and secure operations personnel.
- Cyber liability + crime insurance covering crypto theft.

A custodian partner absorbs most of this by acting as the licensed
entity on-chain. We interact with the partner via an API and the
partner handles the on-chain operations, screening, and regulatory
filings. Our liability is significantly reduced — we're a payment
services customer, not a money transmitter.

## 2. Options evaluated

### Option A — Fireblocks

- **Model:** Institutional-grade custodian with MPC key management.
  We get a set of vaults, API keys, and webhook endpoints. They
  handle key shards, signing, and on-chain operations. They have
  direct integrations with every major exchange and dozens of chains.
- **Regulatory posture:** NYDFS trust charter, FinCEN MSB, SOC 2
  Type II. Licensed Money Transmitter in most US states. They are
  the licensed entity; we are their customer.
- **Chain coverage:** Ethereum, Tron, Solana, Arbitrum, Avalanche,
  BSC, Polygon, and dozens more. **Plasma support: not yet
  announced as of 2026-04.** Confirmed before contract.
- **Fees:** Setup fee (negotiable, typically waived under enterprise
  contract), volume-based monthly fee, per-transaction fee.
  Production-volume clients typically pay $5K–$50K/month base
  depending on volume.
- **API quality:** Best-in-class. Vault management, transaction
  submission, co-signer workflows, webhook notifications, Travel
  Rule, compliance tooling all documented and stable. OpenAPI spec
  available.
- **Pros:** Absorbs the most regulatory surface area, strongest
  counterparty, rich API. Marketplaces (OpenSea, Magic Eden) use
  them — so the shape of our workload is well-known to them.
- **Cons:** Most expensive. Slow to onboard (weeks of KYB + DD).
  Plasma support timing unconfirmed.
- **Best for:** The primary institutional pipe.

### Option B — BitGo

- **Model:** Similar to Fireblocks but with a long-standing
  multi-sig pedigree and a qualified custodian charter (South
  Dakota trust company). Operates "BitGo Trust" as a fiduciary.
- **Regulatory posture:** SDTC qualified custodian, NYDFS limited
  purpose trust charter, SOC 2 Type II.
- **Chain coverage:** Broad. Tron + Solana + Ethereum + Arbitrum
  all supported. Plasma status unknown; ask.
- **Fees:** Comparable to Fireblocks. Slightly cheaper at lower
  volumes, slightly more expensive at higher volumes.
- **API quality:** Good. Not as polished as Fireblocks but
  sufficient. Webhook semantics are well-documented.
- **Pros:** Qualified custodian status is useful if we ever want
  to bundle USDT holdings with enterprise customer reserves under
  a fiduciary umbrella. Good option for customers who require
  "qualified custodian" in writing.
- **Cons:** Slightly less fluent on newer chains (e.g. newer L2s)
  than Fireblocks.
- **Best for:** Enterprise / fiduciary-sensitive customers.

### Option C — Anchorage Digital

- **Model:** Federally-chartered digital asset bank (OCC). True
  bank, not just a trust company. Has a charter most competitors
  can't replicate.
- **Regulatory posture:** OCC National Trust Bank charter,
  FDIC-insured in some products, SOC 2 Type II.
- **Chain coverage:** Narrower than Fireblocks or BitGo — focus on
  the biggest institutional-grade chains. Tron has been a
  periodic sticking point for them.
- **Fees:** Enterprise-only. Minimums typically $25K+/month.
- **API quality:** Good but institutional-flavored (emphasis on
  signing ceremonies, human review).
- **Pros:** The best regulatory story for US federal regulators,
  by a mile. If we ever negotiate with a federal banking regulator,
  having Anchorage on the money flow is the strongest card.
- **Cons:** Narrow chain coverage (Plasma unlikely to land soon),
  high minimums, slower to adapt to new networks.
- **Best for:** Regulatory differentiation, not launch speed.

### Option D — Tether Merchant API (Paolo / Plasma)

- **Model:** Tether itself offers a merchant payment API for
  retailers and marketplaces. Plasma (Tether's own L1) has gasless
  USDT transfers subsidized by Tether. Tether handles the on-chain
  operations and offers a merchant-facing dashboard.
- **Regulatory posture:** Tether is a BVI-based entity. Their
  regulatory posture is weaker in the US than the three above —
  this is a real consideration for American operators or US
  enterprise customers.
- **Chain coverage:** Strong on Tether-adjacent chains (Plasma,
  Tron, Ethereum). Weaker on L2s and non-USDT assets (since this
  is a USDT-only API).
- **Fees:** Very low. Plasma transfers are gasless. Merchant API
  typically takes 0% to 0.1% on volume.
- **API quality:** Newer, less polished. Well-suited for specific
  merchant flows (deposit + withdraw + refund) but less flexible
  than a full custodian.
- **Pros:** Cheapest by far. Gasless transfers on Plasma are a real
  moat for operator payouts in low-margin markets. Direct line to
  Tether means access to Plasma's capacity as the chain matures.
- **Cons:** Single-counterparty risk. Weaker regulatory story for US
  customers. Would not be our only partner.
- **Best for:** Operator payouts via Plasma, secondary path.

## 3. Comparison table

| Dimension | Fireblocks | BitGo | Anchorage | Tether API |
|---|---|---|---|---|
| Chain coverage | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |
| Plasma timing | TBD | TBD | Unlikely soon | ★★★★★ (native) |
| API maturity | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Regulatory story (US) | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★☆☆☆ |
| Cost at low volume | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★★★ |
| Cost at high volume | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| Travel Rule support | ★★★★★ | ★★★★☆ | ★★★★★ | ★★☆☆☆ |
| Time to onboard | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| Counterparty concentration | Low | Low | Low | **High** |

## 4. Decision

### Primary: Fireblocks

- Launch partner for all USDT flows.
- Handles buyer deposits (via sub-accounts per user), operator
  payouts, reserve fund custody, and OFAC screening.
- Expected contract structure: volume-tier pricing with a base
  platform fee. Target sub-$20K/month at launch scale.

### Secondary: Tether Merchant API via Plasma

- Parallel path for operator payouts in jurisdictions where Plasma
  is adopted first.
- Gasless operator withdrawals via Plasma become a moat for
  low-volume operators in emerging markets where Fireblocks fees
  would eat more of a payout than the payout itself.
- Do NOT route buyer deposits through this path; stick with
  Fireblocks for inbound to minimize regulatory surface area.

### Rejected: BitGo

- Good product, strong regulatory posture, but Fireblocks beats it
  on API depth and chain coverage. If Fireblocks is not available
  (e.g., our vertical is excluded), BitGo is the fallback.

### Rejected for launch: Anchorage

- Best regulatory story but too narrow on chain coverage and too
  expensive for day-one. Revisit when we're negotiating with a
  federal banking regulator for enterprise customers.

## 5. What AI can build now

Even without contracts in place, we can land the code adapters
against each partner's documented API so the integration is ready
the day a contract is signed:

- `src/lib/treasury/adapters/fireblocks.ts` — Fireblocks SDK wrapper
  for vault balance, transaction submission, webhook verification.
- `src/lib/tether/adapters/fireblocks.ts` — USDT-specific
  entrypoints that compose on top of the generic Fireblocks adapter.
- `src/lib/tether/adapters/tether-merchant.ts` — Tether merchant
  API wrapper for Plasma-native operator payouts.

Each adapter ships in STUB mode until real credentials are
available — they throw a clear "Not yet contracted" error rather
than a cryptic SDK exception.

## 6. Hard gates (things only the human can do)

| Gate | Blocks | Owner |
|---|---|---|
| KYB with Fireblocks (BitGo if fallback) | Any real USDT flow | You |
| Fireblocks contract signed | Production use | You + lawyer |
| MSB / state MTL determination | All USDT custody in-house (but custodian absorbs this for us) | You + lawyer |
| OFAC screening supplier contract | Not needed — partner handles it | — |
| Cyber crime insurance | Production use at volume | You + broker |
| Reserve fund custody location | Leg 1 launch | You + compliance |

## 7. Review checklist

- [ ] Confirm Fireblocks Plasma support timeline before contract
- [ ] Confirm Fireblocks sub-account model fits our per-user wallet
      architecture
- [ ] Negotiate volume-tier pricing based on projected Year 1 volume
- [ ] Review Fireblocks' standard MSA for indemnification, breach
      notification, and data protection clauses
- [ ] If Plasma timing slips, decide whether to stand up Tether
      merchant API earlier as the Plasma path
