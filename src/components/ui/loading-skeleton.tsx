'use client';

interface SkeletonProps {
  rows?: number;
  type?: 'card' | 'table' | 'text';
}

function ShimmerBar({ className = '' }: { className?: string }) {
  return <div className={`bg-[#1e1e2e] animate-pulse rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 space-y-4">
      <ShimmerBar className="h-4 w-1/3" />
      <ShimmerBar className="h-8 w-1/2" />
      <ShimmerBar className="h-3 w-2/3" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows: number }) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-[#1e1e2e]">
        <ShimmerBar className="h-4 w-24" />
        <ShimmerBar className="h-4 w-32" />
        <ShimmerBar className="h-4 w-20" />
        <ShimmerBar className="h-4 w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-[#1e1e2e] last:border-b-0">
          <ShimmerBar className="h-4 w-24" />
          <ShimmerBar className="h-4 w-32" />
          <ShimmerBar className="h-4 w-20" />
          <ShimmerBar className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function TextSkeleton({ rows = 3 }: { rows: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerBar key={i} className={`h-4 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5, type = 'card' }: SkeletonProps) {
  switch (type) {
    case 'card':
      return <CardSkeleton />;
    case 'table':
      return <TableSkeleton rows={rows} />;
    case 'text':
      return <TextSkeleton rows={rows} />;
  }
}
