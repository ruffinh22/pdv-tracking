import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Crown, Inbox, TrendingUp } from 'lucide-react';
import { BRAND, tooltipProps } from '../lib/theme';
import CountUp from './CountUp';

export interface LigneAnalyse {
  label: string;
  total: number;
  actifs: number;
  inactifs: number;
}

type Tri = 'total' | 'actifs' | 'taux';

const TRIS: { value: Tri; label: string }[] = [
  { value: 'total', label: 'Volume' },
  { value: 'actifs', label: 'Actifs' },
  { value: 'taux', label: "Taux d'activité" },
];

const fmt = (n: number) => n.toLocaleString('fr-FR');
const taux = (l: LigneAnalyse) => (l.total > 0 ? Math.round((l.actifs / l.total) * 100) : 0);

/** Couleur du taux d'activité : vert (sain), orange (moyen), rouge (faible). */
const couleurTaux = (t: number) => (t >= 70 ? BRAND.green : t >= 40 ? BRAND.orange : BRAND.red);

interface Props {
  data: LigneAnalyse[];
  loading?: boolean;
  /** Libellé de la dimension analysée, ex. « ville ». */
  dimensionLabel: string;
  /** Nombre de lignes visibles avant « Voir tout ». */
  limite?: number;
}

export default function AnalyseClassement({ data, loading = false, dimensionLabel, limite = 7 }: Props) {
  const [tri, setTri] = useState<Tri>('total');
  const [toutVoir, setToutVoir] = useState(false);

  const synthese = useMemo(() => {
    const total = data.reduce((s, l) => s + l.total, 0);
    const actifs = data.reduce((s, l) => s + l.actifs, 0);
    const inactifs = data.reduce((s, l) => s + l.inactifs, 0);
    return { total, actifs, inactifs, taux: total > 0 ? Math.round((actifs / total) * 100) : 0 };
  }, [data]);

  const lignes = useMemo(() => {
    const copie = [...data];
    copie.sort((a, b) =>
      tri === 'taux' ? taux(b) - taux(a) || b.total - a.total : tri === 'actifs' ? b.actifs - a.actifs : b.total - a.total
    );
    return copie;
  }, [data, tri]);

  const visibles = toutVoir ? lignes : lignes.slice(0, limite);
  const maxTotal = Math.max(1, ...visibles.map((l) => l.total));

  if (loading) {
    return (
      <div className="p-6 grid lg:grid-cols-[1fr_300px] gap-6" aria-busy>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-ink-100 animate-pulse" style={{ width: `${95 - i * 8}%` }} />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-ink-100 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-ink-100 ring-1 ring-ink-200 flex items-center justify-center text-ink-500">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="font-bold text-ink-800">Aucune donnée pour cette dimension</p>
      </div>
    );
  }

  const pie = [
    { name: 'Actifs', value: synthese.actifs, color: BRAND.green },
    { name: 'Inactifs', value: synthese.inactifs, color: '#CDD2CF' },
  ];

  return (
    <div className="p-5 sm:p-6">
      {/* Sélecteur de tri */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-[12px] font-semibold text-ink-500">
          <span className="font-extrabold text-ink-800">{data.length}</span> {dimensionLabel}
          {data.length > 1 ? 's' : ''} analysée{data.length > 1 ? 's' : ''}
        </p>
        <div className="inline-flex items-center gap-1 bg-ink-100 rounded-lg p-1" role="tablist" aria-label="Trier le classement">
          {TRIS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tri === t.value}
              onClick={() => setTri(t.value)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all ${
                tri === t.value ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_290px] gap-6 lg:gap-8">
        {/* ---------- Classement ---------- */}
        <div>
          <ol className="space-y-1.5">
            {visibles.map((l, i) => {
              const t = taux(l);
              const largeur = (l.total / maxTotal) * 100;
              const partActifs = l.total > 0 ? (l.actifs / l.total) * 100 : 0;
              return (
                <li
                  key={l.label}
                  className="group grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-primary-50/70 transition-colors"
                  title={`${l.label} : ${fmt(l.actifs)} actifs sur ${fmt(l.total)} (${t} %)`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-extrabold ${
                      i === 0 ? 'bg-primary-500 text-white shadow-glow' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {i === 0 ? <Crown className="w-3.5 h-3.5" /> : i + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className="text-[13px] font-bold text-ink-950 truncate">{l.label}</span>
                      <span className="text-[11px] font-semibold text-ink-500 whitespace-nowrap num">
                        {fmt(l.actifs)} actifs · {fmt(l.inactifs)} inactifs
                      </span>
                    </div>
                    {/* Piste proportionnelle au plus gros total ; remplissage vert = part d'actifs */}
                    <div className="h-2.5 rounded-full bg-ink-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-ink-300/80 overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: `${largeur}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: BRAND.green }}
                          initial={{ width: 0 }}
                          animate={{ width: `${partActifs}%` }}
                          transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: 'easeOut' }}
                        />
                      </motion.div>
                    </div>
                  </div>

                  <div className="text-right leading-none w-[64px]">
                    <p className="font-display text-[15px] font-extrabold text-ink-950 num">{fmt(l.total)}</p>
                    <p className="text-[11px] font-extrabold mt-1 num" style={{ color: couleurTaux(t) }}>
                      {t} %
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {lignes.length > limite && (
            <button
              onClick={() => setToutVoir((v) => !v)}
              className="mt-3 w-full py-2 rounded-lg text-[12px] font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              {toutVoir ? 'Réduire le classement' : `Voir les ${lignes.length - limite} autres`}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[11px] font-semibold text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-sm" style={{ background: BRAND.green }} /> Actifs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-sm bg-ink-300/80" /> Inactifs
            </span>
            <span className="ml-auto">Longueur de barre = volume de PDV</span>
          </div>
        </div>

        {/* ---------- Synthèse ---------- */}
        <aside className="rounded-2xl bg-ink-50 ring-1 ring-ink-200 p-5 flex flex-col">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-500">Synthèse globale</p>

          <div className="relative h-44 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="value"
                  innerRadius="68%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  cornerRadius={6}
                  stroke="none"
                >
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="font-display text-[2rem] font-extrabold text-ink-950 leading-none num">
                <CountUp value={synthese.taux} />
                <span className="text-lg">%</span>
              </p>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-500 mt-1">d'activité</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div className="rounded-lg bg-white ring-1 ring-ink-200 py-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-ink-500">Total</dt>
              <dd className="font-display text-[15px] font-extrabold text-ink-950 num">{fmt(synthese.total)}</dd>
            </div>
            <div className="rounded-lg bg-white ring-1 ring-success-200 py-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-success-700">Actifs</dt>
              <dd className="font-display text-[15px] font-extrabold text-success-700 num">{fmt(synthese.actifs)}</dd>
            </div>
            <div className="rounded-lg bg-white ring-1 ring-ink-200 py-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-ink-500">Inactifs</dt>
              <dd className="font-display text-[15px] font-extrabold text-ink-700 num">{fmt(synthese.inactifs)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary-50 ring-1 ring-primary-200 px-3 py-2.5">
            <TrendingUp className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] font-semibold text-ink-700 leading-snug">
              <span className="font-extrabold text-ink-950">{lignes[0]?.label}</span> arrive en tête
              {tri === 'taux' ? ` avec ${taux(lignes[0])} % d'activité` : tri === 'actifs' ? ` avec ${fmt(lignes[0].actifs)} PDV actifs` : ` avec ${fmt(lignes[0].total)} PDV`}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
