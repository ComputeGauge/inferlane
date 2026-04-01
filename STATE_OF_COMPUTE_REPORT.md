# State of AI Compute -- Monthly Report

*Generated 2026-03-18 by InferLane*

---

## 1. Compute Spend Summary

| Metric | Value |
|--------|-------|
| Total requests | 1,847,293 |
| Total spend | $42,618.47 |
| Avg cost/request | $0.0231 |
| Providers used | 7 |
| Models used | 14 |
| Input tokens processed | 38.2B |
| Output tokens generated | 4.1B |
| Avg latency (P50) | 340ms |
| Avg latency (P99) | 2,180ms |
| Uptime (platform) | 99.94% |

Month-over-month trends:

| Metric | Feb 2026 | Mar 2026 (proj.) | Delta |
|--------|----------|------------------|-------|
| Request volume | 1,612,040 | 1,847,293 | +14.6% |
| Total spend | $38,910.22 | $42,618.47 | +9.5% |
| Avg cost/req | $0.0241 | $0.0231 | -4.3% |
| Unique models | 12 | 14 | +2 |

> Cost per request is declining even as volume grows -- model routing optimisation and the shift toward workhorse-tier models are reducing blended cost.

---

## 2. Inference Phase Economics -- The Decode Premium

> *Inference has two distinct phases with fundamentally different cost structures.*

| Phase | Cost Driver | $/1M Tokens | Ratio | Nature |
|-------|------------|-------------|-------|--------|
| **Prefill** (prompt ingestion) | FLOPs -- parallelisable across GPU SMs | $0.10 | 1.0x | Compute-bound |
| **Decode** (token generation) | Memory bandwidth -- sequential, reads entire KV cache | $0.30 | 3.0x | Memory-bound |
| **KV Cache** (context retention) | VRAM capacity -- GB of HBM occupied x time | $0.01/GB/hr | -- | Capacity-bound |

### Decode Premium by Model Tier

| Tier | Model | Input (Prefill) | Output (Decode) | Decode Premium |
|------|-------|----------------|-----------------|----------------|
| Frontier | claude-opus-4 | $15.00/1M | $75.00/1M | **5.0x** |
| Frontier | gpt-4o | $5.00/1M | $15.00/1M | **3.0x** |
| Workhorse | claude-sonnet-4 | $3.00/1M | $15.00/1M | **5.0x** |
| Workhorse | gemini-2.0-flash | $0.10/1M | $0.40/1M | **4.0x** |
| Speed | claude-haiku-3.5 | $0.25/1M | $1.25/1M | **5.0x** |
| Budget | deepseek-chat | $0.14/1M | $0.28/1M | **2.0x** |

### Observed Decode Premium Distribution (Platform-Wide)

```
  Decode Premium Histogram (1,847,293 requests)

  2.0x  ██████░░░░░░░░░░░░░░  12.4%   (budget models, short outputs)
  3.0x  ████████████░░░░░░░░  28.7%   (GPT-4o tier)
  4.0x  ██████████░░░░░░░░░░  22.1%   (Gemini, Flash tier)
  5.0x  ████████████████████  36.8%   (Anthropic models, dominant)
```

> The memory wall is not theoretical -- it is the single largest cost multiplier in production inference. Every output token requires a full sequential read of the KV cache from HBM. Longer contexts = more bandwidth consumed per token = higher decode cost.

---

## 3. Memory & Hardware Intelligence

Memory technology determines inference economics. Faster memory = faster decode = more tokens/second = higher node value.

| Memory Technology | Bandwidth | Cost Multiplier | Decode Throughput | Annual Value/Node |
|-------------------|-----------|-----------------|-------------------|-------------------|
| **HBM3E** (H200, next-gen datacenter) | 4,800 GB/s | 1.00x | ~9,600 tok/s | $9,082 |
| **HBM3** (H100 SXM, A100 80GB) | 3,350 GB/s | 0.85x | ~6,700 tok/s | $6,342 |
| **HBM2E** (A100 40GB, older datacenter) | 2,000 GB/s | 0.65x | ~4,000 tok/s | $3,786 |
| **GDDR6X** (RTX 4090, consumer high-end) | 1,000 GB/s | 0.35x | ~2,000 tok/s | $1,893 |
| **GDDR6** (RTX 3090, consumer mid-range) | 768 GB/s | 0.25x | ~1,536 tok/s | $1,454 |
| **DDR5** (CPU inference only) | 64 GB/s | 0.10x | ~128 tok/s | $121 |

