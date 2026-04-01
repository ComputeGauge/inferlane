'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#1e1e2e] text-gray-300 border-[#2a2a3a]',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`rounded-full border inline-flex items-center font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}
