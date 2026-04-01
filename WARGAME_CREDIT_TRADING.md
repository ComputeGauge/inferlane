# Credit Trading Wargame — Threats, Edge Cases & Infrastructure Responses

## Category 1: Wash Trading & Market Manipulation

### 1A. Self-Trade via Multiple Accounts
**Attack**: User creates two accounts (Seller, Buyer). Seller lists credits at $0.10, Buyer purchases. Inflates marketplace volume, games "top seller" metrics, or launders promotional credits.

**Current defense**: `CANNOT_BUY_OWN` check blocks buying your own offer. But two *different* accounts bypass this entirely.

**Infrastructure response**:
- **IP fingerprinting**: Log IP + user-agent hash on every `MARKET_LIST`, `MARKET_PURCHASE`, and `MARKET_SALE` transaction. Flag purchases where seller and buyer share IP within 24h window.
- **Device fingerprint** (optional): Canvas/WebGL fingerprint hash stored on session. Same fingerprint buying from yourself → soft block + review.
- **Velocity detection**: If Account A *only* sells to Account B, and Account B *only* buys from Account A → flag as suspected wash pair.
- **Schema change**: Add `ipHash String?` and `deviceHash String?` to `CreditTransaction`. Add `WashTradeFlag` model for admin review queue.
- **Manual review threshold**: Any user trading >$200/month triggers manual review before next trade.

### 1B. Shill Bidding / Price Manipulation
**Attack**: User creates offers at inflated prices that never fill, making the "market rate" look higher. Or creates offers at very low prices (using a second account to buy them) to crash the perceived market rate.

**Current defense**: None. The marketplace just shows active offers.

**Infrastructure response**:
- **Suggested price is derived from decay curve, not market history**. The `calculatePriceBounds()` function uses time-remaining math, not "what did the last trade go for." This is immune to shill pricing — the suggested price can't be manipulated by fake offers.
- **Exclude unfilled expired offers from any "market rate" calculations**. Only FILLED or PARTIALLY_FILLED offers should contribute to market analytics.
- **Display "Suggested: $X.XX" prominently** so buyers never rely on listed prices for fair-value assessment.

### 1C. Circular Delegation Exploit
**Attack**: User delegates to pool, earns yield, recalls, lists on marketplace, earns sale proceeds — double-dipping on the same credits.

**Current defense**: The invariant `available + delegatedToPool + listedOnMarket <= totalAllocated` prevents credits being in two places. Pool earnings go to `earned` (separate from `available`). But `earned` isn't clearly ring-fenced from re-trading.

**Infrastructure response**:
- **Earned credits should be withdrawable (cashout) or usable for compute, but NOT re-listable on marketplace.** Add a check in `POST /api/credits/offers`: the amount listed must not exceed `available - earned` (i.e., only *allocated* credits can be traded, not *earned* credits).
- **Why**: Otherwise the pool becomes a money printer. You delegate 100, earn 5, recall, list the 5 earned credits on marketplace, someone buys them, you re-delegate the proceeds. The system leaks value.
- **Schema consideration**: Split `available` into `availableAllocated` and `availableEarned`, or add a `tradeable` computed field.

---

## Category 2: Credit Lifecycle & Expiry Edge Cases

### 2A. Buyer Purchases Credits 1 Hour Before Period End
**Attack** (not malicious, but problematic): Buyer sees 500 credits at $0.12/credit (fire sale). Buys them. Period ends 58 minutes later. Credits expire. Buyer paid $60 for 58 minutes of compute.

**Current defense**: The marketplace shows expiry time and the time-decay badge says "critical." But there's no guardrail preventing a bad purchase.

**Infrastructure response**:
- **Purchased credits inherit the seller's `periodEnd`**. Currently, bought credits just increment `available` with no attached expiry — they persist until the *buyer's* period end. **This is actually correct behavior if periods are account-level.** But it creates a question: does the buyer's period or the seller's period apply?
- **Decision**: Bought credits should be usable until the *buyer's* period end (not the seller's). The seller's expiry drove the discount; the buyer is getting a bargain precisely because the seller couldn't use them. The buyer's period is what matters for consumption.
- **This is already how it works** — `creditBalance.periodEnd` is the buyer's own period. Purchased credits add to `available` and survive until the buyer's next allocation cycle.
- **UI improvement**: Show "Usable until YOUR period end: [date]" on purchase confirmation so buyers understand they're not buying the seller's remaining time.

### 2B. Credits Listed on Market When Period Allocation Runs
**Attack**: User has 200 credits listed on marketplace. Monthly allocation cron fires. The cron sets `available = newAllocation`, `listedOnMarket = 0` — wiping the marketplace listing without returning credits.

**Current defense**: The `allocate-credits` cron *does* handle this — it cancels all active offers before expiring the old balance (lines 65-99). Active offers are expired, remaining credits returned to available, then the full available balance is expired.

**But there's a race condition**: If a buyer purchases from the offer *during* the cron's transaction window, the cron may try to decrement `listedOnMarket` below zero (the buyer already decremented it).

