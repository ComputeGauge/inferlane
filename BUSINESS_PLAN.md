# InferLane — Business Plan & Revenue Strategy
## "The Cost Intelligence Layer for AI Agents"
## (Working name: FuelGauge → Renamed to InferLane — see NAMING_ANALYSIS.md for full IP/trademark clearance)

---

## Vision
Become the cost intelligence infrastructure between AI agents and ALL AI compute — cloud APIs, on-premise GPUs, and hybrid environments. The agent calls `pick_model`, we tell it what to use. The agent calls `log_request`, we track the cost. Every decision feeds our data flywheel. Every session builds the most comprehensive AI cost/quality dataset on Earth.

---

## Market Validation (February 2026 — Verified Data)

The market opportunity is validated by hard numbers:

| Validation Point | Data | Source |
|-----------------|------|--------|
| AI spending 2025 | **$1.76 trillion** | Gartner |
| Companies misestimating AI costs | **85%** (25% off by >50%) | Benchmarkit |
| Cost overruns impacting profitability | **43%** of companies | IDC |
| Companies tracking AI spend at all | Only **63%** | FinOps Foundation |
| Companies abandoning AI due to costs | **42%** (up from 17%) | Industry survey |
| Enterprise monthly AI spend | **$85.5K avg** (36% YoY growth) | CloudZero |
| Enterprise AI API spend market | **$8.4B** (doubled from $3.5B) | Menlo Ventures |
| Cloud FinOps market | **$14.9B** → $26.9B by 2030 | MarketsandMarkets |
| AI agent market | **$7-8B** → $50B+ by 2030 (46% CAGR) | Grand View Research |
| MCP ecosystem | **10K+ servers, 97M+ monthly downloads** | MCP Foundation |
| Dedicated AI FinOps tools | **ZERO** (we are the first) | Competitive analysis |

**The pain is acute, the market is massive, and nobody is solving it.** See COMPETITIVE_LANDSCAPE.md for full analysis.

---

## Phase Roadmap

### Phase 0: MCP Server + CLI + Cost Intelligence Engine (Month 1) 🚀 THE DISTRIBUTION HACK
**Goal:** Get into developers' daily workflows BEFORE the dashboard is polished. Save agents money from Day 1. Start the data flywheel.

**MCP Server (@inferlane/mcp v0.3.0 — Apache-2.0, open source, AGENT-NATIVE)**
- **7 Agent-Native Tools**: `pick_model` (choose optimal model per task — THE core product), `log_request` (track cost per API call — feeds data flywheel), `session_cost` (real-time session spend), `rate_recommendation` (quality feedback loop), `model_ratings` (leaderboard), `improvement_cycle` (continuous improvement), `integrity_report` (transparency)
- **5 Credibility + Routing Tools**: `credibility_profile` (agent reputation score — retention mechanism), `credibility_leaderboard` (competitive ranking), `route_to_cloud` (local→cloud routing), `assess_routing` (local vs cloud decision), `cluster_status` (local inference detection)
- **6 Intelligence Tools**: `get_spend_summary`, `get_budget_status`, `get_model_pricing`, `get_cost_comparison`, `suggest_savings`, `get_usage_trend`
- **7 Resources**: `inferlane://config`, `inferlane://session`, `inferlane://ratings`, `inferlane://credibility`, `inferlane://cluster`, `inferlane://quickstart`
- **3 Prompts**: `cost_aware_system`, `daily_cost_report`, `optimize_workflow`
- **Agent Decision Engine**: Scores 20+ models across cost/quality/speed for 14 task types. Log-scale normalization handles 1000x price ranges.
- **Credibility System** (retention layer): 0-1000 score, 6 tiers, 10 badges. Not the core moat — but makes switching painful.
- **Local Cluster Integration**: Auto-detects Ollama, vLLM, llama.cpp, TGI, LocalAI. Quality assessment per task type.

**Why COST INTELLIGENCE is the core value prop:**
The evolution from nice-to-have to infrastructure:
- **v0.1**: Agent can look up pricing if asked → nice to have
- **v0.2**: Agent calls `pick_model` before every sub-task → saves 40-70% → can't work efficiently without us
- **v0.3**: Agent earns credibility for smart cost decisions → retention mechanism → switching means losing track record

**The honest competitive picture:** Agent reputation systems exist (ERC-8004, mTrust, Scorecard, $1.2B+ in agent identity VC). But **nobody has AI cost intelligence in MCP.** AWS has a billing MCP (AWS only). OpenCost has a K8s MCP. We're the only multi-provider AI cost management MCP server. That's the real first-mover advantage.

