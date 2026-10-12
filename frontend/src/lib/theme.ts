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
  grid: '#E1EBE4',
  axis: '#BCCAC1',
  tick: '#4A504D',
} as const;

/** Props communes aux axes Recharts pour un rendu homogène. */
export const axisProps = {
  tick: { fontSize: 12, fill: CHART.tick, fontWeight: 500 },
  axisLine: { stroke: CHART.axis },
  tickLine: { stroke: CHART.axis },
} as const;

/** Info-bulle Recharts aux couleurs de la marque. */
export const tooltipProps = {
  contentStyle: {
    borderRadius: 14,
    border: '1px solid #D6E5DA',
    boxShadow: '0 12px 40px rgba(6,35,22,.20)',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
  },
  labelStyle: { fontWeight: 700, color: '#062316', marginBottom: 4 },
  cursor: { fill: 'rgba(0,136,64,.07)' },
} as const;

/** Couleur d'un statut de PDV (marqueurs de carte). */
export const couleurStatut = (statut?: string | null): string =>
  statut === 'actif' ? BRAND.green : statut === 'inactif' ? BRAND.grey : BRAND.red;
