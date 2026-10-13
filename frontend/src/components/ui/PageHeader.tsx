import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

/** Bandeau d'en-tête de page : vert LONACI, trame de points, filet orange (style Boussole). */
const PageHeader = ({ title, subtitle, badge, className }: PageHeaderProps) => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className={cn('relative mb-6 overflow-hidden rounded-2xl text-white shadow-card', className)}
    style={{ background: 'var(--deep)' }}
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.12]"
      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1.3px, transparent 0)', backgroundSize: '30px 30px' }}
    />
    <div className="relative px-6 py-6 lg:px-8">
      {badge && (
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1 text-[11.5px] font-semibold text-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-deep/70" />
          {badge}
        </span>
      )}
      <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-white lg:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/70">{subtitle}</p>}
    </div>
    <div className="h-[2px] w-full bg-primary-500" />
  </motion.section>
);

export default PageHeader;