**The Cost Intelligence Flywheel:**
```
COST:     Agent calls pick_model → saves 40-70% → immediate measurable ROI → more agents adopt
DATA:     Every log_request feeds quality scores → pick_model gets smarter → recommendations improve → more agents trust it
RETAIN:   Agent earns credibility → switching means starting at zero → churn drops
ROUTING:  Local agent hits limit → routes to cloud via CG → earns credibility → revenue bridge activates
CLI:      Developer uses CLI daily → sees value → tells team → team upgrades to paid tier
```

**The Agent Session Loop:**
```
Agent starts session → calls pick_model("code_review","balanced") → gets optimal model at 40% less cost
  → uses recommended model → logs request → feeds quality data back → rates recommendation
  → earns credibility for smart decisions → reputation grows
  → hits complex task → assess_routing says "cloud needed" → routes via pick_model → logs cost → earns +70 credibility
  → session ends: $3.50 saved vs. naive model selection. Credibility: 285 (Silver tier).
  → next session: pick_model is smarter because of this session's data. DATA FLYWHEEL.
```

**CLI (@inferlane/cli — Apache-2.0, open source)**
- Commands: `status`, `spend`, `pricing`, `compare`, `budget`, `savings`
- Creates daily developer touchpoints (`cg spend` before standup = not churning)

**Adapters (@inferlane/adapters — Apache-2.0, open source)**
- TypeScript `InferLaneAdapter` interface — the open-source contract
- Anthropic + OpenAI adapters shipped first, community builds the rest

**Revenue:** $0 direct (open source) — but generates ALL top-of-funnel acquisition
**Strategic value:** MCP installs + pick_model calls/day + $ saved by agents + data points collected + cloud routing revenue = the metrics that make Datadog/IBM/Snowflake say "they own the AI cost intelligence layer"

### Phase 1: Dashboard + Affiliate (Month 1-2)
**Goal:** Ship MVP, get users, prove market demand

- Deploy to Vercel
- Real NextAuth (Google, Apple, GitHub, Microsoft, email magic link)
- Connect real provider APIs (Anthropic, OpenAI, Google AI usage endpoints)
- Affiliate links to cloud marketplace alternatives (AWS Bedrock, Azure OpenAI, GCP Vertex)
- Marketplace with 10+ listed AI platforms
- MCP server + CLI drive users to dashboard for advanced features (alerts, budgets, team management)
- Revenue: SaaS subscriptions ($0/9/29) + affiliate commissions (8-18% recurring)

**Revenue ceiling:** ~$500K-$1M/year

### Phase 2: API Proxy/Router (Month 2-3) ⚡ THE 10x UNLOCK
**Goal:** Route AI API traffic through InferLane, take margin

- Teams point API calls at `api.inferlane.ai`
- Pass-through to cheapest/fastest provider in real-time
- Smart routing: auto-select best model for task type + cost
- 3-8% margin on all traffic flowing through
- OpenAI-compatible API format (drop-in replacement)

**Revenue math:**
- $2M/month traffic × 5% margin = $100K/month
- $10M/month traffic × 5% margin = $500K/month = $6M/year

**Revenue ceiling:** $10-50M/year

### Phase 3: On-Prem GPU Agent + Hybrid Dashboard (Month 3-5) 🔧 THE HYBRID UNLOCK
**Goal:** Track on-prem AI costs alongside cloud, become the "total cost of AI" platform

- Lightweight Docker agent that reads NVIDIA DCGM/nvidia-smi metrics from on-prem GPUs
- Calculate cost-per-token for self-hosted models (amortized hardware + electricity + cooling)
- Unified dashboard: cloud API spend + on-prem GPU cost in one view
- Cloud ↔ on-prem migration advisor ("this workload is cheaper on-prem/cloud")
- Hardware marketplace (GPU affiliates: NVIDIA, Dell, SuperMicro, Lambda Labs)
- New pricing tier: Hybrid ($29/mo) for teams running both cloud and on-prem

**Revenue math:**
- On-prem agent: $49/month per monitored cluster × 200 clusters = $9,800/month
- Hardware marketplace: 5% commission on $50K avg GPU purchases × 30/month = $75K/month
- Higher ARPU: Hybrid tier lifts avg from $12 to $22/user

**Revenue ceiling:** $3-8M/year (additive to cloud revenue)

**Why this matters:** Nobody currently provides unified "total cost of AI" across cloud + on-prem. This is a massive unoccupied gap. See ON_PREM_STRATEGY.md for full analysis.

### Phase 4: FinOps Automation (Month 5-7)
**Goal:** Don't just show waste — automatically fix it

