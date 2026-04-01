import { Skeleton } from '@/components/Skeleton';

export default function EarningsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-24 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}
