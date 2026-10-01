/**
 * Palette LONACI — source unique pour tout ce qui ne passe pas par Tailwind
 * (graphiques Recharts, marqueurs et tracés Leaflet, toasts).
 * Logo : vert #008840 · rouge #C82828 · noir  |  Drapeau CI : orange #FF8200 · blanc · vert
 */
export const BRAND = {
  orange: '#FF8200',
  orangeDark: '#C85D00',
  green: '#008840',
  greenLight: '#24AB62',
  red: '#C82828',
  black: '#0D1210',
  charcoal: '#27312C',
  gold: '#F5BE16',
  grey: '#8D9490',
} as const;

/** Couleurs de séries, dans l'ordre d'utilisation (la 1re = couleur principale). */
export const CHART_SERIES = [
  BRAND.orange,
  BRAND.green,
  BRAND.red,
  BRAND.charcoal,
  BRAND.gold,
  BRAND.greenLight,
  BRAND.orangeDark,
  BRAND.grey,
];

export const CHART = {
  grid: '#E4E7E5',
  axis: '#BCC1BE',
  tick: '#4A504D',
} as const;

/** Props communes aux axes Recharts pour un rendu homogène. */
export const axisProps = {
  tick: { fontSize: 12, fill: CHART.tick, fontWeight: 600 },
  axisLine: { stroke: CHART.axis },
  tickLine: { stroke: CHART.axis },
} as const;

/** Info-bulle Recharts aux couleurs de la marque. */
export const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #DCDFDD',
    boxShadow: '0 16px 40px -8px rgba(10,12,11,.24)',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
  },
  labelStyle: { fontWeight: 800, color: '#141716', marginBottom: 4 },
  cursor: { fill: 'rgba(255,130,0,.08)' },
} as const;

/** Couleur d'un statut de PDV (marqueurs de carte). */
export const couleurStatut = (statut?: string | null): string =>
  statut === 'actif' ? BRAND.green : statut === 'inactif' ? BRAND.grey : BRAND.red;
