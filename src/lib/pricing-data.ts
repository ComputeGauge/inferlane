import { CostComparison } from './types';

// Reference pricing data — model cost/speed/quality comparisons
// This is catalog data, not user-specific. Updated periodically.

export const costComparisons: CostComparison[] = [
  {
    model: 'Code Generation',
    task: 'Generate a REST API with 10 endpoints',
    providers: [
      { name: 'Claude Sonnet 4', cost: 0.045, speed: '8.2s', quality: 94 },
      { name: 'GPT-4o', cost: 0.038, speed: '7.1s', quality: 91 },
      { name: 'Gemini 2.0 Pro', cost: 0.028, speed: '6.5s', quality: 88 },
      { name: 'Llama 3.1 405B', cost: 0.012, speed: '11.3s', quality: 85 },
      { name: 'Grok-3', cost: 0.042, speed: '7.5s', quality: 90 },
      { name: 'Cerebras Llama 70B', cost: 0.008, speed: '2.1s', quality: 83 },
    ],
  },
  {
    model: 'Document Analysis',
    task: 'Summarize a 50-page legal document',
    providers: [
      { name: 'Claude Opus 4', cost: 0.82, speed: '45s', quality: 97 },
      { name: 'GPT-4o', cost: 0.55, speed: '32s', quality: 93 },
      { name: 'Gemini 2.0 Pro', cost: 0.38, speed: '28s', quality: 90 },
      { name: 'Claude Sonnet 4', cost: 0.22, speed: '18s', quality: 92 },
      { name: 'Sonar Pro', cost: 0.45, speed: '25s', quality: 91 },
      { name: 'Grok-3', cost: 0.75, speed: '40s', quality: 94 },
    ],
  },
  {
    model: 'Chat / Support',
    task: '100 customer support responses',
    providers: [
      { name: 'Claude Haiku 3.5', cost: 0.008, speed: '0.8s', quality: 88 },
      { name: 'GPT-4o-mini', cost: 0.006, speed: '0.6s', quality: 86 },
      { name: 'Gemini 2.0 Flash', cost: 0.003, speed: '0.5s', quality: 84 },
      { name: 'Mixtral 8x22B', cost: 0.004, speed: '0.9s', quality: 82 },
      { name: 'Grok-3 Mini', cost: 0.004, speed: '0.5s', quality: 85 },
      { name: 'Cerebras Llama 70B', cost: 0.003, speed: '0.3s', quality: 82 },
      { name: 'SambaNova Llama 70B', cost: 0.003, speed: '0.4s', quality: 82 },
    ],
  },
];