### Memory Bandwidth as a Tradeable Resource

| Bandwidth Tier | GB/s | Hourly Value | Annual Value | $/GB/s/hr |
|----------------|------|-------------|--------------|-----------|
| HBM3E | 4,800 | $1.0368 | $9,082.37 | $0.000216 |
| HBM3 | 3,350 | $0.7236 | $6,342.74 | $0.000216 |
| HBM2E | 2,000 | $0.4320 | $3,786.24 | $0.000216 |
| GDDR6X | 1,000 | $0.0756 | $662.26 | $0.000076 |

### Platform Hardware Distribution (Active Nodes)

| Memory Tier | Nodes Online | % of Capacity | Avg Utilisation |
|-------------|-------------|---------------|-----------------|
| HBM3E | 84 | 38.2% | 91.4% |
| HBM3 | 127 | 34.6% | 87.2% |
| HBM2E | 43 | 12.1% | 74.8% |
| GDDR6X | 312 | 11.8% | 62.3% |
| GDDR6 | 198 | 2.9% | 41.7% |
| DDR5 | 46 | 0.4% | 18.9% |

> Decode throughput is a distinct commodity. A node's value is not its FLOP count -- it is its memory bandwidth. An H100 with 3,350 GB/s HBM3 generates decode revenue at ~$0.72/hr. An RTX 4090 with 1,000 GB/s GDDR6X generates ~$0.08/hr. The IL-DECODE and IL-MEMORY indices track these resources separately from generic compute.

---

## 4. Provider Distribution

| Provider | Spend | % of Total | Trend |
|----------|-------|------------|-------|
| Anthropic | $17,473.57 | 41.0% | ████████░░ |
| OpenAI | $10,654.62 | 25.0% | █████░░░░░ |
| Google DeepMind | $5,114.22 | 12.0% | ██░░░░░░░░ |
| Together AI | $3,409.48 | 8.0% | ██░░░░░░░░ |
| Groq | $2,557.11 | 6.0% | █░░░░░░░░░ |
| DeepSeek | $2,131.92 | 5.0% | █░░░░░░░░░ |
| Fireworks AI | $1,277.55 | 3.0% | █░░░░░░░░░ |

### Provider Concentration Analysis

- **Herfindahl-Hirschman Index (HHI)**: 2,614 (moderately concentrated)
- **Top-2 share**: 66.0% (Anthropic + OpenAI)
- **Recommendation**: Route 10-15% of workhorse traffic to Together/Groq to reduce HHI below 2,000

### Routing Efficiency by Provider

| Provider | Avg Latency | Cost Efficiency | Quality Score | Route Weight |
|----------|------------|-----------------|---------------|-------------|
| Anthropic | 380ms | 0.87 | 4.6/5 | 0.41 |
| OpenAI | 290ms | 0.82 | 4.3/5 | 0.25 |
| Google DeepMind | 310ms | 0.91 | 4.2/5 | 0.12 |
| Together AI | 180ms | 0.94 | 3.9/5 | 0.08 |
| Groq | 45ms | 0.96 | 3.8/5 | 0.06 |
| DeepSeek | 420ms | 0.98 | 4.1/5 | 0.05 |
| Fireworks AI | 160ms | 0.93 | 3.7/5 | 0.03 |

---

## 5. InferLane Index Report

Six indices tracking different dimensions of the compute market:

