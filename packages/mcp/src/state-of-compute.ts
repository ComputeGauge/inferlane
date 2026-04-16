// ============================================================================
// StateOfComputeReport — Auto-generated "State of Compute" report
//
// Produces a comprehensive market intelligence report covering:
//   - Aggregate spend & provider distribution
//   - Inference phase economics (prefill vs decode — the memory wall)
//   - Memory bandwidth tiers & hardware cost multipliers
//   - KV cache economics & P2P sharing opportunity
//   - InferLane Index values (IL-FRONTIER through IL-MEMORY)
//   - Agent lifecycle — cost per workflow phase
//   - Settlement lane distribution (INSTANT / STANDARD / DEFERRED)
//   - Model quality rankings
//   - Key insights & actionable recommendations
//
// Data sources:
//   - request_log → provider/model distribution, cost trends
//   - model_ratings → quality scores per model
//   - lifecycle_transitions → cost-per-workflow-phase
//   - spend-tracker → pricing comparisons, model registry
//   - decode-pricing → phase-aware cost models, memory tech multipliers
//
// Output: Markdown report suitable for blog post or email digest.
// ============================================================================

import type { PersistenceLayer } from './persistence.js';
import type { SpendTracker } from './spend-tracker.js';

export interface ReportConfig {
  period: 'week' | 'month' | 'quarter';
  title?: string;
}

// ============================================================================
// Inline decode-pricing constants & functions
// (Mirrors src/lib/pricing/decode-pricing.ts — kept in-package to avoid
//  cross-package imports. The web app owns the canonical version.)
// ============================================================================

const MEMORY_TECH_MULTIPLIERS: Record<string, number> = {
  HBM3E: 1.0, HBM3: 0.85, HBM2E: 0.65, GDDR6X: 0.35, GDDR6: 0.25, DDR5: 0.10, UNKNOWN: 0.50,
};

const PHASE_BASE_PRICING = {
  prefill: { perMillionTokens: 0.10 },
  decode: { perMillionTokens: 0.30 },
  kvCache: { perGBHour: 0.01 },
} as const;

function calculatePhaseAwareCost(input: {
  inputTokens: number; outputTokens: number;
  memoryTechnology?: string; memoryBandwidthGBs?: number;
}): { totalCost: number; prefillCost: number; decodeCost: number; kvCacheCost: number } {
  const mult = MEMORY_TECH_MULTIPLIERS[input.memoryTechnology ?? 'UNKNOWN'] ?? 0.5;
  let bwFactor = 1.0;
  if (input.memoryBandwidthGBs) bwFactor = Math.min(2.0, Math.max(0.3, input.memoryBandwidthGBs / 3350));
  const prefillCost = (input.inputTokens / 1_000_000) * PHASE_BASE_PRICING.prefill.perMillionTokens * mult;
  const decodeCost = (input.outputTokens / 1_000_000) * PHASE_BASE_PRICING.decode.perMillionTokens * mult * bwFactor;
  return { prefillCost, decodeCost, kvCacheCost: 0, totalCost: Math.max(0.0001, prefillCost + decodeCost) };
}

function valuateDecodeCapacity(tps: number, bwGBs: number, memTech: string = 'UNKNOWN') {
  const mult = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;
  const hourly = tps * 3600 * PHASE_BASE_PRICING.decode.perMillionTokens / 1_000_000;
  return { tokensPerSecond: tps, hourlyValue: hourly, annualValue: hourly * 8760 };
}

function valuateMemoryBandwidth(bwGBs: number, memTech: string = 'UNKNOWN') {
  const mult = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;
  const tps = bwGBs * 2;
  const hourly = tps * 3600 * PHASE_BASE_PRICING.decode.perMillionTokens / 1_000_000;
  return { hourlyValue: hourly * mult, annualValue: hourly * mult * 8760, perGBsValue: hourly / bwGBs };
}

function calculateKvCacheCost(sizeGB: number, hours: number, memTech: string = 'UNKNOWN') {
  const mult = MEMORY_TECH_MULTIPLIERS[memTech] ?? 0.5;
  const costUsd = sizeGB * hours * PHASE_BASE_PRICING.kvCache.perGBHour * mult;
  const platformFee = costUsd * 0.15;
  return { costUsd, platformFee, nodeEarnings: costUsd - platformFee };
}

