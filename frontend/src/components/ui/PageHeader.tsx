import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

/** Bandeau d'en-tête de page : vert du logo, touches rouge/orange, liseré tricolore. */
const PageHeader = ({ title, subtitle, badge, className }: PageHeaderProps) => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className={cn(
      'relative mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-card',
      className,
    )}
  >
    <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-primary-500/40 blur-2xl" />
    <div className="pointer-events-none absolute right-40 -bottom-20 h-44 w-44 rounded-full bg-danger-500/30 blur-2xl" />
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.10]"
      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)', backgroundSize: '24px 24px' }}
    />
    <div className="relative px-6 py-6 lg:px-8">
      {badge && (
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {badge}
        </span>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm font-medium text-brand-100">{subtitle}</p>}
    </div>
    <div className="flag-stripe"><span /><span /><span /></div>
  </motion.section>
);

export default PageHeader;
