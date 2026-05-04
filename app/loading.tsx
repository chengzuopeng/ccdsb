import { KpiSkeleton } from '@/components/kpi-card';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-bg-surface-hi rounded animate-pulse" />
        <div className="h-4 w-72 bg-bg-surface-hi rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div className="card card-pad min-h-[280px] animate-pulse" />
    </div>
  );
}