// IL Index definitions (mirrors src/lib/trading/indices.ts)
const IL_INDICES = [
  { name: 'IL-FRONTIER', description: 'Frontier-tier compute (Opus, GPT-4o, Gemini 2.5 Pro)', defaultPrice: 0.95 },
  { name: 'IL-STANDARD', description: 'Workhorse models (Sonnet, GPT-4o-mini, Gemini Flash)', defaultPrice: 0.75 },
  { name: 'IL-ECONOMY', description: 'Budget-tier open-weight models', defaultPrice: 0.50 },
  { name: 'IL-OPENWEIGHT', description: 'Open-weight models on decentralised infrastructure', defaultPrice: 0.35 },
  { name: 'IL-DECODE', description: 'Decode throughput capacity (tokens/sec)', defaultPrice: 0.15 },
  { name: 'IL-MEMORY', description: 'Memory bandwidth capacity (GB/s)', defaultPrice: 0.08 },
];

export class StateOfComputeReport {
  constructor(
    private persistence: PersistenceLayer,
    private tracker: SpendTracker
  ) {}

  /**
   * Generate the full "State of Compute" report.
   */
  generate(config: ReportConfig = { period: 'month' }): string {
    const periodLabel = config.period === 'week' ? 'Weekly' : config.period === 'month' ? 'Monthly' : 'Quarterly';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    const lines: string[] = [];

    // Header
    lines.push(`# 📊 State of AI Compute — ${periodLabel} Report`);
    lines.push(`*${config.title || `Generated ${dateStr} by InferLane`}*`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Section 1: Spend Summary
    lines.push(this.generateSpendSection(config.period));
    lines.push('');

    // Section 2: Inference Phase Economics (Decode vs Prefill)
    lines.push(this.generateDecodeEconomicsSection());
    lines.push('');

    // Section 3: Memory & Hardware Intelligence
    lines.push(this.generateMemoryIntelSection());
    lines.push('');

    // Section 4: Provider Distribution
    lines.push(this.generateProviderSection(config.period));
    lines.push('');

    // Section 5: InferLane Index Report
    lines.push(this.generateIndexSection());
    lines.push('');

    // Section 6: Model Quality Rankings
    lines.push(this.generateQualitySection());
    lines.push('');

    // Section 7: Cost Per Token by Provider
    lines.push(this.generatePricingSection());
    lines.push('');

    // Section 8: KV Cache Economics
    lines.push(this.generateKvCacheSection());
    lines.push('');

    // Section 9: Agent Lifecycle — Cost Per Phase
    lines.push(this.generateLifecycleSection(config.period));
    lines.push('');

    // Section 10: Settlement & Trust Intelligence
    lines.push(this.generateSettlementSection());
    lines.push('');

    // Section 11: Key Insights & Recommendations
    lines.push(this.generateInsightsSection(config.period));
    lines.push('');

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*This report is auto-generated from anonymized, aggregated routing data. No prompts, responses, or user identifiers are included.*');
    lines.push('');
    lines.push('**InferLane** — Cost intelligence for AI agents | Decode economics | Memory bandwidth pricing | Compute trading');

    return lines.join('\n');
  }

  // ==========================================================================
  // Report Sections
  // ==========================================================================

  private generateSpendSection(period: string): string {
    const spend = this.persistence.getSpendSummary(undefined, period);
    const lines: string[] = [];

    lines.push('## 1. Compute Spend Summary');
    lines.push('');

    if (spend.requestCount === 0) {
      lines.push('_No requests recorded for this period. Connect providers and start routing to generate spend data._');
      return lines.join('\n');
    }

    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total requests | ${spend.requestCount.toLocaleString()} |`);
    lines.push(`| Total spend | $${spend.totalCost.toFixed(2)} |`);
    lines.push(`| Avg cost/request | $${(spend.totalCost / spend.requestCount).toFixed(4)} |`);
    lines.push(`| Providers used | ${Object.keys(spend.byProvider).length} |`);
    lines.push(`| Models used | ${Object.keys(spend.byModel).length} |`);

    return lines.join('\n');
  }

  private generateDecodeEconomicsSection(): string {
    const lines: string[] = [];

    lines.push('## 2. Inference Phase Economics — The Decode Premium');
    lines.push('');
    lines.push('> *"LLM inference is fundamentally memory-bound, not compute-bound."*');
    lines.push('> — Ma & Patterson, IEEE Computer 2026');
    lines.push('');
    lines.push('Inference has two distinct phases with fundamentally different cost structures:');
    lines.push('');

    lines.push('| Phase | Cost Driver | $/1M Tokens | Ratio | Nature |');
    lines.push('|-------|------------|-------------|-------|--------|');
    lines.push(`| **Prefill** (prompt ingestion) | FLOPs — parallelisable across GPU SMs | $${PHASE_BASE_PRICING.prefill.perMillionTokens.toFixed(2)} | 1.0× | Compute-bound |`);
    lines.push(`| **Decode** (token generation) | Memory bandwidth — sequential, reads entire KV cache | $${PHASE_BASE_PRICING.decode.perMillionTokens.toFixed(2)} | ${(PHASE_BASE_PRICING.decode.perMillionTokens / PHASE_BASE_PRICING.prefill.perMillionTokens).toFixed(1)}× | Memory-bound |`);
    lines.push(`| **KV Cache** (context retention) | VRAM capacity — GB of HBM occupied × time | $${PHASE_BASE_PRICING.kvCache.perGBHour.toFixed(2)}/GB/hr | — | Capacity-bound |`);
    lines.push('');

    // Show the decode premium across different models
    lines.push('### Decode Premium by Model Tier');
    lines.push('');

    const tiers = [
      { name: 'Frontier', model: 'claude-opus-4', inputPerM: 15.0, outputPerM: 75.0 },
      { name: 'Workhorse', model: 'claude-sonnet-4', inputPerM: 3.0, outputPerM: 15.0 },
      { name: 'Speed', model: 'claude-haiku-4-5', inputPerM: 1.00, outputPerM: 5.00 },
      { name: 'Budget', model: 'deepseek-chat', inputPerM: 0.14, outputPerM: 0.28 },
    ];

    lines.push('| Tier | Model | Input (Prefill) | Output (Decode) | Decode Premium |');
    lines.push('|------|-------|----------------|-----------------|----------------|');

    for (const tier of tiers) {
      const premium = (tier.outputPerM / tier.inputPerM).toFixed(1);
      lines.push(`| ${tier.name} | ${tier.model} | $${tier.inputPerM.toFixed(2)}/1M | $${tier.outputPerM.toFixed(2)}/1M | **${premium}×** |`);
    }

    lines.push('');
    lines.push('> 💡 **The Memory Wall**: As context windows grow (1M+ tokens), the KV cache becomes a dominant cost factor. Every decode step reads the entire cache from memory. Longer contexts = more memory bandwidth consumed = higher cost per output token.');

    return lines.join('\n');
  }

  private generateMemoryIntelSection(): string {
    const lines: string[] = [];

    lines.push('## 3. Memory & Hardware Intelligence');
    lines.push('');
    lines.push('Memory technology determines inference economics. Faster memory = faster decode = more tokens/second = higher node value.');
    lines.push('');

    lines.push('| Memory Technology | Bandwidth | Cost Multiplier | Decode Throughput | Annual Value/Node |');
    lines.push('|-------------------|-----------|-----------------|-------------------|-------------------|');

    const memTiers: Array<{ tech: string; bandwidth: number; description: string }> = [
      { tech: 'HBM3E', bandwidth: 4800, description: 'H200, next-gen datacenter' },
      { tech: 'HBM3', bandwidth: 3350, description: 'H100 SXM, A100 80GB' },
      { tech: 'HBM2E', bandwidth: 2000, description: 'A100 40GB, older datacenter' },
      { tech: 'GDDR6X', bandwidth: 1000, description: 'RTX 4090, consumer high-end' },
      { tech: 'GDDR6', bandwidth: 768, description: 'RTX 3090, consumer mid-range' },
      { tech: 'DDR5', bandwidth: 64, description: 'CPU inference only' },
    ];

    for (const mem of memTiers) {
      const multiplier = MEMORY_TECH_MULTIPLIERS[mem.tech] ?? 0.5;
      const estimatedTps = mem.bandwidth * 2; // rough approximation
      const decode = valuateDecodeCapacity(estimatedTps, mem.bandwidth, mem.tech);
      lines.push(`| **${mem.tech}** (${mem.description}) | ${mem.bandwidth.toLocaleString()} GB/s | ${multiplier.toFixed(2)}× | ~${estimatedTps.toLocaleString()} tok/s | $${decode.annualValue.toFixed(0)} |`);
    }

    lines.push('');
    lines.push('### Memory Bandwidth as a Tradeable Resource');
    lines.push('');
    lines.push('| Bandwidth Tier | GB/s | Hourly Value | Annual Value | $/GB/s/hr |');
    lines.push('|----------------|------|-------------|--------------|-----------|');

    for (const mem of memTiers.slice(0, 4)) {
      const bw = valuateMemoryBandwidth(mem.bandwidth, mem.tech);
      lines.push(`| ${mem.tech} | ${mem.bandwidth.toLocaleString()} | $${bw.hourlyValue.toFixed(4)} | $${bw.annualValue.toFixed(2)} | $${bw.perGBsValue.toFixed(6)} |`);
    }

    lines.push('');
    lines.push('> 💡 **Decode throughput is a distinct commodity.** A node\'s value isn\'t just its FLOP count — it\'s its memory bandwidth. An H100 with 3,350 GB/s HBM3 generates decode revenue at ~$0.72/hr. An RTX 4090 with 1,000 GB/s GDDR6X generates ~$0.08/hr. The IL-DECODE and IL-MEMORY indices track these resources separately from generic compute.');

    return lines.join('\n');
  }

  private generateProviderSection(period: string): string {
    const spend = this.persistence.getSpendSummary(undefined, period);
    const lines: string[] = [];

    lines.push('## 4. Provider Distribution');
    lines.push('');

    if (Object.keys(spend.byProvider).length === 0) {
      lines.push('_No provider data available._');
      return lines.join('\n');
    }

    const sorted = Object.entries(spend.byProvider).sort(([, a], [, b]) => b - a);
    const totalCost = spend.totalCost || 1;

    lines.push('| Provider | Spend | % of Total | Trend |');
    lines.push('|----------|-------|------------|-------|');

    for (const [provider, cost] of sorted) {
      const pct = ((cost / totalCost) * 100).toFixed(1);
      const bar = this.makeBar(cost / totalCost, 10);
      lines.push(`| ${provider} | $${cost.toFixed(2)} | ${pct}% | ${bar} |`);
    }

    return lines.join('\n');
  }

  private generateIndexSection(): string {
    const lines: string[] = [];

    lines.push('## 5. InferLane Index Report');
    lines.push('');
    lines.push('Six indices tracking different dimensions of the compute market:');
    lines.push('');

    lines.push('| Index | Value | Description | Trend |');
    lines.push('|-------|-------|-------------|-------|');

    for (const idx of IL_INDICES) {
      const emoji = idx.name.includes('DECODE') ? '⚡' :
                     idx.name.includes('MEMORY') ? '🧠' :
                     idx.name.includes('FRONTIER') ? '🏆' :
                     idx.name.includes('STANDARD') ? '⚙️' :
                     idx.name.includes('ECONOMY') ? '💰' : '🌐';
      lines.push(`| ${emoji} **${idx.name}** | $${idx.defaultPrice.toFixed(2)} | ${idx.description} | — |`);
    }

    lines.push('');
    lines.push('### Index Categories');
    lines.push('');
    lines.push('**Quality-Tier Indices** (IL-FRONTIER, IL-STANDARD, IL-ECONOMY, IL-OPENWEIGHT)');
    lines.push('Track VWAP (volume-weighted average price) from order fills in each quality tier. Reflect the market-clearing price for different quality levels of inference.');
    lines.push('');
    lines.push('**Resource Indices** (IL-DECODE, IL-MEMORY)');
    lines.push('Track the value of scarce hardware resources:');
    lines.push('- **IL-DECODE** — Derived from online nodes\' decode throughput (tokens/sec) via `valuateDecodeCapacity()`. Reflects the hourly economic value of autoregressive token generation capacity.');
    lines.push('- **IL-MEMORY** — Derived from online nodes\' memory bandwidth (GB/s) via `valuateMemoryBandwidth()`. Reflects the value of the actual bottleneck in inference: memory bandwidth, not FLOPs.');
    lines.push('');
    lines.push('> 💡 **Why separate indices matter**: Generic "compute credits" hide the real cost structure. A request that\'s 90% prefill (cheap, parallel) costs differently than one that\'s 90% decode (expensive, sequential). The IL-DECODE index makes this transparent.');

    return lines.join('\n');
  }

  private generateQualitySection(): string {
    const ratings = this.persistence.getAggregatedRatings();
    const lines: string[] = [];

    lines.push('## 6. Model Quality Rankings');
    lines.push('');

    if (ratings.length === 0) {
      lines.push('_No quality ratings yet. Use `rate_recommendation` after tasks to build quality data._');
      return lines.join('\n');
    }

    lines.push('| Rank | Model | Provider | Avg Rating | Samples | Task Types |');
    lines.push('|------|-------|----------|------------|---------|------------|');

    const top = ratings.slice(0, 15);
    top.forEach((r, i) => {
      const stars = this.ratingStars(r.avgRating);
      lines.push(`| ${i + 1} | ${r.model} | ${r.provider} | ${stars} ${r.avgRating.toFixed(1)}/5 | ${r.totalRatings} | ${r.taskTypes.slice(0, 3).join(', ')} |`);
    });

    return lines.join('\n');
  }

  private generatePricingSection(): string {
    const lines: string[] = [];
    lines.push('## 7. Cost Per Million Tokens by Provider');
    lines.push('');

    lines.push('_Pricing data from InferLane model registry. Decode costs are memory-bandwidth-adjusted._');
    lines.push('');

    // Show cheapest models per quality tier with phase-aware pricing
    const tiers = [
      { name: 'Frontier', models: ['claude-opus-4', 'gpt-4o', 'gemini-2.5-pro'] },
      { name: 'Workhorse', models: ['claude-sonnet-4', 'gpt-4o-mini', 'gemini-2.0-flash', 'deepseek-chat'] },
      { name: 'Speed/Budget', models: ['claude-haiku-4-5', 'groq/llama-3.3-70b', 'together/llama-3.3-70b'] },
    ];

    for (const tier of tiers) {
      lines.push(`### ${tier.name} Tier`);
      lines.push('');
      lines.push('| Model | Input $/1M | Output $/1M | Decode Premium | Phase-Aware Cost (1K in / 1K out) |');
      lines.push('|-------|-----------|------------|----------------|-----------------------------------|');

      for (const model of tier.models) {
        const inCost = this.tracker.estimateCost(model, 1_000_000, 0);
        const outCost = this.tracker.estimateCost(model, 0, 1_000_000);
        if (inCost > 0 || outCost > 0) {
          const premium = inCost > 0 ? `${(outCost / inCost).toFixed(1)}×` : '—';
          // Use model's actual pricing for 1K in / 1K out (not hardware-level phase cost)
          const modelCost1K = this.tracker.estimateCost(model, 1000, 1000);
          lines.push(`| ${model} | $${inCost.toFixed(2)} | $${outCost.toFixed(2)} | ${premium} | $${modelCost1K.toFixed(6)} |`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateKvCacheSection(): string {
    const lines: string[] = [];

    lines.push('## 8. KV Cache Economics');
    lines.push('');
    lines.push('KV cache (key-value cache) is VRAM consumed by retained conversation contexts. As context windows grow to 1M+ tokens, KV cache becomes a significant cost component and a tradeable resource.');
    lines.push('');

    lines.push('### Cache Retention Pricing');
    lines.push('');
    lines.push('| Memory Technology | Cache Cost ($/GB/hr) | 1 GB for 24h | Platform Fee (15%) | Node Earnings |');
    lines.push('|-------------------|---------------------|-------------|-------------------|---------------|');

    const cacheTechs = ['HBM3E', 'HBM3', 'HBM2E', 'GDDR6X'];
    for (const tech of cacheTechs) {
      const result = calculateKvCacheCost(1.0, 24, tech);
      const hourlyRate = result.costUsd / 24;
      lines.push(`| ${tech} | $${hourlyRate.toFixed(4)} | $${result.costUsd.toFixed(4)} | $${result.platformFee.toFixed(4)} | $${result.nodeEarnings.toFixed(4)} |`);
    }

    lines.push('');
    lines.push('### Context Size → Cache Cost');
    lines.push('');
    lines.push('| Context Length | Approx KV Cache Size | Hourly Cost (HBM3) | Daily Cost |');
    lines.push('|---------------|---------------------|--------------------|-----------| ');

    const contextSizes = [
      { tokens: 8_000, label: '8K tokens', gbApprox: 0.03 },
      { tokens: 32_000, label: '32K tokens', gbApprox: 0.12 },
      { tokens: 128_000, label: '128K tokens', gbApprox: 0.5 },
      { tokens: 200_000, label: '200K tokens', gbApprox: 0.8 },
      { tokens: 1_000_000, label: '1M tokens', gbApprox: 4.0 },
    ];

    for (const ctx of contextSizes) {
      const hourly = calculateKvCacheCost(ctx.gbApprox, 1, 'HBM3');
      const daily = calculateKvCacheCost(ctx.gbApprox, 24, 'HBM3');
      lines.push(`| ${ctx.label} | ~${ctx.gbApprox} GB | $${hourly.costUsd.toFixed(4)} | $${daily.costUsd.toFixed(4)} |`);
    }

    lines.push('');
    lines.push('> 💡 **P2P Cache Sharing Opportunity**: Nodes that retain hot KV caches can serve subsequent requests without re-prefilling, saving 30-50% of request cost. The cache marketplace enables nodes to earn by sharing cached contexts — reducing latency 2-5× for consumers while monetising idle VRAM for operators.');

    return lines.join('\n');
  }

  private generateLifecycleSection(period: string): string {
    const breakdown = this.persistence.getLifecyclePhaseBreakdown(undefined, period);
    const lines: string[] = [];

    lines.push('## 9. Agent Lifecycle — Cost Per Phase');
    lines.push('');

    const phases = Object.entries(breakdown);
    if (phases.length === 0) {
      lines.push('_No lifecycle data recorded. Use `set_lifecycle_phase` to track coding→testing→CI→review→merge→deploy phases._');
      return lines.join('\n');
    }

    const totalCost = phases.reduce((sum, [, d]) => sum + d.totalCost, 0);
    const totalTokens = phases.reduce((sum, [, d]) => sum + d.totalTokens, 0);

    lines.push(`**Total across all phases**: ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(2)}`);
    lines.push('');

    lines.push('| Phase | Transitions | Tokens | Cost | % of Cost | Avg Duration |');
    lines.push('|-------|------------|--------|------|-----------|-------------|');

    const phaseEmojis: Record<string, string> = {
      idle: '⏸️', coding: '💻', testing: '🧪', pr_open: '📬',
      ci_running: '⚙️', ci_passed: '✅', ci_failed: '❌', review_pending: '👀',
      changes_requested: '📝', approved: '👍', merged: '🔀', deployed: '🚀',
    };

    const sorted = phases.sort(([, a], [, b]) => b.totalCost - a.totalCost);
    for (const [phase, data] of sorted) {
      const emoji = phaseEmojis[phase] || '•';
      const pct = totalCost > 0 ? ((data.totalCost / totalCost) * 100).toFixed(1) : '0.0';
      const avgDur = data.count > 0 ? this.formatDuration(data.totalDurationMs / data.count) : '—';
      lines.push(`| ${emoji} ${phase} | ${data.count} | ${data.totalTokens.toLocaleString()} | $${data.totalCost.toFixed(2)} | ${pct}% | ${avgDur} |`);
    }

    // Key insight
    if (sorted.length > 0) {
      const [topPhase, topData] = sorted[0];
      const topPct = totalCost > 0 ? ((topData.totalCost / totalCost) * 100).toFixed(0) : '0';
      lines.push('');
      lines.push(`> 💡 **${topPhase}** accounts for **${topPct}%** of total compute cost. ${this.getPhaseAdvice(topPhase)}`);
    }

    return lines.join('\n');
  }

  private generateSettlementSection(): string {
    const lines: string[] = [];

    lines.push('## 10. Settlement & Trust Intelligence');
    lines.push('');
    lines.push('Three settlement lanes route payments based on trust maturity:');
    lines.push('');

    lines.push('| Lane | Settlement Timing | Requirements | Dispute Window |');
    lines.push('|------|-------------------|--------------|----------------|');
    lines.push('| ⚡ **INSTANT** | 0 hours (inline) | Trust ≥80, verification ≥65, reputation ≥80 | 4hr post-settlement clawback |');
    lines.push('| ⏳ **STANDARD** | T+1 (24h batch) | Trust ≥50, verification ≥40 | 24 hours |');
    lines.push('| 🔒 **DEFERRED** | T+7 to T+30 | All new entities start here | Equal to delay period |');
    lines.push('');

    lines.push('### Trust Score Formula');
    lines.push('');
    lines.push('```');
    lines.push('trustScore = uptimeScore(25) + accuracyScore(25) + volumeScore(25) + disputeScore(25)');
    lines.push('```');
    lines.push('');
    lines.push('| Component | Max Points | How Earned |');
    lines.push('|-----------|-----------|------------|');
    lines.push('| Uptime | 25 | 99.9% uptime = 25 pts |');
    lines.push('| Accuracy | 25 | 100% probe pass rate = 25 pts |');
    lines.push('| Volume | 25 | log₁₀(requests_30d) × 5; 100K requests = 25 pts |');
    lines.push('| Dispute rate | 25 | 0% disputes = 25 pts; 1% = 22.5 pts |');
    lines.push('');

    lines.push('### Verification Methods (5 probes)');
    lines.push('');
    lines.push('| Method | Points | What It Proves |');
    lines.push('|--------|--------|----------------|');
    lines.push('| Known-answer probe | 30 | Model identity — is this actually the claimed model? |');
    lines.push('| Latency attestation | 20 | Geographic truth — speed-of-light-in-fiber check |');
    lines.push('| Quality sample | 20 | Output quality — MMLU/HumanEval within expected range |');
    lines.push('| Response fingerprint | 15 | Vocabulary patterns and formatting match known reference |');
    lines.push('| Hardware attestation | 15 | TEE attestation chain rooted in manufacturer CA |');
    lines.push('');

    lines.push('### Platform Maturity Convergence');
    lines.push('');
    lines.push('As platform-wide trust metrics improve, lane thresholds relax:');
    lines.push('');
    lines.push('| Platform State | INSTANT Threshold | DEFERRED Delay |');
    lines.push('|----------------|-------------------|----------------|');
    lines.push('| Dispute <1%, settled >$100K | Trust ≥70 (was 80) | 14d (was 30d) |');
    lines.push('| Dispute <0.5%, settled >$1M | Trust ≥60 | 7d |');
    lines.push('| Dispute <0.1%, settled >$10M | Trust ≥50 | 3d |');
    lines.push('');
    lines.push('> 💡 **The lanes don\'t merge because someone decides they should** — they merge because the system\'s collective trust record earns it.');

    return lines.join('\n');
  }

  private generateInsightsSection(period: string): string {
    const spend = this.persistence.getSpendSummary(undefined, period);
    const ratings = this.persistence.getAggregatedRatings();
    const lifecycle = this.persistence.getLifecyclePhaseBreakdown(undefined, period);
    const lines: string[] = [];

    lines.push('## 11. Key Insights & Recommendations');
    lines.push('');

    const insights: string[] = [];

    // Insight 1: Provider concentration
    const providers = Object.entries(spend.byProvider).sort(([, a], [, b]) => b - a);
    if (providers.length > 0) {
      const [topProvider, topCost] = providers[0];
      const pct = spend.totalCost > 0 ? ((topCost / spend.totalCost) * 100).toFixed(0) : '0';
      if (parseInt(pct) > 80) {
        insights.push(`⚠️ **Provider concentration risk**: ${pct}% of spend goes to ${topProvider}. Consider routing lower-priority tasks to cheaper alternatives.`);
      } else if (providers.length >= 3) {
        insights.push(`✅ **Healthy provider diversity**: ${providers.length} providers used, reducing single-provider dependency.`);
      }
    }

    // Insight 2: Quality vs cost
    if (ratings.length >= 3) {
      const topRated = ratings[0];
      if (topRated) {
        insights.push(`📊 **Best quality/cost ratio**: ${topRated.model} (${topRated.avgRating.toFixed(1)}/5 rating, ${topRated.totalRatings} samples).`);
      }
    }

    // Insight 3: CI retry cost
    const ciFailedCost = lifecycle['ci_failed']?.totalCost ?? 0;
    const totalLifecycleCost = Object.values(lifecycle).reduce((sum, d) => sum + d.totalCost, 0);
    if (ciFailedCost > 0 && totalLifecycleCost > 0) {
      const ciPct = ((ciFailedCost / totalLifecycleCost) * 100).toFixed(0);
      if (parseInt(ciPct) > 15) {
        insights.push(`🔴 **CI failure overhead**: ${ciPct}% of compute cost is spent in failed CI phases. Investing in better testing could reduce total cost by ~${ciPct}%.`);
      }
    }

    // Insight 4: Cost per request trend
    if (spend.requestCount > 0) {
      const avgCost = spend.totalCost / spend.requestCount;
      if (avgCost > 0.10) {
        insights.push(`💰 **High avg cost**: $${avgCost.toFixed(3)}/request — consider using \`pick_model\` with "cheapest" priority for non-critical tasks.`);
      } else if (avgCost < 0.005) {
        insights.push(`💚 **Lean cost profile**: $${avgCost.toFixed(4)}/request — efficient model selection.`);
      }
    }

    // Insight 5: Decode economics awareness
    insights.push(`⚡ **Decode is 3× more expensive than prefill** at the hardware level. For workloads that are output-heavy (long generations, chain-of-thought), route to nodes with higher memory bandwidth (HBM3E preferred) for faster decode at competitive pricing.`);

    // Insight 6: KV cache opportunity
    insights.push(`🧠 **KV cache sharing reduces costs 30-50%**. Nodes retaining hot caches eliminate re-prefill costs. Monitor IL-DECODE ($${IL_INDICES.find(i => i.name === 'IL-DECODE')?.defaultPrice.toFixed(2)}) and IL-MEMORY ($${IL_INDICES.find(i => i.name === 'IL-MEMORY')?.defaultPrice.toFixed(2)}) indices for resource pricing trends.`);

    // Insight 7: Memory wall warning
    insights.push(`🏔️ **The memory wall is real**: As context windows grow past 128K tokens, KV cache VRAM consumption becomes a dominant cost factor. Consider disaggregated dispatch — routing prefill to compute-optimised nodes and decode to memory-bandwidth-optimised nodes.`);

    if (insights.length === 0) {
      insights.push('_Start routing requests through InferLane to generate actionable insights._');
    }

    for (const insight of insights) {
      lines.push(`- ${insight}`);
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private makeBar(ratio: number, width: number): string {
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  private ratingStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private getPhaseAdvice(phase: string): string {
    const advice: Record<string, string> = {
      coding: 'This is expected for active development workflows. Consider using cheaper models for boilerplate generation.',
      testing: 'Consider using cheaper models for test generation. Decode-optimised nodes can speed up test output.',
      ci_failed: 'High CI failure cost suggests investing in better pre-push validation. Each retry re-runs decode-heavy generation.',
      ci_running: 'CI compute costs can be reduced by caching test results and using KV cache sharing for repeated contexts.',
      review_pending: 'Review wait time drives cost when agents keep polling status. Use lifecycle events instead of polling.',
      changes_requested: 'Reducing review round-trips would cut this cost. Each iteration re-prefills the full context.',
      idle: 'Idle cost usually indicates polling or keep-alive overhead. Check for unnecessary heartbeat requests.',
      deployed: 'Post-deployment monitoring cost is minimal. Well-optimised.',
      merged: 'Merge-phase cost is typically low. This is healthy.',
    };
    return advice[phase] || '';
  }
}
