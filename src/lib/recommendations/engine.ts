import { prisma } from '@/lib/db';
import { MODEL_PRICES } from '@/lib/pricing/model-prices';

export interface Recommendation {
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  taskType: string;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  monthlySavings: number;
  savingsPercent: number;
  qualityDelta: number; // positive = better quality, negative = lower
  speedNote: string;
}

// Rough task type mapping from model names
function inferTaskType(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('embed')) return 'embedding';
  if (lower.includes('dall') || lower.includes('image')) return 'image_generation';
  if (lower.includes('code') || lower.includes('coder')) return 'code_generation';
  if (lower.includes('mini') || lower.includes('flash') || lower.includes('haiku')) return 'simple_qa';
  if (lower.includes('opus') || lower.includes('o1')) return 'complex_reasoning';
  return 'general';
}

export async function generateRecommendations(userId: string): Promise<Recommendation[]> {
  // Get user's proxy requests from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const requests = await prisma.proxyRequest.findMany({
    where: {
      timestamp: { gte: thirtyDaysAgo },
      apiKeyId: { not: null },
    },
    select: {
      routedProvider: true,
      routedModel: true,
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
    },
    take: 10000,
  });

  if (requests.length === 0) return [];

  // Get user's connected providers
  const connections = await prisma.providerConnection.findMany({
    where: { userId, isActive: true },
    select: { provider: true },
  });
  const connectedProviders = new Set(connections.map(c => c.provider));

  // Aggregate usage by model
  const modelUsage = new Map<string, { provider: string; totalInput: number; totalOutput: number; totalCost: number; count: number }>();

  for (const req of requests) {
    const key = `${req.routedProvider}:${req.routedModel}`;
    const existing = modelUsage.get(key) || { provider: req.routedProvider, totalInput: 0, totalOutput: 0, totalCost: 0, count: 0 };
    existing.totalInput += req.inputTokens;
    existing.totalOutput += req.outputTokens;
    existing.totalCost += Number(req.costUsd);
    existing.count += 1;
    modelUsage.set(key, existing);
  }

  const recommendations: Recommendation[] = [];

  // For each model the user uses, find cheaper alternatives
  for (const [key, usage] of modelUsage.entries()) {
    const [currentProvider, currentModel] = key.split(':');
    const taskType = inferTaskType(currentModel);

    // Find the current model's price
    const currentPrice = MODEL_PRICES.find(p =>
      p.provider === currentProvider && p.model === currentModel
    );
    if (!currentPrice) continue;

    // Project to monthly cost (scale from actual period)
    const daysOfData = Math.max(1, (Date.now() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
    const monthlyMultiplier = 30 / daysOfData;
    const currentMonthlyCost = usage.totalCost * monthlyMultiplier;

    // Skip tiny spends
    if (currentMonthlyCost < 1) continue;

    // Find alternative models in the same category
    for (const alt of MODEL_PRICES) {
      // Skip same provider
      if (alt.provider === currentProvider) continue;
      // Skip if user already has this provider connected (they chose not to use it)
      if (connectedProviders.has(alt.provider as any)) continue;
      // Skip if not same category
      if (alt.category !== currentPrice.category) continue;

      // Calculate projected cost with this alternative
      const altCostPerInput = alt.inputPerMToken / 1_000_000;
      const altCostPerOutput = alt.outputPerMToken / 1_000_000;
      const projectedCost = (usage.totalInput * altCostPerInput + usage.totalOutput * altCostPerOutput) * monthlyMultiplier;

      const savings = currentMonthlyCost - projectedCost;
      const savingsPercent = (savings / currentMonthlyCost) * 100;

      // Only recommend if savings are significant (>=15% and >=$5/month)
      if (savingsPercent < 15 || savings < 5) continue;

      recommendations.push({
        fromProvider: currentProvider,
        fromModel: currentModel,
        toProvider: alt.provider,
        toModel: alt.model,
        taskType,
        currentMonthlyCost: Math.round(currentMonthlyCost * 100) / 100,
        projectedMonthlyCost: Math.round(projectedCost * 100) / 100,
        monthlySavings: Math.round(savings * 100) / 100,
        savingsPercent: Math.round(savingsPercent),
        qualityDelta: 0, // Would come from MODEL_CAPABILITIES if available
        speedNote: alt.provider === 'CEREBRAS' ? '10-20x faster' : alt.provider === 'GROQ' ? 'Ultra-fast LPU' : '',
      });
    }
  }

  // Sort by absolute savings (highest first) and return top 5
  recommendations.sort((a, b) => b.monthlySavings - a.monthlySavings);

  // Filter dismissed recommendations
  const dismissed = await prisma.providerRecommendation.findMany({
    where: { userId, dismissed: true },
    select: { fromProvider: true, toProvider: true },
  });
  const dismissedSet = new Set(dismissed.map((d: { fromProvider: string; toProvider: string }) => `${d.fromProvider}:${d.toProvider}`));

  return recommendations
    .filter(r => !dismissedSet.has(`${r.fromProvider}:${r.toProvider}`))
    .slice(0, 5);
}
