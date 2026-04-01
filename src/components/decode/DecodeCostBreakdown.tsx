'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailyBreakdown {
  date: string;
  prefill: number;
  decode: number;
  kvCache: number;
  total: number;
}

interface BreakdownSummary {
  totalPrefill: number;
  totalDecode: number;
  totalKvCache: number;
  totalCost: number;
  decodePercentage: number;
}

interface BreakdownData {
  breakdown: DailyBreakdown[];
  summary: BreakdownSummary;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400 mb-1">{formatDateLabel(label)}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-white font-mono">{formatUsd(entry.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 text-xs mt-1 pt-1 border-t border-gray-700">
        <span className="text-gray-400">Total</span>
        <span className="text-white font-mono font-medium">{formatUsd(total)}</span>
      </div>
    </div>
  );
}

export default function DecodeCostBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBreakdown() {
      try {
        const res = await fetch('/api/spend/decode-breakdown');
        if (!res.ok) throw new Error('Failed to load decode breakdown');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Unable to load decode cost data');
      } finally {
        setLoading(false);
      }
    }
    fetchBreakdown();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#111118] border border-gray-800 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 bg-gray-800 rounded" />
          <div className="h-4 w-72 bg-gray-800 rounded" />
          <div className="h-[300px] w-full bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { breakdown, summary } = data;

  if (breakdown.length === 0) {
    return (
      <div className="bg-[#111118] border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Decode Cost Breakdown</h3>
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">No decode data yet</p>
        </div>
      </div>
    );
  }

  const chartData = breakdown.map((d) => ({
    ...d,
    dateLabel: formatDateLabel(d.date),
  }));

  return (
    <div className="bg-[#111118] border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Decode Cost Breakdown</h3>
      <p className="text-sm text-amber-500 mb-6">
        Decode accounts for {summary.decodePercentage}% of your spend
      </p>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatUsd(v)}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
              iconType="square"
              iconSize={10}
            />
            <Bar dataKey="prefill" name="Prefill" stackId="cost" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="decode" name="Decode" stackId="cost" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="kvCache" name="KV Cache" stackId="cost" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
