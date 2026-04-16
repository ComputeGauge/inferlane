# InferLane Compute Exchange — Build Plan

**Vision:** The neutral clearinghouse where LLM providers sell idle capacity and buyers purchase inference at spot prices — with hardware-attested trust and real-time settlement.

**Analogy:** AEMO (Australian Energy Market Operator) for compute. Generators list capacity. Retailers bid. The exchange clears, verifies, settles.

---

## What exists today (Phase 1 primitives already built)

| Primitive | File | Exchange role |
|---|---|---|
| Multi-provider router | `src/lib/proxy/router.ts` | Dispatch engine |
| Health tracker | `src/lib/proxy/health-tracker.ts` | Provider reliability scoring |
| Request classifier | `src/lib/proxy/request-classifier.ts` | Workload complexity classification |
| Smart queue | `src/lib/scheduler/smart-queue.ts` | Price-sensitive execution / order matching |
| Savings ledger | `src/lib/billing/savings-ledger.ts` | Clearing ledger (whatYouPaid vs whatYouWouldHavePaid) |
| Escrow ledger | `src/lib/billing/escrow-ledger.ts` | Double-entry settlement |
| TEE attestation | `src/lib/attestation/` | Hardware trust verification (Apple/Intel/AMD) |
| OpenClaw nodes | `src/app/api/nodes/` | Decentralized supply-side registry |
| Capacity orchestrator | `src/lib/nodes/orchestrator.ts` | Idle detection, batch allocation, overflow |
| Universal dispatch | `src/lib/dispatch/universal-dispatch.ts` | Sync/async/batch/chain execution |
| Cross-provider sessions | `src/lib/dispatch/session-manager.ts` | Context migration between providers |
| Promotion discovery | `src/lib/promotions/crawler.ts` | Real-time pricing intelligence |
| Rebate system | `src/lib/rebates/` | Provider partnership economics |
| Trading module | `src/app/api/trading/` | Compute futures (partial) |
| Credit system | `src/app/api/credits/` | Balance management + transactions |
| Notification delivery | `src/lib/alerts/delivery.ts` | Email/Slack/Telegram/Discord/Webhook |

---

## Phase 2: Provider Capacity Exchange (8-12 weeks)

### 2.1 Capacity Listing API (Week 1-2)

Providers (centralized or decentralized) list available compute capacity with pricing, constraints, and time windows.

**New data model:**

```prisma
model CapacityOffer {
  id              String   @id @default(cuid())
  providerId      String   // NodeOperator ID or centralized provider key
  providerType    ProviderType // CENTRALIZED | DECENTRALIZED | HYBRID

  // What's being offered
  model           String   // e.g. "claude-sonnet-4-5", "llama-3.3-70b"
  maxTokensPerSec Int      // throughput ceiling
  maxConcurrent   Int      // max parallel requests
  gpuType         String?  // e.g. "H100", "Apple M4 Max", "RTX 4090"
  memoryGb        Int?     // available VRAM/unified memory

  // Pricing
  inputPricePerMtok   Decimal @db.Decimal(12, 6) // $/M input tokens
  outputPricePerMtok  Decimal @db.Decimal(12, 6) // $/M output tokens
  minimumSpend        Decimal @db.Decimal(12, 2) @default(0)

  // Availability window
  availableFrom   DateTime
  availableUntil  DateTime
  timezone        String   @default("UTC")
  recurringCron   String?  // e.g. "0 22 * * *" for nightly 10pm-6am

  // Trust
  attestationType AttestationType?
  lastAttestation DateTime?
  attestationHash String?  // SHA-256 of the last verified attestation

  // Status
  status          OfferStatus @default(ACTIVE)
  utilizationPct  Int         @default(0) // current load 0-100
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // Relations
  provider        NodeOperator? @relation(fields: [providerId], references: [id])
  fills           CapacityFill[]

  @@index([model, status, inputPricePerMtok])
  @@index([availableFrom, availableUntil])
  @@map("capacity_offers")
}

enum ProviderType {
  CENTRALIZED    // Anthropic, OpenAI, Google
  DECENTRALIZED  // Darkbloom, OpenClaw, individual operators
  HYBRID         // Enterprise on-prem with cloud burst
}

enum OfferStatus {
  ACTIVE
  PAUSED
  EXHAUSTED     // max concurrent reached
  EXPIRED       // past availableUntil
  WITHDRAWN
}
```

