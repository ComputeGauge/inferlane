'use client';

import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  href?: string;
}

function CardContent({ label, value, change, changeType = 'neutral', icon }: StatCardProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {change && (
          <p
            className={`text-xs mt-1 font-medium ${
              changeType === 'positive'
                ? 'text-green-400'
                : changeType === 'negative'
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {change}
          </p>
        )}
      </div>
      {icon && <span className="text-2xl">{icon}</span>}
    </div>
  );
}

export function StatCard(props: StatCardProps) {
  const card = (
    <div
      className={`bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 ${
        props.href ? 'hover:border-[#2a2a3a] transition-colors' : ''
      }`}
    >
      <CardContent {...props} />
    </div>
  );

  if (props.href) {
    return <Link href={props.href}>{card}</Link>;
  }

  return card;
}
