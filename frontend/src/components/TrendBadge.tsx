import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface Props {
  delta: number;
  pct: number | null;
  /** true : une hausse est défavorable (alertes, terminaux muets). */
  inverse?: boolean;
  suffix?: string;
  title?: string;
}

/** Variation sous forme de pastille : ▲ +12 % · 7 j */
export default function TrendBadge({ delta, pct, inverse = false, suffix, title }: Props) {
  const stable = delta === 0;
  const hausse = delta > 0;
  const bon = stable ? null : inverse ? !hausse : hausse;
  const couleur = bon === null ? 'bg-ink-100 text-ink-600' : bon ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700';
  const Icone = stable ? Minus : hausse ? ArrowUpRight : ArrowDownRight;
  const valeur = stable
    ? 'Stable'
    : pct !== null && Number.isFinite(pct)
      ? `${hausse ? '+' : '−'}${Math.abs(Math.round(pct))} %`
      : `${hausse ? '+' : '−'}${Math.abs(delta).toLocaleString('fr-FR')}`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-[2px] text-[10.5px] font-semibold leading-none whitespace-nowrap ${couleur}`}
    >
      <Icone className="h-3 w-3" aria-hidden="true" />
      <span>{valeur}</span>
      {suffix && <span className="font-medium">· {suffix}</span>}
      <span className="sr-only">{bon === null ? '' : bon ? ', évolution favorable' : ', évolution défavorable'}</span>
    </span>
  );
}