| Index | Value | 7d Change | 30d Change | Description |
|-------|-------|-----------|------------|-------------|
| **IL-FRONTIER** | $0.95 | -1.2% | -4.8% | Frontier-tier compute (Opus, GPT-4o, Gemini 2.5 Pro) |
| **IL-STANDARD** | $0.75 | -0.8% | -3.1% | Workhorse models (Sonnet, GPT-4o-mini, Gemini Flash) |
| **IL-ECONOMY** | $0.50 | +0.4% | -6.2% | Budget-tier open-weight models |
| **IL-OPENWEIGHT** | $0.35 | +1.1% | -8.7% | Open-weight models on decentralised infrastructure |
| **IL-DECODE** | $0.15 | +2.3% | +5.4% | Decode throughput capacity (tokens/sec) |
| **IL-MEMORY** | $0.08 | +3.1% | +7.2% | Memory bandwidth capacity (GB/s) |

### Index Divergence -- The Quality/Resource Spread

```
  Index Performance (90-day, normalised to $1.00 at T-0)

  $1.10  .                                              IL-MEMORY
  $1.05  .                                        IL-DECODE
  $1.00  ======================================== baseline
  $0.95  .                           IL-ECONOMY
  $0.90  .                     IL-STANDARD
  $0.85  .               IL-FRONTIER
  $0.80  .         IL-OPENWEIGHT
```

**Key signal**: Quality-tier indices are falling (commoditisation pressure from new model releases). Resource indices are rising (memory bandwidth demand growing faster than supply as context windows expand). This divergence is the most important trend in the compute market.

### Index Categories

**Quality-Tier Indices** (IL-FRONTIER, IL-STANDARD, IL-ECONOMY, IL-OPENWEIGHT)
Track VWAP (volume-weighted average price) from order fills in each quality tier. Reflect the market-clearing price for different quality levels of inference.

**Resource Indices** (IL-DECODE, IL-MEMORY)
Track the value of scarce hardware resources:
- **IL-DECODE** -- Derived from online nodes' decode throughput (tokens/sec) via `valuateDecodeCapacity()`. Reflects the hourly economic value of autoregressive token generation capacity.
- **IL-MEMORY** -- Derived from online nodes' memory bandwidth (GB/s) via `valuateMemoryBandwidth()`. Reflects the value of the actual bottleneck in inference: memory bandwidth, not FLOPs.

> Why separate indices matter: Generic "compute credits" hide the real cost structure. A request that is 90% prefill (cheap, parallel) costs differently than one that is 90% decode (expensive, sequential). The IL-DECODE index makes this transparent.

---

## 6. Model Quality Rankings

| Rank | Model | Provider | Avg Rating | Samples | Primary Task Types |
|------|-------|----------|------------|---------|-------------------|
| 1 | claude-opus-4 | Anthropic | 4.8/5 | 2,847 | coding, analysis, research |
| 2 | gpt-4o | OpenAI | 4.5/5 | 3,214 | coding, summarisation, chat |
| 3 | gemini-2.5-pro | Google DeepMind | 4.4/5 | 1,892 | analysis, research, long-context |
| 4 | claude-sonnet-4 | Anthropic | 4.3/5 | 8,461 | coding, testing, generation |
| 5 | deepseek-chat | DeepSeek | 4.1/5 | 2,103 | coding, math, analysis |
| 6 | gpt-4o-mini | OpenAI | 4.0/5 | 6,729 | chat, summarisation, triage |
| 7 | gemini-2.0-flash | Google DeepMind | 3.9/5 | 4,518 | summarisation, extraction, triage |
| 8 | llama-3.3-70b | Together AI | 3.8/5 | 3,210 | coding, chat, generation |
| 9 | claude-haiku-3.5 | Anthropic | 3.8/5 | 11,204 | triage, classification, extraction |
| 10 | qwen-2.5-72b | Together AI | 3.7/5 | 1,847 | coding, math, translation |
| 11 | mixtral-8x22b | Fireworks AI | 3.6/5 | 982 | coding, chat |
| 12 | llama-3.3-70b | Groq | 3.6/5 | 4,891 | chat, triage, extraction |
| 13 | gemma-2-27b | Together AI | 3.4/5 | 612 | summarisation, classification |
| 14 | phi-3.5-mini | Fireworks AI | 3.1/5 | 1,340 | classification, extraction |

### Quality-Cost Frontier

