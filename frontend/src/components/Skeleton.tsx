/** Bloc de chargement animé (squelette). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-mist-100 ${className}`} aria-hidden="true" />;
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
    <div className="rounded-2xl border bg-white p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  );
}

/** Squelette complet du tableau de bord : cartes KPI + graphiques. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="flex items-center justify-between gap-4 pb-4">
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

/** Liste de cartes en cours de chargement (alertes, zones…). */
export function SkeletonList({ rows = 4, label = 'Chargement' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card !p-5 flex items-start gap-4">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full max-w-md" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Fiche détaillée (dossier PDV) en cours de chargement. */
export function SkeletonDetail({ label = 'Chargement du dossier' }: { label?: string }) {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5"><SkeletonChart height="h-40" /><SkeletonChart height="h-56" /></div>
        <div className="space-y-5"><SkeletonChart height="h-32" /><SkeletonChart height="h-40" /></div>
      </div>
    </div>
  );
}

/** Page de reporting en cours de chargement. */
export function SkeletonReporting() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="Chargement du reporting">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, i) => <SkeletonKpi key={i} />)}</div>
      <div className="grid gap-5 lg:grid-cols-2"><SkeletonChart /><SkeletonChart /></div>
      <SkeletonChart height="h-48" />
    </div>
  );
}