- Auto-downgrade models when quality difference is negligible
- Auto-switch providers when one is cheaper for identical quality
- Auto-route between cloud and on-prem based on cost/latency/compliance
- Scheduled scaling: reduce tier during off-hours
- Charge % of savings (15% of money saved)

**Revenue math:**
- Team spending $50K/month → save 20-35% ($12K) → our fee $1,800/month
- Cloud→on-prem migrations generate BIGGER savings = bigger fees
- 100 customers × $1,800 = $180K/month = $2.16M/year

**Revenue ceiling:** $2-5M/year

### Phase 5: Enterprise Governance & Compliance (Month 7+)
**Goal:** Land enterprise contracts with massive budgets

- Prompt auditing: Log every API call, flag PII/sensitive data
- Budget enforcement: Hard-stop API access when team/project exceeds budget
- Model access policies: Role-based model permissions
- SOC 2 / HIPAA compliance reports: Auto-generated audit trails
- Charge $5K-$25K/month per enterprise seat

**Revenue math:**
- 20 enterprise customers × $10K/month = $200K/month = $2.4M/year

**Revenue ceiling:** $20-100M/year

### Phase 6: AI Spend Financing / Credit Marketplace (Month 9+)
**Goal:** Become "Brex for AI spend"

- Prepaid AI credits at bulk discount
- Net-30/60 payment terms on AI compute (2-5% financing fee)
- Volume discount arbitrage

**Revenue math:**
- Finance $5M/month at 3% = $150K/month = $1.8M/year

**Revenue ceiling:** $50M+/year

---

## Year 1 Financial Projections (Bull Case — Hybrid Model)

| Month | Proxy Rev | FinOps Rev | SaaS+Affiliate | On-Prem+Hardware | Total |
|-------|----------|-----------|----------------|-----------------|-------|
| 1     | $0       | $0        | $1K            | $0              | $1K   |
| 2     | $0       | $0        | $2K            | $0              | $2K   |
| 3     | $10K     | $8K       | $3K            | $1K             | $22K  |
| 4     | $25K     | $19K      | $6K            | $4K             | $54K  |
| 5     | $40K     | $32K      | $10K           | $10K            | $92K  |
| 6     | $50K     | $40K      | $14K           | $18K            | $122K |
| 7     | $75K     | $56K      | $19K           | $28K            | $178K |
| 8     | $100K    | $72K      | $24K           | $40K            | $236K |
| 9     | $150K    | $96K      | $30K           | $55K            | $331K |
| 10    | $225K    | $128K     | $38K           | $72K            | $463K |
| 11    | $300K    | $160K     | $45K           | $90K            | $595K |
| 12    | $400K    | $192K     | $55K           | $110K           | $757K |
| **Y1**| **~$1.4M**| **~$803K**| **~$247K**   | **~$428K**      |**~$2.9M**|

Exit MRR at Month 12: **$757K** = **$9.1M ARR**

*On-Prem+Hardware includes: GPU agent licenses, hardware marketplace affiliate, migration advisory fees*
*See ON_PREM_STRATEGY.md for detailed hybrid revenue breakdown*

---

## TAM / SAM / SOM

- **TAM:** Global AI infrastructure spend (cloud + on-prem): $200B+ by 2027. On-prem AI hardware market alone ~$50B.
- **SAM:** AI compute cost management (cloud APIs + self-hosted inference): $2-10B (proxy/routing) + $1-5B (on-prem GPU optimization)
- **SOM Year 1:** $2.9M (bull), $900K (base), $250K (bear)

---

## Three Scenarios (Hybrid Model — Cloud + On-Prem)

| Scenario | Y1 Revenue | Exit MRR | Exit ARR | Path |
|----------|-----------|---------|---------|------|
| Bear     | $250K     | $42K    | $500K   | Slow proxy adoption, 20 FinOps customers, minimal on-prem |
| Base     | $900K     | $210K   | $2.5M   | Moderate traction, 50 FinOps, 80 on-prem clusters |
| Bull     | $2.9M     | $757K   | $9.1M   | Strong proxy + FinOps + on-prem + hardware marketplace |

---

## Revenue Streams Summary

### Cloud Revenue Streams
| Stream | Margin | Scalability | Effort |
|--------|--------|-------------|--------|
| SaaS Subscriptions ($0/9/29/49) | 90%+ | Medium | Low |
| Cloud Affiliate Commissions (8-18%) | 100% | Medium | Low |
| Cloud Marketplace Listings ($500-5K/mo) | 95% | Medium | Low |
| API Proxy Margin (3-8%) | 3-8% | Very High | High |
| FinOps % of Savings (15%) | 90%+ | High | Medium |
| Enterprise Governance ($5-25K/mo) | 85%+ | High | High |
| AI Credit Financing (2-5%) | 2-5% | Very High | High |
| Data/Benchmarking Reports | 95% | Medium | Low |

