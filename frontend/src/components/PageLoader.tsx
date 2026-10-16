import BrandBadge from './BrandBadge';

/** Écran de chargement à la marque LONACI (médaillon animé). */
export default function PageLoader({ fullscreen = false, label = 'Chargement…' }: { fullscreen?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${fullscreen ? 'min-h-screen text-white' : 'min-h-[55vh] text-ink-500'}`}
      style={fullscreen ? { background: 'var(--deep)' } : undefined}
    >
      <BrandBadge size={fullscreen ? 76 : 56} tone={fullscreen ? 'light' : 'dark'} />
      <span className="font-display text-[13px] font-semibold uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