```
  Quality vs Cost (bubble size = request volume)

  5.0 |  o Opus-4
      |     o GPT-4o
  4.5 |        o Gemini-2.5-Pro
      |  O Sonnet-4        o DeepSeek
  4.0 |     O GPT-4o-mini
      |        O Gemini-Flash    o LLaMA-70b
  3.5 |                 O Haiku-3.5
      |                               o Mixtral
  3.0 |                                    o Phi-3.5
      +-----+--------+--------+--------+---------->
      $0   $1       $5      $15      $50     $/1M out
```

> **Best quality-adjusted value**: claude-sonnet-4 at $3.00/$15.00 per 1M tokens delivers 4.3/5 quality -- the sweet spot for most production workloads.

---

## 7. Cost Per Million Tokens by Provider

*Pricing data from InferLane model registry. Decode costs are memory-bandwidth-adjusted.*

### Frontier Tier

| Model | Input $/1M | Output $/1M | Decode Premium | Phase-Aware Cost (1K in / 1K out) |
|-------|-----------|------------|----------------|-----------------------------------|
| claude-opus-4 | $15.00 | $75.00 | 5.0x | $0.000340 |
| gpt-4o | $5.00 | $15.00 | 3.0x | $0.000340 |
| gemini-2.5-pro | $3.50 | $10.50 | 3.0x | $0.000340 |

### Workhorse Tier

| Model | Input $/1M | Output $/1M | Decode Premium | Phase-Aware Cost (1K in / 1K out) |
|-------|-----------|------------|----------------|-----------------------------------|
| claude-sonnet-4 | $3.00 | $15.00 | 5.0x | $0.000340 |
| gpt-4o-mini | $0.15 | $0.60 | 4.0x | $0.000340 |
| gemini-2.0-flash | $0.10 | $0.40 | 4.0x | $0.000340 |
| deepseek-chat | $0.14 | $0.28 | 2.0x | $0.000340 |

### Speed/Budget Tier

| Model | Input $/1M | Output $/1M | Decode Premium | Phase-Aware Cost (1K in / 1K out) |
|-------|-----------|------------|----------------|-----------------------------------|
| claude-haiku-3.5 | $0.25 | $1.25 | 5.0x | $0.000340 |
| groq/llama-3.3-70b | $0.05 | $0.08 | 1.6x | $0.000340 |
| together/llama-3.3-70b | $0.12 | $0.12 | 1.0x | $0.000340 |

> Phase-aware cost ($0.000340 per 1K in + 1K out) reflects the InferLane base-layer cost using HBM3 hardware at 3,350 GB/s. This is the floor cost of inference -- provider markups above this reflect margin, not physics.

---

## 8. KV Cache Economics

KV cache (key-value cache) is VRAM consumed by retained conversation contexts. As context windows grow to 1M+ tokens, KV cache becomes a significant cost component and a tradeable resource.

### Cache Retention Pricing

| Memory Technology | Cache Cost ($/GB/hr) | 1 GB for 24h | Platform Fee (15%) | Node Earnings |
|-------------------|---------------------|-------------|-------------------|---------------|
| HBM3E | $0.0100 | $0.2400 | $0.0360 | $0.2040 |
| HBM3 | $0.0085 | $0.2040 | $0.0306 | $0.1734 |
| HBM2E | $0.0065 | $0.1560 | $0.0234 | $0.1326 |
| GDDR6X | $0.0035 | $0.0840 | $0.0126 | $0.0714 |

### Context Size to Cache Cost

| Context Length | Approx KV Cache Size | Hourly Cost (HBM3) | Daily Cost |
|---------------|---------------------|--------------------|-----------|
| 8K tokens | ~0.03 GB | $0.0003 | $0.0061 |
| 32K tokens | ~0.12 GB | $0.0010 | $0.0245 |
| 128K tokens | ~0.5 GB | $0.0043 | $0.1020 |
| 200K tokens | ~0.8 GB | $0.0068 | $0.1632 |
| 1M tokens | ~4.0 GB | $0.0340 | $0.8160 |

### Platform Cache Metrics (March 2026)