### On-Prem & Hybrid Revenue Streams (NEW)
| Stream | Margin | Scalability | Effort |
|--------|--------|-------------|--------|
| On-Prem GPU Agent License ($49/cluster/mo) | 90%+ | High | Medium |
| Hardware Marketplace (3-8% on GPU purchases) | 3-8% | High | Medium |
| Cloud→On-Prem Migration Advisory (% of savings) | 85%+ | High | Medium |
| Hybrid Proxy (routes cloud + on-prem) | 3-8% | Very High | High |
| TCO Consulting (Enterprise) | 80%+ | Medium | High |

---

## Competitive Moat (Build Order — Updated Post Market Research)

1. **Cost intelligence data flywheel** — Every `pick_model` + `log_request` feeds model quality/cost data. After 100K sessions, this dataset is unreplicable. This is the Datadog playbook.
2. **MCP distribution lock-in** — First AI cost intelligence MCP server. 10K+ MCP servers exist but none do cost management. First mover in a standard backed by OpenAI, Google, Anthropic under the Linux Foundation.
3. **Hybrid complexity moat** — No tool unifies cloud API costs + on-prem GPU costs + hardware TCO. CloudZero ($119M) can't, Kubecost (IBM) can't, Helicone can't. Only us.
4. **Credibility retention** — Agents that build reputation scores don't churn. Not our core moat (the concept isn't novel — ERC-8004, mTrust exist), but powerful retention mechanism when layered on top of cost intelligence.
5. **Proxy switching cost** — Once teams route through `api.inferlane.ai`, rewiring every API endpoint is painful.
6. **Enterprise contracts** — 12-24 month terms with budget enforcement = locked revenue.

---

## Key Metrics to Track

- Monthly Active Users (MAU)
- API Traffic Volume ($ routed through proxy)
- Net Revenue Retention (NRR)
- Affiliate Conversion Rate
- Average Revenue Per User (ARPU)
- Customer Acquisition Cost (CAC)
- Gross Margin by Revenue Stream

---

## Tech Stack

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS + Recharts
- **Auth:** NextAuth (Google, Apple, GitHub, Microsoft, Email)
- **Backend:** Next.js API routes → evolve to dedicated proxy service
- **Proxy:** Edge functions (Cloudflare Workers or Vercel Edge)
- **On-Prem Agent:** Docker container + Go/Rust binary, reads NVIDIA DCGM metrics
- **Database:** PostgreSQL (Supabase or PlanetScale)
- **Analytics:** PostHog or Mixpanel
- **Payments:** Stripe

---

## Provider Usage API Intelligence

Each major AI provider exposes usage/billing data that InferLane aggregates. Reference: Anthropic's Settings → Usage page shows session limits, weekly limits, per-model quotas, extra usage spend, balance, and top-up/reload triggers.

### Known Provider Data Points We Can Pull

| Provider | Endpoint/Method | Data Available |
|---|---|---|
| **Anthropic** | Settings → Usage (web), API billing endpoints | Session %, weekly %, per-model quotas, extra usage $, balance, monthly limit, auto-reload status |
| **OpenAI** | platform.openai.com/usage, /v1/usage API | Daily costs by model, token counts, rate limits, billing history, credit balance |
| **Google AI** | console.cloud.google.com/billing | Vertex AI costs, per-model spend, quotas, budget alerts |
| **Together AI** | api.together.xyz, dashboard | Per-model costs, credit balance, usage history |
| **AWS Bedrock** | AWS Cost Explorer API, CloudWatch | Per-model invocation costs, token counts, provisioned throughput spend |
| **Azure OpenAI** | Azure Cost Management API | Per-deployment costs, token consumption, reserved capacity usage |

### The "Limit Overflow" Monetisation Trigger

When a user exceeds their provider limit (e.g. 116% of monthly budget), they face a decision:
1. **Buy more credits** → We show affiliate top-up link (commission on reload)
2. **Adjust limit higher** → We show cost projection warning
3. **Switch to cheaper provider** → We show Smart Router alternatives (affiliate on signup)
4. **Route overflow to on-prem** → We show migration advisor (hybrid value prop)

**This "red zone" moment is our highest-converting monetisation event.** The Top-Up Banner, marketplace cards, and Smart Router all activate based on provider limit proximity.

---

## Key Strategy Documents

