'use client';

import { useState, useEffect } from 'react';
import { useTrack, EVENTS } from '@/hooks/useTrack';

interface Recommendation {
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  taskType: string;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  monthlySavings: number;
  savingsPercent: number;
  speedNote: string;
}

export default function SavingsRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const track = useTrack();

  useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    try {
      const res = await fetch('/api/recommendations');
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch {
      // No recommendations available
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(rec: Recommendation) {
    track(EVENTS.CTA_CLICK, {
      source: 'recommendation',
      provider: rec.toProvider,
      savings: rec.monthlySavings,
    });

    try {
      const res = await fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: rec.toProvider, source: 'recommendation' }),
      });
      const data = await res.json();
      if (data.redirectUrl && data.redirectUrl !== '#') {
        window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Fallback — just open signup
    }
  }

  async function handleDismiss(rec: Recommendation) {
    setRecommendations(prev => prev.filter(r => r.toProvider !== rec.toProvider));
  }

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Savings Opportunities</h3>
          <p className="text-sm text-gray-500 mt-1">
            Based on your usage patterns, you could save by trying these providers
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-sm font-medium text-green-400">
            ${recommendations.reduce((sum, r) => sum + r.monthlySavings, 0).toFixed(0)}/mo potential
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.slice(0, 3).map((rec) => (
          <div
            key={`${rec.fromProvider}-${rec.toProvider}`}
            className="flex items-center justify-between p-4 rounded-xl border border-[#1a1a2a] hover:border-[#2a2a3a] transition-all"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">
                  Save ${rec.monthlySavings}/mo
                </span>
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg">
                  {rec.savingsPercent}% less
                </span>
                {rec.speedNote && (
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg">
                    {rec.speedNote}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Route {rec.taskType.replace('_', ' ')} from {rec.fromModel} to {rec.toModel}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleDismiss(rec)}
                className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleClick(rec)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Try {rec.toProvider.charAt(0) + rec.toProvider.slice(1).toLowerCase()}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
