import { ORDRE_STATUTS, STATUTS, StatutReel } from '../lib/pdvStatus';

interface Props {
  compteurs: Record<StatutReel, number>;
  /** Statut actuellement filtré ('all' = aucun). */
  selection?: string;
  /** Si fourni, les pastilles deviennent des filtres cliquables. */
  onSelect?: (statut: string) => void;
  className?: string;
}

/** Légende des statuts réels, avec le nombre de PDV pour chacun. */
const PDVStatusLegend = ({ compteurs, selection = 'all', onSelect, className = '' }: Props) => (
  <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-700 ${className}`}>
    {ORDRE_STATUTS.map((s) => {
      const actif = selection === s;
      const Tag = onSelect ? 'button' : 'span';
      return (
        <Tag
          key={s}
          {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(actif ? 'all' : s) } : {})}
          title={STATUTS[s].description}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border transition-colors ${
            actif ? 'bg-ink-800 text-white border-ink-800' : 'bg-white border-ink-200 hover:bg-ink-50'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUTS[s].couleur }} />
          {STATUTS[s].libelle}
          <span className={`tabular-nums ${actif ? 'text-white/80' : 'text-ink-500'}`}>{compteurs[s]}</span>
        </Tag>
      );
    })}
  </div>
);

export default PDVStatusLegend;
