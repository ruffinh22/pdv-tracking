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
 * actions, filet tricolore. Utilisé par toutes les pages pour un rendu homogène.
 */
export default function PageHeader({ title, subtitle, actions, crumb, leading }: PageHeaderProps) {
  const { pathname } = useLocation();
  const base = '/' + (pathname.split('/')[1] ?? '');
  const rubrique = RUBRIQUES[base];
  const dernier = crumb ?? (typeof title === 'string' ? title : undefined);
  const estDetail = pathname.split('/').filter(Boolean).length > 1;

  return (
    <header className="page-header">
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-ink-500 mb-2.5">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-primary-700 transition-colors">
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
            <Link to={base} className="hover:text-primary-700 transition-colors">
              {RUBRIQUE_LABEL[base] ?? 'Liste'}
            </Link>
          </>
        )}
        {dernier && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-ink-300" aria-hidden />
            <span className="text-ink-900 font-bold" aria-current="page">
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
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

const RUBRIQUE_LABEL: Record<string, string> = {
  '/pdv': 'Points de vente',
};
