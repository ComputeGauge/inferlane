'use client';

import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {icon && <span className="text-4xl mb-4">{icon}</span>}
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <p className="text-gray-400 mt-1 text-center max-w-sm">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
