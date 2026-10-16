import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { RUBRIQUES } from '../config/institution';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Boutons d'action alignés à droite. */
  actions?: ReactNode;
  /** Libellé final du fil d'Ariane (par défaut : titre si c'est du texte). */
  crumb?: string;
  /** Élément placé avant le titre (ex. bouton retour). */
  leading?: ReactNode;
}

/**
 * En-tête de page institutionnel : fil d'Ariane, titre, sous-titre,
 * actions, filet orange. Utilisé par toutes les pages pour un rendu homogène.
 */
export default function PageHeader({ title, subtitle, actions, crumb, leading }: PageHeaderProps) {
  const { pathname } = useLocation();
  const base = '/' + (pathname.split('/')[1] ?? '');
  const rubrique = RUBRIQUES[base];
  const dernier = crumb ?? (typeof title === 'string' ? title : undefined);
  const estDetail = pathname.split('/').filter(Boolean).length > 1;

  return (
    <header className="page-header">
      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-ink-500 mb-2">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-success-700 transition-colors">
          <Home className="w-3.5 h-3.5" aria-hidden />
          Accueil
        </Link>
        {rubrique && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-ink-300" aria-hidden />
            <span>{rubrique}</span>
          </>
        )}
        {estDetail && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-ink-300" aria-hidden />
            <Link to={base} className="hover:text-success-700 transition-colors">
              {RUBRIQUE_LABEL[base] ?? 'Liste'}
            </Link>
          </>
        )}
        {dernier && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-ink-300" aria-hidden />
            <span className="text-success-700 font-semibold" aria-current="page">
              {dernier}
            </span>
          </>
        )}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-start gap-3 min-w-0">
          {leading}
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            <span className="mt-2 block h-[3px] w-10 rounded-full bg-primary-500" aria-hidden />
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 max-w-full">{actions}</div> : null}
      </div>
    </header>
  );
}

const RUBRIQUE_LABEL: Record<string, string> = {
  '/pdv': 'Points de vente',
};
