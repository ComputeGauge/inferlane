import { Skeleton } from '@/components/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-28 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-4">
            <div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div>
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