**API routes:**

| Method | Path | Description |
|---|---|---|
| POST | `/api/exchange/offers` | Create a capacity offer |
| GET | `/api/exchange/offers` | List active offers (filterable by model, price, provider type) |
| PATCH | `/api/exchange/offers/:id` | Update offer (price, availability, pause) |
| DELETE | `/api/exchange/offers/:id` | Withdraw an offer |
| GET | `/api/exchange/offers/:id/utilization` | Real-time utilization snapshot |

**Files to create:**
- `src/app/api/exchange/offers/route.ts`
- `src/app/api/exchange/offers/[offerId]/route.ts`
- `src/lib/exchange/offer-manager.ts` — CRUD + validation + expiry checks
- `src/lib/exchange/types.ts` — shared types

### 2.2 Spot Pricing Engine (Week 2-3)

Real-time best-available-price discovery across all active offers. The core matching algorithm.

**How it works:**

```
Request: "I need claude-sonnet-4-5, ~2000 input tokens, ~500 output tokens, latency < 2s"

Engine:
  1. Filter active offers where model matches (or equivalent)
  2. Filter by latency constraint (exclude providers with p95 > 2s)
  3. Filter by attestation requirement (if buyer requires TEE)
  4. Sort by effective price (input_price * input_tokens + output_price * output_tokens)
  5. Return top N candidates with prices
  6. Router picks the winner and dispatches
```

**Key design decisions:**
- The spot engine is a READ-ONLY query over the offers table + health tracker data
- Prices update in real-time as offers are added/modified/withdrawn
- The engine respects the provider's `maxConcurrent` — if a provider is at capacity, they're excluded
- Equivalent models are matched via the existing `model-equivalence.ts` map

**Files to create:**
- `src/lib/exchange/spot-engine.ts` — the matching algorithm
- `src/lib/exchange/price-feed.ts` — aggregated pricing data (min/max/median per model per hour)

**Integration with existing router:**
```ts
// In src/lib/proxy/router.ts routeAuto():
// Before: pick from hardcoded provider list with health scores
// After: query spot engine for best available offer, include in candidate pool
const spotCandidates = await spotEngine.findBestOffers({
  model: request.model,
  estimatedInputTokens: request.inputTokens,
  estimatedOutputTokens: request.outputTokens,
  maxLatencyMs: request.maxLatencyMs,
  requireAttestation: request.privacyTier === 'CONFIDENTIAL',
});
// Merge spotCandidates with existing provider candidates
// Score all candidates together using the existing composite scorer
```

### 2.3 Provider-to-Provider Routing (Week 3-4)

The flow where Anthropic's overflow routes to Darkbloom operators, or a Darkbloom node's overflow routes to Anthropic.

**Architecture:**

```
User → InferLane Proxy → [Router Decision]
                              │
                    ┌─────────┴─────────┐
                    │                   │
              Primary Provider    Exchange Fallback
              (user's config)     (spot engine picks)
                    │                   │
              if at capacity ──────────►│
                                        │
                                  Fill against best
                                  available offer
                                        │
                                  Record in ledger
```

**Key change to the proxy route:**

The existing `forwardToProvider()` in `src/app/api/proxy/route.ts` currently forwards to a single provider. The exchange adds a fallback path:

1. Try the user's configured provider first
2. If the provider returns 429 (rate limited) or 503 (overloaded):
   - Query the spot engine for alternatives
   - Forward to the best alternative
   - Record the "exchange fill" in the ledger
3. The user sees a seamless response — they don't know the exchange re-routed

**Files to create:**
- `src/lib/exchange/fill-manager.ts` — records each "fill" (a request matched to an offer)
- `src/app/api/exchange/fills/route.ts` — query fill history