| Metric | Value |
|--------|-------|
| Total cache capacity online | 18.4 TB |
| Cache utilisation | 72.3% |
| Avg cache lifetime | 4.2 hours |
| Cache hit rate (repeat contexts) | 34.7% |
| Estimated savings from cache reuse | $6,240/mo |
| Unique cached contexts | 847,291 |

> **P2P Cache Sharing Opportunity**: Nodes that retain hot KV caches can serve subsequent requests without re-prefilling, saving 30-50% of request cost. The cache marketplace enables nodes to earn by sharing cached contexts -- reducing latency 2-5x for consumers while monetising idle VRAM for operators.

---

## 9. Agent Lifecycle -- Cost Per Phase

**Total across all phases**: 42.3B tokens, $42,618.47

| Phase | Transitions | Tokens | Cost | % of Cost | Avg Duration |
|-------|------------|--------|------|-----------|-------------|
| coding | 284,192 | 18.4B | $18,316.94 | 43.0% | 8m |
| testing | 147,831 | 8.9B | $8,523.69 | 20.0% | 4m |
| ci_running | 92,364 | 4.7B | $5,114.22 | 12.0% | 12m |
| ci_failed | 38,412 | 2.1B | $3,409.48 | 8.0% | 3m |
| review_pending | 31,204 | 1.8B | $2,131.92 | 5.0% | 22m |
| changes_requested | 18,473 | 1.4B | $1,704.74 | 4.0% | 6m |
| pr_open | 22,841 | 1.2B | $1,278.55 | 3.0% | 2m |
| ci_passed | 14,218 | 0.9B | $852.37 | 2.0% | 1m |
| approved | 9,412 | 0.6B | $426.18 | 1.0% | 30s |
| merged | 8,247 | 0.4B | $426.18 | 1.0% | 15s |
| deployed | 6,841 | 0.2B | $213.09 | 0.5% | 45s |
| idle | 4,218 | 0.1B | $221.11 | 0.5% | -- |

> **coding** accounts for **43%** of total compute cost. This is expected for active development workflows. Consider using cheaper models for boilerplate generation.

### Phase Cost Waterfall

```
  coding         $18,317  ████████████████████████████████████████████  43%
  testing         $8,524  ████████████████████                          20%
  ci_running      $5,114  ████████████                                  12%
  ci_failed       $3,409  ████████                                       8%
  review           $2,132  █████                                          5%
  changes_req     $1,705  ████                                           4%
  pr_open         $1,279  ███                                            3%
  other           $2,139  █████                                          5%
```

> **CI failure overhead**: 8% of compute cost is spent in failed CI phases. Each retry re-runs decode-heavy generation. Investing in better pre-push validation could save ~$3,400/month.

---

## 10. Settlement & Trust Intelligence

Three settlement lanes route payments based on trust maturity:

| Lane | Settlement Timing | Requirements | Dispute Window |
|------|-------------------|--------------|----------------|
| INSTANT | 0 hours (inline) | Trust >=80, verification >=65, reputation >=80 | 4hr post-settlement clawback |
| STANDARD | T+1 (24h batch) | Trust >=50, verification >=40 | 24 hours |
| DEFERRED | T+7 to T+30 | All new entities start here | Equal to delay period |

### Trust Score Formula

```
trustScore = uptimeScore(25) + accuracyScore(25) + volumeScore(25) + disputeScore(25)
```

| Component | Max Points | How Earned |
|-----------|-----------|------------|
| Uptime | 25 | 99.9% uptime = 25 pts |
| Accuracy | 25 | 100% probe pass rate = 25 pts |
| Volume | 25 | log10(requests_30d) x 5; 100K requests = 25 pts |
| Dispute rate | 25 | 0% disputes = 25 pts; 1% = 22.5 pts |

### Verification Methods (5 probes)

| Method | Points | What It Proves |
|--------|--------|----------------|
| Known-answer probe | 30 | Model identity -- is this actually the claimed model? |
| Latency attestation | 20 | Geographic truth -- speed-of-light-in-fiber check |
| Quality sample | 20 | Output quality -- MMLU/HumanEval within expected range |
| Response fingerprint | 15 | Vocabulary patterns and formatting match known reference |
| Hardware attestation | 15 | TEE attestation chain rooted in manufacturer CA |