**Infrastructure response**:
- **Advisory lock on userId** during allocation. Use `SELECT ... FOR UPDATE` pattern (Prisma doesn't natively support this, but `$queryRaw` can):
  ```sql
  SELECT * FROM credit_balances WHERE user_id = $1 FOR UPDATE
  ```
  This serializes the allocation cron against concurrent purchases.
- **Defensive math**: In the allocation cron, after canceling offers, re-read the balance and use `Math.max(0, ...)` when decrementing to avoid negative values. Add assertion check: if `listedOnMarket` is negative after operations, log critical alert.
- **Priority**: HIGH. This is a real data integrity risk at scale.

### 2C. Partially Filled Offer at Expiry
**Attack**: Offer: 1000 credits, 700 filled, 300 remaining. Offer expires. Expire-offers cron returns 300 to seller. But what about the 700 already transferred to the buyer? Is the seller's `listedOnMarket` correctly decremented?

**Current defense**: When a buyer purchases (buy route), `listedOnMarket` is decremented by the purchase amount and `filledAmount` is incremented. So by the time the offer expires, `listedOnMarket` only reflects the unfilled portion. The expire-offers cron returns `unfilled` to `available` and decrements `listedOnMarket` by `unfilled`.

**This is correct as implemented.** The accounting works because each purchase atomically adjusts `listedOnMarket`.

**Potential issue**: If `listedOnMarket` goes negative due to a race (see 2B), the expire-offers cron would decrement it further below zero.

**Infrastructure response**: Same advisory lock + defensive math as 2B.

### 2D. Offer Expires While Buyer's Purchase is In-Flight
**Attack**: Buyer clicks "Buy" at 11:59:59. The expire-offers cron runs at 12:00:00. Both try to modify the same offer in a transaction.

**Current defense**: Both use `$transaction`. Postgres serializable isolation should prevent double-modification. But neither acquires an explicit row lock on the offer.

**Infrastructure response**:
- **Both the buy route and the expire-offers cron should `SELECT ... FOR UPDATE` on the CreditOffer row first** within their transactions. This ensures serialization.
- **The buy route already checks `expiresAt`** (line 47-54), so if it runs second, it will see the offer is expired and reject the purchase.
- **Priority**: MEDIUM. The natural check on `expiresAt` is mostly sufficient, but explicit locking is cleaner.

---

## Category 3: Economic & Incentive Misalignment

### 3A. Race to the Bottom — Sellers Undercut Each Other to Zero
**Scenario**: Multiple sellers competing on price drive credits to the floor ($0.10). Sellers recover almost nothing. Marketplace becomes a race to the bottom.

**Current defense**: `floor = max(0.10, decayFactor * 0.50)`. For credits with 15+ days remaining, the floor is ~$0.44. For 3 days remaining, floor is ~$0.18.

**Infrastructure response**:
- **The floor is working as designed.** Credits with plenty of time left can't be dumped. Credits near expiry *should* be cheap — the alternative is total forfeiture.
- **Consider a minimum listing duration**: Offers must be active for at least 1 hour. This prevents flash-listing at rock-bottom prices where an accomplice immediately buys.
- **Consider a "reserve price" option**: Sellers set their minimum acceptable price. If auto-reprice would drop below their reserve, the offer is cancelled instead. Adds complexity but gives sellers control.

### 3B. Pool Cannibalization — Why Trade When Pool Earns Passively?
**Scenario**: The pool earns 5% per cycle with zero effort. Marketplace trading requires active management. Users rationally delegate everything to the pool, and the marketplace dies.

**Current defense**: Q5's decay modifier reduces pool earnings for late-period delegation. But early-period delegation still earns full rate.

**Infrastructure response**:
- **The pool rate should always be below the marketplace floor.** If marketplace floor is $0.10 (10% of face value), the pool should earn less than 10%. The current 5% base rate * decayModifier achieves this for most of the period.
- **Cap pool earnings at face_value × 0.03 per cycle** (3%). This ensures the marketplace always offers better returns for active sellers.
- **Display the comparison**: "Pool: ~3% return | Marketplace: ~15-40% return" on the credits dashboard. Let users see the tradeoff.

### 3C. Buyers Hoard Cheap Credits
**Scenario**: Buyer purchases 10,000 credits at $0.15/credit near end of period. They now have massive purchasing power for the *next* period (since bought credits persist until buyer's period end).

**Current defense**: Purchase cap of $500 per transaction. But no cap on total purchased credits across multiple transactions.

**Infrastructure response**:
- **Add a total holdings cap**: `available + delegatedToPool + listedOnMarket <= 5x totalAllocated`. You can hold up to 5x your normal allocation from marketplace purchases. Prevents whales from cornering the market.
- **Purchased credits should still expire at buyer's period end.** No indefinite accumulation.
- **Alternative**: Purchased credits get their *own* expiry based on purchase date + 30 days (not synced to the buyer's period). This limits hoarding but adds schema complexity.
- **Priority**: LOW until marketplace volume exceeds $10K/month.

### 3D. Your Use Case — "I've Used All My Compute, Want More"
**Scenario**: You exhaust your allocation. You want to buy more compute immediately. If InferLane doesn't enable this, you route through OpenClaw or another gateway.

**Current state**: The buy route gives you credits, but `costUsd: 0` in the proxy route means compute isn't being deducted from credits at all. **The proxy doesn't consume credits yet** — it just logs the request. Stream R (source resolver) would fix this, but it's not built yet.

**Infrastructure response** (pre-Stream R):
- **Add credit consumption to the proxy route NOW** as a simpler precursor to Stream R:
  1. After calculating `costUsd`, check if user has available credits
  2. If yes, decrement `available` by `costUsd` and log a `CREDIT_CONSUME` transaction
  3. If credits exhausted, fall back to direct Stripe charge (or deny if no payment method)
- **This makes credits actually functional** rather than just a number on a dashboard.
- **New enum value**: `CREDIT_CONSUME` in CreditTxType
- **Priority**: CRITICAL. Without this, the entire credit system is cosmetic.

---

## Category 4: System Integrity & Failure Modes

### 4A. CreditBalance Invariant Violation
**Attack**: Concurrent transactions (buy, delegate, list) operating on the same user's balance can violate `available + delegatedToPool + listedOnMarket <= totalAllocated`.

**Example**: User has 100 available. Two concurrent requests: delegate 80 + list 80. Both read `available = 100`, both proceed, balance goes to `-60`.

**Current defense**: Each mutation is in a `$transaction`, but Prisma defaults to `ReadCommitted` isolation which allows this exact problem.

**Infrastructure response**:
- **Use `Serializable` isolation level on all credit mutation transactions**:
  ```typescript
  prisma.$transaction(async (tx) => { ... }, {
    isolationLevel: 'Serializable',
  })
  ```
  This causes one of the concurrent transactions to fail with a serialization error, which the app can retry.
- **Add invariant assertion** at the end of every credit mutation:
  ```typescript
  const final = await tx.creditBalance.findUnique({ where: { userId } });
  const sum = Number(final.available) + Number(final.delegatedToPool) + Number(final.listedOnMarket);
  if (sum > Number(final.totalAllocated) + Number(final.earned) + 0.01) {
    throw new Error('INVARIANT_VIOLATION');
  }
  ```
- **Priority**: HIGH. This is a correctness requirement.

### 4B. Decimal Precision Drift
**Attack**: Repeated operations on `Decimal(12,2)` fields with rounding can cause pennies to appear or disappear over thousands of transactions.

**Current defense**: Using Prisma `Decimal` backed by Postgres `numeric(12,2)`. Postgres numeric is exact (not floating-point).

**Infrastructure response**:
- **This is mostly fine** because Postgres `numeric` doesn't have floating-point drift.
- **But**: `Number()` conversion in JavaScript introduces IEEE 754 drift. Every `Number(balance.available)` is a potential precision loss.
- **Fix**: Use `.toNumber()` on Prisma Decimals sparingly. For comparisons within transactions, keep values as `Decimal` and use Prisma's increment/decrement (which operate at the DB level, not in JS).
- **Reconciliation cron**: Monthly, sum all `CreditTransaction` amounts by type per user and compare to `CreditBalance` state. Log any discrepancy >$0.01 as a reconciliation alert.
- **Priority**: MEDIUM. Won't bite until high transaction volume.

### 4C. Cron Overlap
**Attack**: The reprice cron, expire-offers cron, and settle-pool cron all run at the same time (e.g., all scheduled hourly on the hour). They may modify the same offers/balances concurrently.

**Current defense**: Each cron operates in its own transaction(s). But no guard against concurrent execution of the same cron.

**Infrastructure response**:
- **Distributed lock** (e.g., Postgres advisory lock or Redis `SET NX`):
  ```typescript
  const lockAcquired = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${LOCK_ID})`;
  if (!lockAcquired) return { skipped: true, reason: 'lock held' };
  try { /* do work */ } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
  }
  ```
- **Stagger cron schedules**: reprice at :05, expire at :15, settle at :30. Simple but effective.
- **Idempotency**: Design crons to be safe to re-run. Check state before modifying (e.g., don't re-expire an already-expired offer).
- **Priority**: MEDIUM. The existing code is mostly idempotent, but explicit locking is cleaner at scale.

### 4D. Stripe Payment Failure After Credit Transfer
**Attack**: Buyer purchases credits. Credit transfer succeeds (buyer gets credits, seller gets earnings). Stripe payment fails asynchronously (card declined, insufficient funds).

**Current defense**: The buy route doesn't integrate with Stripe payments at all. Credits transfer for free. This is fine for an MVP where credits are a subscription benefit, but breaks if real money changes hands on the marketplace.

**Infrastructure response**:
- **Escrow model**: When a buyer clicks "Buy," create a Stripe PaymentIntent. Credits move to an `escrow` state (neither seller's nor buyer's). On `payment_intent.succeeded` webhook, release credits to buyer and payment to seller. On `payment_intent.failed`, return credits to seller's `listedOnMarket`.
- **New fields**: `CreditOffer.escrowAmount`, `CreditOffer.paymentIntentId`
- **New enum**: `OfferStatus.ESCROWED` — credits locked pending payment confirmation
- **This is a Phase 2 concern** — for now, credits are a zero-cost subscription abstraction. Real marketplace with real money needs escrow.
- **Priority**: HIGH before any real-money marketplace launch.

---

## Category 5: Abuse & Gaming

### 5A. Bot Sniping — Automated Purchase of Underpriced Credits
**Attack**: Bot monitors marketplace API, instantly buys any credits listed below a threshold. Legitimate human buyers never get a chance.

**Current defense**: Rate limit of 10 req/min per user on the buy endpoint.

**Infrastructure response**:
- **CAPTCHA on purchase** for offers below the floor price (fire-sale credits are the most snipeable).
- **"Cooling period"**: New offers are hidden for 60 seconds before appearing to non-sellers. Gives the seller time to cancel if they fat-fingered the price.
- **Fair queue**: If multiple buyers try to buy the same offer within 5 seconds, randomize which one succeeds rather than first-come-first-served.
- **Priority**: LOW. Only relevant with significant marketplace volume.

### 5B. Referral Abuse — Create Accounts to Farm Credits
**Attack**: Create 10 accounts with free tier. Can't trade (FREE gets 0 credits). But if there's ever a promotional credit grant, farm those.

**Current defense**: Tier gating — only annual PRO+ can trade.

**Infrastructure response**:
- **Keep the tier gate.** It's the strongest single defense against farming.
- **If promotional credits are ever added**: make them non-tradeable (separate field, `promotionalCredits`, excluded from marketplace listing).
- **Priority**: LOW.

### 5C. Seller Creates Offer Then Cancels Subscription
**Attack**: Seller lists 500 credits on marketplace. Then cancels their subscription. The credits are still listed. Buyer purchases them. But the seller's allocation is now void.

**Current defense**: The Stripe webhook handler should cancel all active offers on `customer.subscription.deleted`. Let me verify...

**Infrastructure response**:
- **Verify the Stripe webhook handles this.** If the webhook cancels offers and returns credits, then expires the balance, this is handled.
- **Edge case**: Subscription expires at midnight. Buyer purchases at 11:59pm. Cron expires balance at 12:00am. Buyer got credits from a now-expired seller. **This is fine** — the credits were valid at time of purchase and now belong to the buyer.
- **Priority**: MEDIUM. Need to verify webhook coverage.

### 5D. Abuse of Auto-Reprice
**Attack**: Seller sets autoReprice=true. Reprice cron reduces their $0.80 offer to $0.30. They didn't want to sell at $0.30 but the cron did it automatically.

**Current defense**: Auto-reprice is opt-in (default true, but users can disable).

**Infrastructure response**:
- **Add a `repriceFloor` field to CreditOffer**: The seller's minimum acceptable price. If auto-reprice would drop below this, cancel the offer instead.
- **Notification**: When auto-reprice fires, send an in-app notification or email: "Your offer was repriced from $0.80 to $0.54. [View | Cancel | Set floor price]".
- **Default autoReprice to false** rather than true. Users who want it can opt in. This is safer.
- **Priority**: HIGH. Seller surprise is a trust issue.

---

## Category 6: The OpenClaw/P2P Gateway Threat

### 6A. Users Route Through OpenClaw to Avoid InferLane Fees
**Scenario**: InferLane charges a spread on marketplace trades. Users realize they can trade compute directly through OpenClaw/LiteLLM gateways and avoid the fee.

**Infrastructure response**:
- **InferLane's value prop is the marketplace + analytics, not the proxy.** If users go peer-to-peer, they lose the dashboard, the audit trail, the decay pricing, the auto-pool, and the settlement engine.
- **Make the fee competitive**: 2-5% take rate on marketplace trades. Low enough that the convenience of the platform outweighs going P2P.
- **Integrate with gateways rather than competing**: If a user routes through OpenClaw, capture that traffic via the ingest API (Stream B) and still provide the analytics layer. InferLane becomes the *settlement layer* for P2P trading.

### 6B. Provider Blocks InferLane's API Keys
**Scenario**: Anthropic discovers InferLane is reselling API access via Tier 0 proxy model. They revoke InferLane's API keys.

**Infrastructure response**:
- **Tier 0 uses the user's own API keys, not InferLane's.** The proxy route reads `connection.encryptedApiKey` for the specific user/provider combination. InferLane never uses a shared key.
- **For marketplace purchases**: The buyer must have their *own* provider connection. Purchased credits give them compute *metered by InferLane*, but the actual API call uses the buyer's own API key.
- **Risk area**: If the buyer has no API key for the provider, they can't use purchased credits. This needs a clear UI warning: "You need to connect [Provider] in your dashboard before you can use these credits."
- **Alternative (Tier 0+)**: InferLane maintains a "house" provider connection with a volume agreement. Marketplace buyers use the house key, InferLane handles the provider billing. This is the actual resale model and carries real TOS risk.

### 6C. Provider TOS Explicitly Bans Resale
**Scenario**: Provider terms say "API keys are non-transferable." InferLane's Tier 0 model technically doesn't transfer keys (each user uses their own), but the credits abstraction is arguable.

**Infrastructure response**:
- **Legal review per provider TOS** before enabling marketplace for each provider.
- **InferLane credits are a billing abstraction on the user's own subscription**, not API key resale. The user authorized the proxy access. The marketplace trades credits, not keys.
- **Document the distinction**: "InferLane does not provide API access to any LLM provider. Users connect their own provider credentials. Credits represent pre-paid compute metering within the InferLane platform."
- **Priority**: HIGH before any public marketplace launch.

---

## Category 7: Dynamic Routing (Stream R) Edge Cases

### 7A. Mid-Request Source Exhaustion
**Scenario**: A streaming response is in progress. The credit source being consumed runs out mid-stream. The response needs to continue.

**Infrastructure response**:
- **Credit reservation**: Before forwarding the request, estimate max cost (based on model + max_tokens) and reserve that amount. If insufficient credits across all sources, reject upfront.
- **Post-request settlement**: After the response completes, calculate actual cost and adjust reservation. Return over-reserved credits.
- **Streaming is indivisible**: You can't switch credit sources mid-stream. The reservation model ensures the full request is funded before it starts.

### 7B. Auto-Buy Threshold Creates Infinite Loop
**Scenario**: User sets auto-buy threshold at $0.40. Their compute job creates demand. The demand raises prices above $0.40. Auto-buy stops. Job hits credit exhaustion. Job fails.

**Infrastructure response**:
- **Auto-buy should have a total budget cap**: "Buy up to $100/month of marketplace credits at threshold."
- **Auto-buy should NOT affect marketplace prices** (it's just buying existing offers, not creating demand for new offers).
- **Graceful degradation**: When all credit sources exhausted, don't hard-fail. Queue the request and notify the user: "Credit sources exhausted. 3 requests queued. [Buy more credits | Add payment method]."

### 7C. Source Resolver Latency
**Scenario**: The source resolver queries `CreditBalance`, `CreditOffer` (marketplace purchases), and `PoolDelegation` on every proxy request. At 100 req/minute, this is 300 extra DB queries per minute per user.

**Infrastructure response**:
- **Cache the resolved source list**: After resolving, cache the ordered source list in Redis with 60-second TTL. Invalidate on any credit mutation.
- **Denormalize**: Add `purchasedCredits Decimal @default(0)` to CreditBalance. Update on marketplace purchase. Source resolver reads one row instead of joining.
- **Priority**: MEDIUM. Performance concern at scale only.

---

## Implementation Priority Matrix

| Priority | Issue | Category | Effort |
|---|---|---|---|
| **CRITICAL** | Credits not consumed by proxy (3D) | Economic | Medium — add CREDIT_CONSUME to proxy route |
| **HIGH** | CreditBalance invariant violation (4A) | Integrity | Low — add Serializable isolation |
| **HIGH** | Allocation cron race condition (2B) | Integrity | Low — add FOR UPDATE + defensive math |
| **HIGH** | Auto-reprice default + repriceFloor (5D) | Trust | Medium — schema + UI changes |
| **HIGH** | Stripe escrow for real-money trades (4D) | Financial | High — full escrow system |
| **HIGH** | Provider TOS legal review (6C) | Legal | N/A — external |
| **MEDIUM** | Cron overlap / advisory locks (4C) | Ops | Low — stagger + pg_advisory_lock |
| **MEDIUM** | Offer expiry race with buy (2D) | Integrity | Low — FOR UPDATE on offer row |
| **MEDIUM** | Decimal precision / reconciliation (4B) | Integrity | Medium — reconciliation cron |
| **MEDIUM** | Wash trade detection (1A) | Abuse | Medium — IP/device logging + detection |
| **MEDIUM** | Pool rate cap below marketplace floor (3B) | Economic | Low — config change |
| **MEDIUM** | Buyer holdings cap (3C) | Economic | Low — validation check |
| **LOW** | Bot sniping defenses (5A) | Abuse | Medium — cooling period + fair queue |
| **LOW** | Circular delegation exploit (1C) | Economic | Medium — split earned/allocated |
| **LOW** | Source resolver caching (7C) | Perf | Medium — Redis layer |
| **LOW** | Referral credit farming (5B) | Abuse | Low — tier gate is sufficient |

---

## Category 8: Decentralised Network Routing (OpenClaw) — Privacy & Trust

### 8A. Node Operator Sees Plaintext Prompts
**Threat**: When routing workloads to OpenClaw's decentralised network, the executing node has full access to the prompt and response in plaintext. A malicious node operator could log, exfiltrate, or sell user queries.

**This is the #1 enterprise objection.** No CISO will approve routing sensitive queries through untrusted third-party infrastructure without privacy guarantees.

**Infrastructure response** (3 tiers, see Stream S in plan):
- **Tier 0 (launch)**: Transport encryption only (mTLS). Node sees plaintext. Acceptable for non-sensitive workloads (code gen, public data, creative content). Label clearly in UI.
- **Tier 1 (month 3)**: Blind routing with prompt fragmentation. Split the prompt across multiple nodes so no single node sees complete context. InferLane reassembles. Collusion required to reconstruct.
- **Tier 2 (year 2+)**: TEE-backed confidential compute. Hardware enclaves (Intel SGX, NVIDIA CC) prevent node operators from inspecting memory. Cryptographic attestation proves the node is running unmodified inference code.

**Priority**: CRITICAL for enterprise adoption. Tier 0 is sufficient for launch with hobby/developer market. Tier 1 needed before approaching any business customer.

### 8B. Prompt Fragmentation Quality Degradation
**Threat**: Splitting a prompt across nodes loses context. "Summarize this legal contract and identify liability risks" requires the full contract as context — you can't give half to Node A and half to Node B and expect coherent output.

**Infrastructure response**:
- Not all prompts are splittable. The router needs a **splittability classifier**: can this prompt be decomposed into independent sub-tasks?
- **Splittable patterns**: Multi-step pipelines (extract → transform → analyze), parallel questions about different topics, batch operations on independent items.
- **Non-splittable patterns**: Long-context summarization, single-document analysis, conversational context that requires full history.
- **Fallback**: Non-splittable prompts route to Tier 0 nodes (with user consent) or queue for TEE-capable nodes only.
- **Hybrid approach**: Use a small, cheap, trusted model (running on InferLane's own infra) to decompose the prompt into sub-tasks. Sub-tasks route to untrusted nodes. The trusted model synthesizes final output. This keeps the "understanding" centralised and the "compute" decentralised.

### 8C. Node Collusion / Sybil Attack
**Threat**: An attacker runs multiple nodes on the OpenClaw network. When a Tier 1 fragmented prompt is split across 3 nodes, the attacker controls 2 of them and can reconstruct most of the prompt.

**Infrastructure response**:
- **Diversity requirement**: Fragments must route to nodes with different operators, different IP ranges, and different geographic regions. Never send >1 fragment to the same operator.
- **Node reputation scoring**: Track completion quality, latency consistency, and uptime. New/unverified nodes get low-sensitivity fragments only.
- **Canary fragments**: Include decoy data that, if it appears elsewhere, proves the node is exfiltrating. Monitor for leaked canaries.
- **Minimum fragment count**: For Tier 1, require ≥3 fragments across ≥3 distinct operators. Statistical difficulty of collusion increases.

### 8D. Model Weight / IP Leakage (Reverse Direction)
**Threat**: If OpenClaw nodes run open-weight models (Llama, Mixtral), this isn't a concern — the weights are public. But if InferLane ever routes to nodes running fine-tuned proprietary models, the model weights could be extracted via repeated inference.

**Infrastructure response**:
- **Out of scope for Phase 0-1**: OpenClaw runs open-weight models. No IP leakage risk.
- **Future consideration**: If enterprise customers deploy fine-tuned models on the network, those models should only run on TEE-attested nodes where weight extraction is hardware-prevented.

### 8E. Regulatory / Compliance Barriers
**Threat**: GDPR, HIPAA, SOC2, and industry-specific regulations may prohibit processing data on uncontrolled third-party infrastructure, even with encryption.

**Infrastructure response**:
- **Geo-fencing**: Privacy policies include `allowedRegions`. EU data stays on EU nodes. Healthcare data stays on HIPAA-compliant infrastructure.
- **Data residency attestation**: Nodes declare their jurisdiction. InferLane verifies via IP geolocation and (for Tier 2) hardware attestation.
- **Compliance tier gating**: HIPAA workloads require Tier 2 (TEE) + US-only nodes. GDPR workloads require Tier 1+ and EU nodes. Non-regulated workloads can use any tier.
- **Clear documentation**: "InferLane acts as a data processor. Node operators are sub-processors. DPAs required for Tier 0/1 routing." This is standard cloud vendor architecture.

### 8F. Latency Penalty from Privacy Layers
**Threat**: Fragmentation (Tier 1) adds multiple network round-trips. TEE (Tier 2) adds computational overhead. Users who need low-latency inference (chatbots, real-time agents) won't accept 3-10x latency for privacy.

**Infrastructure response**:
- **Tier selection is workload-aware**: Real-time chat → Tier 0 with trusted nodes. Batch processing → Tier 1 (latency doesn't matter). Sensitive analysis → Tier 2 with explicit latency warning.
- **Latency budget**: User sets max acceptable latency. Router selects the highest privacy tier achievable within that budget. UI shows: "Privacy: Tier 1 (blind routing) | Est. latency: 2.3s | [Upgrade to Tier 2: ~8s]"
- **Pre-warming**: For repeated workload patterns, pre-fragment and cache routing decisions. Second request reuses the same node allocation.

### 8G. Joint Encryption for Query Packaging
**Concept the user raised**: Encrypt the query such that it's "joint" — shared across the network in a way that requires cooperation to decrypt.

This maps to **Shamir's Secret Sharing** or **threshold encryption**:
- The prompt is encrypted and split into N shares using (k, N) threshold scheme
- Any k of N shares can reconstruct the plaintext, but k-1 shares reveal nothing
- Set k = N (all nodes must cooperate) for maximum privacy, or k = N-1 for fault tolerance
- InferLane holds the "reconstruction key" — only the InferLane router can reassemble

**Practical implementation**:
1. InferLane encrypts the prompt with AES-256
2. The AES key is split into N shares via Shamir's Secret Sharing
3. Each node receives: its share of the key + the encrypted prompt
4. Nodes can't decrypt individually
5. Each node performs its fragment of work on a *subset* of the decrypted prompt (InferLane selectively decrypts relevant sections for each node)
6. Results return encrypted to InferLane for reassembly

This is essentially Tier 1 (blind routing) + cryptographic enforcement rather than trust-based fragmentation. It's the bridge between Tier 1 and Tier 2 — stronger than fragmenting-and-hoping, weaker than full TEE, but practically deployable today.

**Priority for implementation**: HIGH for differentiation. This could be InferLane's unique selling point — "the only compute marketplace with cryptographic privacy for decentralised inference."

## Category 9: Micropayment Settlement & Node Operator Threats

### 9A. Flash Node Registration — Earn and Disappear
**Attack**: Attacker registers as a node operator, completes a burst of low-quality requests (enough to earn $50), then disappears before reputation scoring catches up. If settlement is immediate, they cash out garbage work.

**Infrastructure response**:
- **Settlement delay for new operators**: Weekly settlement with $5 minimum for operators with <$100 lifetime earnings. This creates a 7-day fraud detection window.
- **Reputation threshold for first payout**: No payouts until operator has completed ≥50 requests with ≥70% success rate. Prevents flash-farm-and-exit.
- **Stripe Connect KYC**: Identity verification via Stripe before any payouts. Raises the cost of creating throwaway identities.
- **Clawback mechanism**: If quality issues are detected after payout, deduct from future earnings (never negative balance — just withhold future payouts until offset).
- **Priority**: HIGH.

### 9B. Node Operator Returns Cached/Fabricated Responses
**Attack**: Node receives inference request, ignores it, returns a pre-cached or randomly generated response. Earns NODE_EARNING without doing real compute. Hard to detect for non-deterministic outputs.

**Infrastructure response**:
- **Canary requests**: InferLane periodically sends test prompts with known-correct answers. Nodes that fail canaries get reputation penalties.
- **Response quality sampling**: For X% of requests, send the same prompt to two nodes. Compare outputs. Divergent responses from the same model → flag the outlier.
- **Latency anomaly detection**: If a node responds to a complex prompt in 50ms (physically impossible for inference), the response is fabricated. Flag and penalize.
- **Token-count verification**: If the response claims 500 output tokens but the text is clearly 20 tokens, the usage report is fabricated.
- **User feedback loop**: Allow users to flag "bad response" on proxy results. Correlate flags with specific nodes.
- **Priority**: HIGH — this is the easiest exploit on a decentralised network.

### 9C. Node Operator Extracts Prompts for Competitive Intelligence
**Attack**: A competitor runs nodes on the OpenClaw network specifically to harvest prompts from InferLane users. Not for resale, but for understanding what queries are being run (market research, competitive intelligence, training data harvesting).

**Infrastructure response**:
- **Privacy tier enforcement**: Tier 0 nodes get non-sensitive workloads only. Sensitive workloads require Tier 1+ (fragmentation) or Tier 2 (TEE).
- **Prompt anonymization**: Strip all identifying metadata before dispatching to nodes. Node sees: model, prompt text, parameters. Never sees: user ID, organization, API key.
- **Workload categorization**: Users tag workloads as "public", "internal", or "confidential". Only "public" routes to Tier 0 nodes.
- **Node operator NDA**: Terms of service include data handling obligations. Legal deterrent, not technical prevention.
- **This is fundamentally the same problem as 8A** — mitigated by the privacy tier architecture in Stream S.
- **Priority**: MEDIUM (covered by Stream S privacy tiers).

### 9D. Stripe Connect Payout Fraud — Stolen Identity
**Attack**: Attacker uses a stolen identity to pass Stripe Connect KYC. Runs a node, earns payouts, then the real identity holder disputes the Stripe account. InferLane is left holding the liability.

**Infrastructure response**:
- **Stripe handles this**: Connect Express includes identity verification, and Stripe assumes fraud liability for Express accounts.
- **Delayed settlement reduces exposure**: If the attacker only gets weekly payouts with a $5 minimum, maximum exposure per fraudulent account is ~$20 before detection.
- **Account velocity limits**: New Connect accounts capped at $50/week for first month. Increases to $500/week after 30 days of clean activity.
- **Priority**: LOW — Stripe's fraud stack handles the heavy lifting.

### 9E. Node Operator Collusion on Pricing
**Attack**: Multiple node operators coordinate to set high prices, refusing to process requests below their cartel rate. On a thin market with few nodes, this creates monopoly pricing.

**Infrastructure response**:
- **InferLane sets the rate, not node operators**. Node operators don't set prices — the platform determines cost based on model pricing and the 80/20 split (80% to node, 20% platform). Operators either accept the rate or don't participate.
- **Open market**: Any new operator can undercut by simply joining the network. Low barrier to entry prevents sustainable cartel behavior.
- **Fallback to centralised providers**: If all nodes are overpriced or unavailable, InferLane routes to centralised provider APIs (Anthropic, OpenAI, etc.) using the user's own API keys. This caps the effective price.
- **Priority**: LOW — market structure prevents this.

### 9F. DDoS via Fake Requests
**Attack**: Attacker floods the dispatch system with requests from fake/stolen credits, overwhelming node operators with work they'll never get paid for (because the credits are invalid).

**Infrastructure response**:
- **Credit reservation happens BEFORE dispatch**. The `UPDATE ... WHERE available >= estimatedCost` must succeed or the request is rejected. No credits = no dispatch. Fake credits can't pass this check.
- **Rate limiting per API key**: Already implemented at 100 req/min. Prevents volume flooding.
- **API key revocation**: Stolen API keys can be revoked immediately, stopping all associated requests.
- **Node-side rate limiting**: Nodes should also enforce their own per-source rate limits. If InferLane sends an unusual volume, the node can throttle or reject.
- **Priority**: LOW — existing rate limiting and credit reservation prevent this.

### 9G. Settlement Timing Arbitrage
**Attack**: Node operator knows settlement runs daily at midnight UTC. They bring their node online at 11:55pm, process a burst of requests for 10 minutes, then go offline. They get paid in the morning settlement for minimal uptime commitment.

**Infrastructure response**:
- **This is fine**. If the node completed real work during those 10 minutes, they deserve payment. The system doesn't require minimum uptime — it pays for results.
- **However**: Factor uptime into reputation scoring. Nodes with >90% uptime over 7 days get priority routing. Intermittent nodes get leftover traffic.
- **Priority**: NONE — this is actually desired behavior (burst capacity).

---

## Updated Priority Matrix (with Category 8 + 9)

| Priority | Issue | Category | Effort |
|---|---|---|---|
| **CRITICAL** | ~~Credits not consumed by proxy (3D)~~ | ~~Economic~~ | ~~DONE~~ |
| **CRITICAL** | Privacy tier architecture for OpenClaw routing (8A) | Privacy | High — design + Tier 0/1 implementation |
| **HIGH** | ~~CreditBalance invariant violation (4A)~~ | ~~Integrity~~ | ~~DONE~~ |
| **HIGH** | ~~Auto-reprice default + repriceFloor (5D)~~ | ~~Trust~~ | ~~DONE~~ |
| **HIGH** | Joint encryption / Shamir sharing for queries (8G) | Privacy | High — crypto library + router integration |
| **HIGH** | Allocation cron race condition (2B) | Integrity | Low — add FOR UPDATE + defensive math |
| **HIGH** | Stripe escrow for real-money trades (4D) | Financial | High — full escrow system |
| **HIGH** | Provider TOS legal review (6C) | Legal | N/A — external |
| **HIGH** | Flash node registration fraud (9A) | Settlement | Medium — settlement delay + reputation threshold |
| **HIGH** | Fabricated/cached node responses (9B) | Settlement | Medium — canary requests + quality sampling |
| **MEDIUM** | Prompt splittability classifier (8B) | Privacy | Medium — ML classifier or heuristic |
| **MEDIUM** | Node reputation + anti-collusion (8C) | Trust | Medium — scoring system |
| **MEDIUM** | Geo-fencing + compliance tiers (8E) | Compliance | Medium — policy engine |
| **MEDIUM** | Node operator prompt extraction (9C) | Privacy | Medium — covered by Stream S tiers |
| **MEDIUM** | ~~Pool rate cap below marketplace floor (3B)~~ | ~~Economic~~ | ~~DONE~~ |
| **MEDIUM** | Cron overlap / advisory locks (4C) | Ops | Low |
| **MEDIUM** | Wash trade detection (1A) | Abuse | Medium |
| **LOW** | Latency-aware tier selection (8F) | UX | Medium |
| **LOW** | Model weight protection (8D) | IP | Low — out of scope for Phase 0 |
| **LOW** | Stripe Connect payout fraud (9D) | Settlement | Low — Stripe handles KYC/fraud |
| **LOW** | Node operator price collusion (9E) | Economic | Low — platform sets rates |
| **LOW** | DDoS via fake requests (9F) | Integrity | Low — credit reservation prevents |
| **NONE** | Settlement timing arbitrage (9G) | Economic | None — desired behavior |
