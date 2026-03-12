'use client';

import { useState } from 'react';
import { CostComparison } from '@/lib/types';

interface CostComparisonTableProps {
  comparisons: CostComparison[];
}

export default function CostComparisonTable({ comparisons }: CostComparisonTableProps) {
  const [selectedTask, setSelectedTask] = useState(0);
  const comparison = comparisons[selectedTask];

  const cheapest = Math.min(...comparison.providers.map(p => p.cost));
  const bestQuality = Math.max(...comparison.providers.map(p => p.quality));

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Smart Router</h3>
          <p className="text-sm text-gray-500 mt-0.5">Compare cost, speed & quality per task</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
            Best value
          </span>
        </div>
      </div>

      {/* Task selector */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {comparisons.map((comp, i) => (
          <button
            key={i}
            onClick={() => setSelectedTask(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedTask === i
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-[#0a0a0f] text-gray-400 border border-transparent hover:text-gray-200'
            }`}
          >
            {comp.model}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-4">{comparison.task}</p>

      {/* Comparison table */}
      <div className="space-y-2">
        {comparison.providers
          .sort((a, b) => a.cost - b.cost)
          .map((provider, i) => {
            const isCheapest = provider.cost === cheapest;
            const isBestQuality = provider.quality === bestQuality;

            return (
              <div
                key={provider.name}
                className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                  i === 0
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-[#0a0a0f] border-[#1a1a2a]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{provider.name}</span>
                    {isCheapest && (
                      <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">
                        CHEAPEST
                      </span>
                    )}
                    {isBestQuality && (
                      <span className="text-[10px] bg-purple-400/20 text-purple-400 px-1.5 py-0.5 rounded">
                        BEST QUALITY
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-semibold text-white">
                    ${provider.cost.toFixed(3)}
                  </span>
                </div>
                <div className="text-right w-16">
                  <span className="text-xs text-gray-400">{provider.speed}</span>
                </div>
                <div className="w-20">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1e1e2e] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${provider.quality}%`,
                          backgroundColor: provider.quality >= 93 ? '#8b5cf6' : provider.quality >= 88 ? '#3b82f6' : '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono w-6">{provider.quality}</span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
