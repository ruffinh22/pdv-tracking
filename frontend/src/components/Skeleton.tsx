/** Bloc de chargement animé (squelette). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 ${className}`} aria-hidden="true" />;
}

export function SkeletonKpi() {
  return (
    <div className="flex items-start gap-3 rounded-xl p-3.5 kpi-card">
      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  );
}

/** Squelette complet du tableau de bord : cartes KPI + graphiques. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-ink-200">
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonKpi key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
