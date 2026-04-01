'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-[#1e1e2e] rounded-xl ${className}`} />
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function GaugesSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <Skeleton className="h-5 w-44 mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <Skeleton className="w-28 h-28 rounded-full mb-3" />
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-5 w-36 mb-2" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[#1e1e2e]">
            <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProviderCardSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mb-4" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-t border-[#1a1a2a]">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketplaceCardSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-3/4 mb-3" />
      <Skeleton className="h-20 w-full rounded-xl mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-16 rounded-xl" />
      </div>
    </div>
  );
}