**New data model:**

```prisma
model CapacityFill {
  id              String   @id @default(cuid())
  offerId         String
  buyerUserId     String
  sellerProviderId String

  // What was filled
  model           String
  inputTokens     Int
  outputTokens    Int
  latencyMs       Int

  // Economics
  buyerPaidUsd    Decimal  @db.Decimal(16, 8)
  sellerEarnedUsd Decimal  @db.Decimal(16, 8)
  exchangeFeeUsd  Decimal  @db.Decimal(16, 8) // InferLane's spread
  spreadBps       Int      // basis points of spread taken

  // Provenance
  attestationHash String?  // proof the execution was attested
  proxyRequestId  String?  // link to the original proxy request
  createdAt       DateTime @default(now())

  offer           CapacityOffer @relation(fields: [offerId], references: [id])

  @@index([buyerUserId, createdAt])
  @@index([sellerProviderId, createdAt])
  @@map("capacity_fills")
}
```

### 2.4 Attestation in the Routing Decision (Week 4-5)

Wire the existing TEE attestation verifiers into the exchange routing path. Only route to providers that have a fresh `VERIFIED` attestation when the buyer requests the `CONFIDENTIAL` privacy tier.

**This is where `router-commercial.ts` (267 lines, already written) becomes load-bearing.** It already has:
- Attestation-aware pre-filtering
- `PrivacyTier: 'TRANSPORT_ONLY' | 'CONFIDENTIAL' | 'FEDERATED'`
- Rebate-aware post-processing
- Tiebreaker logic for equivalent-score candidates

**Changes needed:**
1. Wire `router-commercial.ts` into the proxy route (currently imported but not in the hot path)
2. Add an `attestation_required: boolean` field to CapacityOffer
3. Offers from TEE-verified providers get a trust bonus in the composite score
4. The attestation hash is recorded on each CapacityFill for audit trail

**Files to modify:**
- `src/app/api/proxy/route.ts` — integrate `router-commercial.ts` for Confidential-tier requests
- `src/lib/proxy/router-commercial.ts` — connect to the exchange's offer pool
- `src/lib/attestation/index.ts` — expose a quick `isProviderAttested(providerId)` check

### 2.5 Provider Onboarding Flow (Week 5-6)

Self-serve enrollment for sellers (both centralized and decentralized).

**Centralized provider onboarding (Anthropic, OpenAI, Google):**
1. Provider creates an InferLane account
2. Configures their capacity offer (model, pricing, availability windows)
3. Provides an API endpoint where InferLane can forward requests
4. Sets up settlement (bank account via Stripe Connect — already built)
5. Optionally provides attestation for TEE-verified routing

**Decentralized operator onboarding (Darkbloom, individual Mac owners):**
1. Install the InferLane node agent (`curl -fsSL inferlane.dev/install.sh | bash`)
2. Agent auto-detects hardware (GPU type, VRAM, supported models)
3. Agent registers with the exchange via `/api/nodes/register` (already built)
4. Agent runs TEE attestation and uploads proof
5. Agent starts heartbeating capacity + utilization to `/api/nodes/heartbeat` (already built)
6. Exchange auto-creates CapacityOffers based on the agent's reported capabilities

**Dashboard pages:**
- `/dashboard/operator/onboarding` — step-by-step wizard (already exists, enhance)
- `/dashboard/operator/offers` — manage active capacity offers
- `/dashboard/operator/earnings` — see fills + revenue (already exists)

### 2.6 Real-Time Utilization Feeds (Week 6-7)

Providers report current load so the exchange can make informed routing decisions.

**For decentralized operators:** The node agent already heartbeats to `/api/nodes/heartbeat`. Extend the heartbeat payload to include:
```json
{
  "nodeId": "...",
  "utilizationPct": 45,
  "activeRequests": 3,
  "maxConcurrent": 8,
  "queueDepth": 0,
  "modelsLoaded": ["llama-3.3-70b", "gemma-4-26b"],
  "memoryUsedGb": 24,
  "memoryTotalGb": 64
}
```

