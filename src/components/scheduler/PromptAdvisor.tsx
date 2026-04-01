'use client';

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestionMessage {
  role: string;
  content: string;
}

interface ChainStep {
  index: number;
  title: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  estimatedTokens: number;
}

interface SavingsInfo {
  normalCostCents: number;
  bonusCostCents: number;
  savingsCents: number;
  savingsPercent: number;
}

interface Suggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  model: string;
  systemPrompt: string;
  messages: SuggestionMessage[];
  estimatedTokens: number;
  estimatedCostCents: number;
  whyDuringBonus: string;
  chainSteps?: ChainStep[];
  tags: string[];
  savings?: SavingsInfo;
  activePromotion?: {
    id: string;
    provider: string;
    title: string;
    multiplier: number;
    endsAt: string;
  } | null;
}

interface PromptAdvisorProps {
  suggestions: Suggestion[];
  onQueue?: (suggestion: Suggestion) => void;
  onQueueChain?: (suggestion: Suggestion) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  CODEBASE_ANALYSIS: 'Codebase Analysis',
  DOCUMENT_PROCESSING: 'Document Processing',
  MODEL_COMPARISON: 'Model Comparison',
  KNOWLEDGE_EXTRACTION: 'Knowledge Extraction',
  CREATIVE_GENERATION: 'Creative Generation',
  DATA_PIPELINE: 'Data Pipeline',
};

const CATEGORY_ICONS: Record<string, string> = {
  CODEBASE_ANALYSIS: '\u{1F50D}',
  DOCUMENT_PROCESSING: '\u{1F4C4}',
  MODEL_COMPARISON: '\u{2696}',
  KNOWLEDGE_EXTRACTION: '\u{1F9E0}',
  CREATIVE_GENERATION: '\u{1F3A8}',
  DATA_PIPELINE: '\u{1F4CA}',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptAdvisor({
  suggestions,
  onQueue,
  onQueueChain,
}: PromptAdvisorProps) {
  const [queueing, setQueueing] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = selectedCategory
    ? suggestions.filter((s) => s.category === selectedCategory)
    : suggestions;

  // Group by category
  const grouped = filtered.reduce<Record<string, Suggestion[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const categories = [...new Set(suggestions.map((s) => s.category))];

  const handleQueue = useCallback(
    async (suggestion: Suggestion) => {
      if (onQueue) {
        setQueueing(suggestion.id);
        try {
          onQueue(suggestion);
        } finally {
          setTimeout(() => setQueueing(null), 500);
        }
        return;
      }

      setQueueing(suggestion.id);
      try {
        await fetch('/api/scheduler/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestion.title,
            model: suggestion.model,
            systemPrompt: suggestion.systemPrompt,
            messages: suggestion.messages,
            scheduleType: 'OPTIMAL_WINDOW',
            priority: 'medium',
          }),
        });
      } catch (err) {
        console.error('Failed to queue suggestion:', err);
      } finally {
        setQueueing(null);
      }
    },
    [onQueue],
  );

  const handleQueueChain = useCallback(
    async (suggestion: Suggestion) => {
      if (onQueueChain) {
        onQueueChain(suggestion);
        return;
      }

      if (!suggestion.chainSteps?.length) return;

      try {
        await fetch('/api/scheduler/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestion.title,
            steps: suggestion.chainSteps.map((step, i) => ({
              title: step.title,
              model: step.model,
              systemPrompt: step.systemPrompt,
              userPrompt: step.userPromptTemplate,
              dependsOnIndex: i > 0 ? i - 1 : null,
            })),
          }),
        });
      } catch (err) {
        console.error('Failed to queue chain:', err);
      }
    },
    [onQueueChain],
  );

  return (
    <div className="space-y-6">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !selectedCategory
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-[#1e1e2e] text-gray-400 border border-[#1e1e2e] hover:text-gray-300'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-[#1e1e2e] text-gray-400 border border-[#1e1e2e] hover:text-gray-300'
            }`}
          >
            {CATEGORY_ICONS[cat] ?? ''} {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Grouped cards */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {CATEGORY_ICONS[category] ?? ''} {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5 hover:border-[#2e2e3e] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-white font-medium text-sm leading-tight pr-2">
                    {suggestion.title}
                  </h4>
                  {suggestion.savings && suggestion.savings.savingsPercent > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      Save {suggestion.savings.savingsPercent}%
                    </span>
                  )}
                </div>

                <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                  {suggestion.description}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {suggestion.model.split('-').slice(0, 2).join(' ')}
                  </span>
                  <span>~{(suggestion.estimatedTokens / 1000).toFixed(1)}k tokens</span>
                  <span className="text-amber-400">
                    ~{suggestion.estimatedCostCents.toFixed(1)}c
                  </span>
                </div>

                {/* Bonus explanation */}
                {suggestion.activePromotion && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-3">
                    <p className="text-[10px] text-amber-400/80">
                      {suggestion.whyDuringBonus}
                    </p>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {suggestion.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#1e1e2e] text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQueue(suggestion)}
                    disabled={queueing === suggestion.id}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                  >
                    {queueing === suggestion.id ? 'Queuing...' : 'Queue Now'}
                  </button>
                  {suggestion.chainSteps && suggestion.chainSteps.length > 0 && (
                    <button
                      onClick={() => handleQueueChain(suggestion)}
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                      Queue Chain
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No suggestions available for this category.</p>
        </div>
      )}
    </div>
  );
}
