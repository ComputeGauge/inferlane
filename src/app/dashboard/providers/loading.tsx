import { Skeleton, ProviderCardSkeleton } from '@/components/Skeleton';

export default function ProvidersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <ProviderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
