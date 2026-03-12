'use client';

import CostComparisonTable from '@/components/CostComparisonTable';
import { costComparisons } from '@/lib/pricing-data';

export default function RouterPage() {
  return (
    <div className="space-y-6">
      <CostComparisonTable comparisons={costComparisons} />

      {/* Cloud marketplace CTAs */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Save with Cloud Marketplaces</h3>
        <p className="text-sm text-gray-500 mb-6">
          Access the same AI models through cloud providers. Consolidate billing, get volume discounts, and use committed spend credits.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              name: 'AWS Bedrock',
              description: 'Claude, Llama, Mistral models. Pay-as-you-go or provisioned throughput.',
              savings: 'Up to 20% with Savings Plans',
              color: '#ff9900',
              url: 'https://aws.amazon.com/bedrock/',
              logo: '\u{1F7E0}',
            },
            {
              name: 'Azure OpenAI',
              description: 'GPT-4o, DALL-E models. Enterprise security and compliance.',
              savings: 'Up to 15% with Reserved Capacity',
              color: '#0078d4',
              url: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
              logo: '\u{1F537}',
            },
            {
              name: 'GCP Vertex AI',
              description: 'Gemini, Claude, PaLM models. Integrated with BigQuery.',
              savings: 'Up to 10% with Committed Use',
              color: '#4285f4',
              url: 'https://cloud.google.com/vertex-ai',
              logo: '\u{1F535}',
            },
          ].map((cloud) => (
            <a
              key={cloud.name}
              href={cloud.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-[#1a1a2a] hover:border-[#3a3a4a] transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{cloud.logo}</span>
                <h4 className="font-semibold text-white text-sm group-hover:text-amber-400 transition-colors">
                  {cloud.name}
                </h4>
              </div>
              <p className="text-xs text-gray-400 mb-3">{cloud.description}</p>
              <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
                {cloud.savings}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
