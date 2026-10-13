interface BrandBadgeProps {
  size?: number;
  /** « light » : médaillon blanc (sur l'en-tête vert) · « dark » : médaillon vert-noir (sur fond clair). */
  tone?: 'light' | 'dark';
}

/**
 * Médaillon LONACI : anneau qui tourne + halo qui pulse (même effet que le médaillon de Boussole).
 */
export default function BrandBadge({ size = 48, tone = 'light' }: BrandBadgeProps) {
  return (
    <span
      className={`brand-badge ${tone === 'dark' ? 'brand-badge--dark' : ''}`}
      style={{ ['--s' as string]: `${size}px` }}
      aria-hidden="true"
    >
      <svg className="brand-ring" viewBox="0 0 50 50">
        <circle className="ring-base" cx="25" cy="25" r="23.5" />
        <circle className="ring-spin" cx="25" cy="25" r="23.5" />
      </svg>
      <img className="brand-mark" src="/assets/lonaci-mark.png" alt="" />
    </span>
  );
}
