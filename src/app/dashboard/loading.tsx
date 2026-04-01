import { StatsBarSkeleton, GaugesSkeleton, ChartSkeleton, AlertsSkeleton } from '@/components/Skeleton';

export default function DashboardLoading() {
  return (
    <>
      <StatsBarSkeleton />
      <GaugesSkeleton />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <AlertsSkeleton />
      </div>
    </>
  );
}