**For centralized providers:** They won't heartbeat to us. Instead, we infer utilization from:
- Response latency trends (rising latency = rising utilization)
- 429 rate-limit frequency (more 429s = at capacity)
- The existing health tracker already captures both of these

**Files to modify:**
- `src/app/api/nodes/heartbeat/route.ts` — extend payload schema
- `src/lib/proxy/health-tracker.ts` — expose inferred utilization for centralized providers
- `src/lib/exchange/utilization-aggregator.ts` — combine both sources into a unified view

### 2.7 Exchange Dashboard (Week 7-8)

**New dashboard pages:**

| Page | What it shows |
|---|---|
| `/dashboard/exchange` | Live order book — active offers, recent fills, spot prices |
| `/dashboard/exchange/offers` | Seller's view — manage your capacity offers |
| `/dashboard/exchange/fills` | Trade history — every fill with economics |
| `/dashboard/exchange/analytics` | Market analytics — price trends, utilization curves, volume |

**Public-facing pages:**

| Page | What it shows |
|---|---|
| `/exchange` | Public view of the spot market — no login required |
| `/exchange/pricing` | Current spot prices per model per provider type |
| `/exchange/status` | Market health — total capacity, current demand, fill rate |

---

## Phase 3: Compute Futures Market (Week 12-20)

Forward contracts on inference capacity. Buy guaranteed capacity for next month at a fixed price.

### 3.1 Futures Contract Model

```prisma
model ComputeFuture {
  id              String   @id @default(cuid())
  buyerUserId     String
  sellerProviderId String

  // Contract terms
  model           String
  guaranteedTokPerSec Int    // minimum throughput guaranteed
  maxLatencyMs    Int         // SLA ceiling
  pricePerMtokInput  Decimal @db.Decimal(12, 6)
  pricePerMtokOutput Decimal @db.Decimal(12, 6)

  // Duration
  startsAt        DateTime
  expiresAt       DateTime
  autoRenew       Boolean  @default(false)

  // Settlement
  prepaidUsd      Decimal  @db.Decimal(12, 2)
  usedUsd         Decimal  @db.Decimal(12, 2) @default(0)
  status          FutureStatus @default(ACTIVE)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("compute_futures")
}

enum FutureStatus {
  PENDING     // awaiting seller confirmation
  ACTIVE      // live, capacity guaranteed
  EXHAUSTED   // prepaid balance used up
  EXPIRED     // past expiresAt
  CANCELLED
}
```

### 3.2 Why Providers Buy Futures

**Buyers:**
- Lock in capacity at today's price before a model launch (demand spike)
- Guarantee SLA for production workloads (not subject to spot availability)
- Budget predictability (fixed monthly cost vs variable spot)

**Sellers:**
- Revenue smoothing (guaranteed income even during low-demand periods)
- Capacity planning (know your committed load ahead of time)
- Premium pricing (futures trade at 10-20% premium over spot because they include a guarantee)

### 3.3 The Trading Module

The existing `src/app/api/trading/` endpoints become the futures exchange:
- POST `/api/exchange/futures` — create a futures contract
- GET `/api/exchange/futures` — list active contracts
- POST `/api/exchange/futures/:id/exercise` — use your guaranteed capacity
- Market orders, limit orders, and auctions for capacity

---

## Phase 4: The InferLane Index (Week 20-30)

**The real-time inference pricing index** — like the S&P 500 but for compute.

### 4.1 Index Construction

```
InferLane Frontier Index = weighted average spot price across all frontier models
  - Claude Sonnet weight: 30% (highest volume)
  - GPT-4o weight: 25%
  - Gemini 2.5 Pro weight: 20%
  - DeepSeek V3 weight: 15%
  - Open-source (Llama/Gemma) weight: 10%

Updated every 60 seconds from actual fill prices on the exchange.
```

### 4.2 Data Products

