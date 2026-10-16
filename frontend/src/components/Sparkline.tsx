interface Props {
  data: number[];
  /** Texte alternatif lu par les lecteurs d'écran. */
  label: string;
  width?: number;
  height?: number;
}

/** Mini-courbe d'évolution (couleur héritée du texte : `text-*` du parent). */
export default function Sparkline({ data, label, width = 84, height = 30 }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => [
    pad + (i * (width - pad * 2)) / (data.length - 1),
    max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const ligne = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const aire = `${ligne} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={aire} fill="currentColor" opacity=".12" />
      <path d={ligne} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill="currentColor" />
    </svg>
  );
}
