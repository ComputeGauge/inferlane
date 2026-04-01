'use client';

interface StatusDotProps {
  status: 'healthy' | 'degraded' | 'offline' | 'cooldown';
  label?: string;
  pulse?: boolean;
}

const statusColors: Record<StatusDotProps['status'], string> = {
  healthy: 'bg-green-400',
  degraded: 'bg-amber-400',
  offline: 'bg-gray-500',
  cooldown: 'bg-red-400',
};

export function StatusDot({ status, label, pulse = false }: StatusDotProps) {
  return (
    <span className="inline-flex items-center">
      <span
        className={`w-2 h-2 rounded-full inline-block ${statusColors[status]} ${pulse ? 'animate-pulse' : ''}`}
      />
      {label && <span className="text-xs text-gray-400 ml-1.5">{label}</span>}
    </span>
  );
}
