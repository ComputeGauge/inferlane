import { getApiKey, getBaseUrl, printTable, warn, info } from '../utils.js';

interface EstimateAlternative {
  model: string;
  provider: string;
  estimatedCost: number;
  savings: string;
  qualityScore: number;
}

interface EstimateResponse {
  provider: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  breakdown: { prefill: number; decode: number };
  cheapestAlternative?: {
    model: string;
    provider: string;
    estimatedCost: number;
    savings: string;
  };
  alternatives?: EstimateAlternative[];
}

// Local pricing data for offline estimates
const MODEL_PRICING: Record<string, { provider: string; inputPerM: number; outputPerM: number; tier: string }> = {
  'claude-opus-4': { provider: 'ANTHROPIC', inputPerM: 15, outputPerM: 75, tier: 'frontier' },
  'claude-sonnet-4': { provider: 'ANTHROPIC', inputPerM: 3, outputPerM: 15, tier: 'workhorse' },
  'claude-haiku-3.5': { provider: 'ANTHROPIC', inputPerM: 0.8, outputPerM: 4, tier: 'speed' },
  'gpt-4o': { provider: 'OPENAI', inputPerM: 2.5, outputPerM: 10, tier: 'frontier' },
  'gpt-4o-mini': { provider: 'OPENAI', inputPerM: 0.15, outputPerM: 0.6, tier: 'workhorse' },
  'o1': { provider: 'OPENAI', inputPerM: 15, outputPerM: 60, tier: 'reasoning' },
  'o3-mini': { provider: 'OPENAI', inputPerM: 1.1, outputPerM: 4.4, tier: 'reasoning' },
  'gemini-2.5-pro': { provider: 'GOOGLE', inputPerM: 1.25, outputPerM: 10, tier: 'frontier' },
  'gemini-2.0-flash': { provider: 'GOOGLE', inputPerM: 0.1, outputPerM: 0.4, tier: 'workhorse' },
  'deepseek-chat': { provider: 'DEEPSEEK', inputPerM: 0.27, outputPerM: 1.1, tier: 'workhorse' },
  'deepseek-reasoner': { provider: 'DEEPSEEK', inputPerM: 0.55, outputPerM: 2.19, tier: 'reasoning' },
};

export async function estimate(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  // Try API first
  if (apiKey) {
    try {
      const fakeContent = 'x'.repeat(inputTokens * 4);
      const res = await fetch(`${baseUrl}/api/v1/estimate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: fakeContent }],
          max_tokens: outputTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json() as EstimateResponse;

        console.log(`\n💰 Cost Estimate: ${model}\n`);
        console.log(`  Provider:        ${data.provider}`);
        console.log(`  Input tokens:    ${data.estimatedInputTokens.toLocaleString()}`);
        console.log(`  Output tokens:   ${data.estimatedOutputTokens.toLocaleString()}`);
        console.log(`  Estimated cost:  $${data.estimatedCost.toFixed(6)}`);
        console.log(`  Prefill:         $${data.breakdown.prefill.toFixed(6)}`);
        console.log(`  Decode:          $${data.breakdown.decode.toFixed(6)}`);

        if (data.cheapestAlternative) {
          console.log(`\n  Cheapest option: ${data.cheapestAlternative.model} (${data.cheapestAlternative.provider})`);
          console.log(`                   $${data.cheapestAlternative.estimatedCost.toFixed(6)} — saves ${data.cheapestAlternative.savings}`);
        }

        if (data.alternatives && data.alternatives.length > 0) {
          console.log('\n  Alternatives:');
          printTable(
            ['Model', 'Provider', 'Cost', 'Savings', 'Quality'],
            data.alternatives.slice(0, 5).map((a: any) => [
              a.model, a.provider, `$${a.estimatedCost.toFixed(6)}`, a.savings, `${a.qualityScore}/100`,
            ]),
          );
        }

        return;
      }
    } catch {
      // Fall through to local estimate
    }
  }

  // Local fallback
  const pricing = MODEL_PRICING[model.toLowerCase()];
  if (!pricing) {
    warn(`Unknown model: ${model}`);
    info('Known models: ' + Object.keys(MODEL_PRICING).join(', '));
    return;
  }

  const cost = (inputTokens * pricing.inputPerM / 1_000_000) + (outputTokens * pricing.outputPerM / 1_000_000);

  console.log(`\n💰 Cost Estimate: ${model} (local)\n`);
  console.log(`  Provider:        ${pricing.provider}`);
  console.log(`  Tier:            ${pricing.tier}`);
  console.log(`  Input tokens:    ${inputTokens.toLocaleString()}`);
  console.log(`  Output tokens:   ${outputTokens.toLocaleString()}`);
  console.log(`  Estimated cost:  $${cost.toFixed(6)}`);
  console.log(`\n  Set INFERLANE_API_KEY for cross-provider comparison.`);
}
