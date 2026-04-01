'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SpendSnapshot, TimeRange } from '@/lib/types';

interface SpendChartProps {
  data: SpendSnapshot[];
}

export default function SpendChart({ data }: SpendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const filteredData = (() => {
    switch (timeRange) {
      case '24h': return data.slice(-1);
      case '7d': return data.slice(-7);
      case '30d': return data;
      case '90d': return data; // Would need more data in production
      default: return data;
    }
  })();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Spend Over Time</h3>
          <p className="text-sm text-gray-500 mt-0.5">Cumulative daily spend across providers</p>
        </div>
        <div className="flex gap-1 bg-[#0a0a0f] rounded-lg p-1">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                timeRange === range
                  ? 'bg-[#1e1e2e] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id="colorAnthropic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d4a27f" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#d4a27f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOpenai" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10a37f" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10a37f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4285f4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4285f4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#333"
            tick={{ fontSize: 11, fill: '#666' }}
          />
          <YAxis
            stroke="#333"
            tick={{ fontSize: 11, fill: '#666' }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#12121a',
              border: '1px solid #1e1e2e',
              borderRadius: '12px',
              padding: '12px',
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value, name) => [`$${Number(value).toFixed(2)}`, String(name)]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Area
            type="monotone"
            dataKey="anthropic"
            name="Anthropic"
            stackId="1"
            stroke="#d4a27f"
            fill="url(#colorAnthropic)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="openai"
            name="OpenAI"
            stackId="1"
            stroke="#10a37f"
            fill="url(#colorOpenai)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="google"
            name="Google"
            stackId="1"
            stroke="#4285f4"
            fill="url(#colorGoogle)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="other"
            name="Other"
            stackId="1"
            stroke="#ff6b35"
            fill="url(#colorOther)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
