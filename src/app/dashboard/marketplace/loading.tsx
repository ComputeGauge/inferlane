import { Skeleton, MarketplaceCardSkeleton } from '@/components/Skeleton';

export default function MarketplaceLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <MarketplaceCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