### Platform Settlement Distribution (March 2026)

| Lane | Nodes | Volume Settled | Avg Trust Score | Dispute Rate |
|------|-------|---------------|-----------------|-------------|
| INSTANT | 211 | $28,174.39 | 87.4 | 0.02% |
| STANDARD | 384 | $11,891.17 | 64.2 | 0.18% |
| DEFERRED | 215 | $2,553.91 | 31.8 | 1.24% |

### Platform Maturity Convergence

As platform-wide trust metrics improve, lane thresholds relax:

| Platform State | INSTANT Threshold | DEFERRED Delay |
|----------------|-------------------|----------------|
| Dispute <1%, settled >$100K | Trust >=70 (was 80) | 14d (was 30d) |
| Dispute <0.5%, settled >$1M | Trust >=60 | 7d |
| Dispute <0.1%, settled >$10M | Trust >=50 | 3d |

**Current platform status**: Dispute rate 0.31%, total settled $42,618. Approaching first threshold.

> The lanes do not merge because someone decides they should -- they merge because the system's collective trust record earns it.

---

## 11. Key Insights & Recommendations

- **Healthy provider diversity**: 7 providers used, reducing single-provider dependency. However, top-2 concentration at 66% (Anthropic + OpenAI) warrants routing 10-15% of workhorse traffic to Together/Groq.

- **Best quality-adjusted value**: claude-sonnet-4 delivers 4.3/5 quality at $3/$15 per 1M tokens across 8,461 rated samples. Recommended as default for coding and generation tasks.

- **CI failure overhead**: 8% of compute cost ($3,409/mo) is spent in failed CI phases. Investing in better pre-push validation could reduce total cost by ~8%. Each CI retry re-runs decode-heavy generation across the full context.

- **Cost-per-request declining**: $0.0231/request (down 4.3% MoM) driven by intelligent model routing. Budget-tier models handling 34% of triage/classification volume at 1/50th the cost of frontier models.

- **Decode is 3x more expensive than prefill** at the hardware level. For workloads that are output-heavy (long generations, chain-of-thought), route to nodes with higher memory bandwidth (HBM3E preferred) for faster decode at competitive pricing.

- **KV cache sharing reduces costs 30-50%**. Nodes retaining hot caches eliminate re-prefill costs. Current cache hit rate of 34.7% saves an estimated $6,240/mo. Increasing cache lifetime from 4.2h to 8h could double savings to ~$12,500/mo.

- **The memory wall is real**: As context windows grow past 128K tokens, KV cache VRAM consumption becomes a dominant cost factor. 1M-token contexts cost $0.82/day in cache retention alone. Consider disaggregated dispatch -- routing prefill to compute-optimised nodes and decode to memory-bandwidth-optimised nodes.

- **Resource indices diverging from quality indices**: IL-DECODE (+5.4% 30d) and IL-MEMORY (+7.2% 30d) are rising while quality-tier indices decline (IL-FRONTIER -4.8%, IL-OPENWEIGHT -8.7%). This signals that memory bandwidth scarcity -- not model quality -- is becoming the binding constraint. Hardware operators should prioritise HBM3E procurement.

- **Settlement trust building on track**: 66% of volume settling via INSTANT lane (87.4 avg trust score, 0.02% dispute rate). Platform approaching first maturity threshold ($100K settled, <1% disputes) which will relax INSTANT requirements to Trust >=70.

- **Open-weight disruption accelerating**: IL-OPENWEIGHT declining fastest (-8.7% 30d) as LLaMA 3.3 and Qwen 2.5 models achieve 3.7-3.8/5 quality at 1/10th the cost of frontier. For non-critical workloads, open-weight routing saves 60-80% versus proprietary APIs.

---

*This report is auto-generated from anonymized, aggregated routing data. No prompts, responses, or user identifiers are included.*

**InferLane** -- Cost intelligence for AI agents | Decode economics | Memory bandwidth pricing | Compute trading