| Product | Audience | Pricing |
|---|---|---|
| Real-time pricing feed (WebSocket) | Trading desks, quant funds | $500/month |
| Historical pricing API | Researchers, analysts | $100/month |
| Utilization heatmap | Capacity planners | $200/month |
| Provider benchmarks | LLM providers (competitive intelligence) | $1,000/month |

### 4.3 The "AEMO" Brand Position

- Publish weekly "State of Compute" report (you already have `STATE_OF_COMPUTE_REPORT.md`)
- Publish the InferLane Index publicly (brand building, not revenue)
- Host a quarterly "Compute Market Outlook" webinar
- Become the reference price for inference capacity globally

---

## Revenue Projections

### Phase 2 (Provider Capacity Exchange)

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Monthly exchange volume | $1M | $10M | $50M |
| Spread (2%) | $20K/mo | $200K/mo | $1M/mo |
| Attestation fees | $5K/mo | $30K/mo | $100K/mo |
| **Monthly revenue** | **$25K** | **$230K** | **$1.1M** |

### Phase 3 (Compute Futures)

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Open interest (contracted capacity) | $500K | $5M | $25M |
| Trading fee (1%) | $5K/mo | $50K/mo | $250K/mo |
| Premium capture (futures vs spot spread) | $10K/mo | $100K/mo | $500K/mo |
| **Monthly revenue** | **$15K** | **$150K** | **$750K** |

### Phase 4 (Data Products)

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Data subscribers | 10 | 100 | 500 |
| Avg revenue per subscriber | $300/mo | $400/mo | $500/mo |
| **Monthly revenue** | **$3K** | **$40K** | **$250K** |

### Combined at full build

| | Conservative | Moderate | Aggressive |
|---|---|---|---|
| **Annual revenue** | $516K | $5M | $25.2M |
| **Moat** | Network effect (liquidity) | + Data advantage | + Regulatory position |

---

## Key Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LLM providers refuse to participate | HIGH | Start with decentralized supply only, prove the exchange works, then approach centralized providers with data showing their idle capacity revenue opportunity |
| Latency overhead of exchange routing | MEDIUM | Exchange adds <50ms to routing decision; for async/batch workloads this is invisible; for real-time, buyers can set latency constraints |
| Regulatory classification as a financial exchange | MEDIUM | Compute capacity is not a financial instrument (yet). If regulators classify futures as derivatives, engage counsel early. The electricity market analogy helps — AEMO is regulated but the regulation HELPS because it creates trust |
| Trust/security of decentralized operators | HIGH | TEE attestation is the answer — and you've already built the verification layer. Make attestation mandatory for Confidential-tier and optional (with pricing discount) for Transport-only |
| Race to zero on provider pricing | MEDIUM | The exchange benefits from volume, not margin. If prices drop, volume goes up (more workloads become economical). InferLane's 2% spread applies to whatever the market price is |

---

## First 5 Concrete Steps (this week)

1. **Create `src/lib/exchange/` directory** with `types.ts`, `offer-manager.ts`, `spot-engine.ts`
2. **Add `CapacityOffer` + `CapacityFill` to Prisma schema** (additive, non-breaking)
3. **Build the spot engine** — the matching algorithm that finds the cheapest available offer for a given request
4. **Wire the spot engine into `router.ts`** as an additional candidate source alongside existing providers
5. **Create `/api/exchange/offers` POST/GET** so operators can list capacity

These 5 steps create a minimal viable exchange: operators can list capacity, the router can discover and route to it, and fills are recorded. Everything else is iteration on top.

---

## The One-Liner for Each Audience

**For LLM providers:** "Monetize your idle GPUs. List excess capacity on InferLane and earn revenue on hardware that's currently earning $0."

**For developers/agents:** "Get the cheapest inference available right now. InferLane's spot engine queries every provider — centralized and decentralized — and routes to the best price in real time."

**For investors:** "InferLane is the AEMO of compute — the neutral exchange where inference capacity is traded. Network effect moat, 2% spread on every transaction, $25M+ ARR at scale."

**For Gajesh/Darkbloom:** "We're the exchange your operators list on. Every Mac owner who joins Darkbloom becomes a seller on InferLane. Your growth is our growth."