| Document | Contents |
|---|---|
| BUSINESS_PLAN.md | This file — roadmap, financials, TAM, Phase 0 distribution strategy |
| ON_PREM_STRATEGY.md | Full cloud→on-prem analysis, hybrid positioning, contingencies |
| MOAT_STRATEGY.md | 9-layer moat framework (Layer 0 = MCP/CLI distribution), risk scenarios |
| COMPETITIVE_LANDSCAPE.md | 22 competitors, market gaps |
| NAMING_ANALYSIS.md | IP/trademark clearance |
| LEARNINGS_FROM_PROTOCOMMERCE.md | 10 strategic learnings — open-source adapters, MCP distribution, acquisition metrics |
| SAAS_LIFECYCLE_PLAN.md | Full SaaS lifecycle status tracker — 16 phases mapped with action items |

---

## Open Source vs. Commercial Split

| Component | License | Why |
|---|---|---|
| `@inferlane/adapters` | Apache-2.0 | Ecosystem moat — community builds integrations |
| `@inferlane/mcp` | Apache-2.0 | Distribution — viral spread through MCP ecosystem |
| `@inferlane/cli` | Apache-2.0 | Distribution — npm installs = acquisition metrics |
| Dashboard + Billing | Commercial | Revenue — SaaS subscriptions, admin, teams |
| API Proxy Engine | Commercial | Revenue — routing margin, smart optimization |
| FinOps Automation | Commercial | Revenue — % of savings |
| Enterprise Governance | Commercial | Revenue — enterprise contracts |

---

## Exit Strategy & Valuation Analysis

### Target Acquirers (Ranked by Likelihood)

| Acquirer | Market Cap / Status | Why They'd Buy Us | What They'd Pay |
|----------|-------------------|-------------------|-----------------|
| **Datadog** | $40B+, $3.43B rev | 12% AI-native revenue, need cost layer. Acquiring aggressively (Metaplane, Eppo, Upwind). | $15-150M depending on traction |
| **IBM** | $200B+, FinOps suite | Spent $4.6B on Apptio + acquired Kubecost. Need AI-specific cost intelligence. | $20-100M |
| **Snowflake** | $60B+, expanding AI | Acquired TruEra + Observe (~$1B). Need AI FinOps. | $15-50M |
| **Flexera** | PE-backed consolidator | Acquired Spot, ProsperOps, Chaos Genius in 12 months. AI gap. | $10-40M |
| **Anthropic** | $60B+ val | Would want to own cost optimization for their ecosystem. | Strategic / acqui-hire |
| **Cisco/Splunk** | $230B+ | Building full-stack observability post-$28B Splunk deal. | $20-80M |

### Comparable Exits

| Deal | Price | Revenue Multiple | Date |
|------|-------|-----------------|------|
| Apptio → IBM | $4.6B | ~10x | Jun 2023 |
| W&B → CoreWeave | $1.7B | ~10x ARR | Mar 2025 |
| Moveworks → ServiceNow | $2.85B | ~28x ARR | Mar 2025 |
| Kubecost → IBM | Hundreds of M | Strategic | Sep 2024 |
| Observe → Snowflake | ~$1B | Strategic | Jan 2026 |

### Revenue Multiple Benchmarks
- AI infrastructure (early-stage): **47-62x** revenue
- AI agent companies: **30-50x** EV/Revenue
- SaaS M&A (high-growth): **7-10x** ARR
- Median SaaS M&A: **4-5x** revenue

### Exit Timeline Scenarios

| Scenario | Timeline | Revenue | Price Range | Trigger |
|----------|----------|---------|-------------|---------|
| Acqui-hire / tech | M6-12 | Pre-revenue | $5-20M | 5K+ MCP installs, strong data moat |
| Seed strategic | M12-18 | $500K-$2M ARR | $15-50M | Enterprise pilots, proven hybrid value |
| Growth acquisition | M18-24 | $2-5M ARR | $50-150M | Proxy live, enterprise contracts |
| Breakout | M24+ | $10M+ ARR | $200M-$1B+ | The AI FinOps standard |

### Milestones That Pump Valuation

| Milestone | Impact |
|-----------|--------|
| npm publish + first 1,000 installs | Proves MCP distribution channel |
| 10K pick_model calls/day | Proves agent dependency + data moat |
| First $10K MRR | Converts from "project" to "business" |
| First Fortune 500 pilot | 3-5x valuation bump |
| $1M ARR | Sweet spot for strategic tuck-in |
| 100K MCP installs | Network effects visible |
| First hybrid cloud/on-prem customer | Proves unique value (nobody else can do this) |
| $5M ARR | Multiple PE and strategic offers likely |

---

*Last updated: February 2026*
*Updated with market validation research, strategic reframe, exit analysis*
