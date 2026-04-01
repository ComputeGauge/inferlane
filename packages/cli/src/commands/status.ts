import { getApiKey, getBaseUrl, success, warn, error as logError, info } from '../utils.js';

interface BudgetStatusResponse {
  markdown?: string;
  [key: string]: unknown;
}

interface Promotion {
  provider: string;
  title?: string;
  promotionType?: string;
  multiplier: number;
}

interface PromotionsResponse {
  promotions?: Promotion[];
}

export async function status(): Promise<void> {
  const apiKey = getApiKey();

  if (!apiKey) {
    logError('No API key found.');
    info('Set INFERLANE_API_KEY environment variable or run: inferlane init');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();

  console.log('\n📊 InferLane Status\n');
  console.log(`  API Key:  ${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`);
  console.log(`  Base URL: ${baseUrl}`);

  // Check API key validity
  try {
    const budgetRes = await fetch(`${baseUrl}/api/mcp/budget-status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (budgetRes.ok) {
      success('API key is valid');
      const budgetData = await budgetRes.json() as BudgetStatusResponse | string;
      if (typeof budgetData === 'string') {
        console.log(`\n${budgetData}`);
      } else if (budgetData.markdown) {
        console.log(`\n${budgetData.markdown}`);
      }
    } else if (budgetRes.status === 401) {
      logError('API key is invalid or expired');
    } else {
      warn(`Server returned ${budgetRes.status}`);
    }
  } catch {
    warn('Could not reach InferLane server');
  }

  // Check promotions
  try {
    const promoRes = await fetch(`${baseUrl}/api/promotions`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (promoRes.ok) {
      const data = await promoRes.json() as PromotionsResponse;
      const promos = data.promotions || [];
      if (promos.length > 0) {
        console.log(`\n🎉 Active Promotions:`);
        for (const p of promos) {
          console.log(`  • ${p.provider}: ${p.title || p.promotionType} (${p.multiplier}x)`);
        }
      } else {
        info('No active promotions');
      }
    }
  } catch {
    // Silent fail for promotions
  }

  console.log('');
}
