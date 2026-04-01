'use client';

import { memo } from 'react';

interface Stat {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}

interface StatsBarProps {
  stats: Stat[];
}

export default memo(function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-[#2a2a3a] transition-all"
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
            {stat.trend && stat.trendValue && (
              <span
                className={`text-xs font-medium mb-1 flex items-center gap-0.5 ${
                  stat.trend === 'up'
                    ? 'text-red-400'
                    : stat.trend === 'down'
                    ? 'text-green-400'
                    : 'text-gray-400'
                }`}
              >
                {stat.trend === 'up' ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {stat.trendValue}
              </span>
            )}
          </div>
          {stat.subValue && (
            <p className="text-xs text-gray-500 mt-0.5">{stat.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
});
