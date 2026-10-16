import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, LogIn, RefreshCw } from 'lucide-react';
import BrandBadge from '../components/BrandBadge';
import DocumentTitle from '../components/DocumentTitle';
import { INSTITUTION } from '../config/institution';

export type ErrorVariant = 'introuvable' | 'refuse' | 'session' | 'erreur';

const CONTENU: Record<ErrorVariant, { code: string; titre: string; texte: string }> = {
  introuvable: {
    code: '404',
    titre: 'Page introuvable',
    texte: 'La page demandée n’existe pas ou a été déplacée. Vérifiez l’adresse saisie ou revenez au tableau de bord.',
  },
  refuse: {
    code: '403',
    titre: 'Accès refusé',
    texte: 'Votre profil ne vous permet pas d’accéder à cette page. Si vous pensez qu’il s’agit d’une erreur, contactez votre administrateur.',
  },
  session: {
    code: '401',
    titre: 'Session expirée',
    texte: 'Pour votre sécurité, votre session a pris fin. Reconnectez-vous pour reprendre là où vous vous étiez arrêté.',
  },
  erreur: {
    code: '500',
    titre: 'Une erreur est survenue',
    texte: 'Un incident inattendu a interrompu l’affichage. Rechargez la page ; si le problème persiste, contactez le support.',
  },
};

/** Page d'erreur à la marque LONACI, même univers visuel que la connexion. */
export default function ErrorPage({ variant, onRetry }: { variant: ErrorVariant; onRetry?: () => void }) {
  const navigate = useNavigate();
  const { code, titre, texte } = CONTENU[variant];
  const secondaire = 'inline-flex items-center gap-2 h-10 px-5 rounded-full border border-white/40 text-[13.5px] font-medium text-white transition-colors hover:bg-white hover:text-success-700';

  return (
    <div className="relative isolate min-h-screen flex flex-col overflow-hidden text-white" style={{ background: 'var(--deep)' }}>
      <DocumentTitle title={titre} />
      <svg className="absolute inset-0 -z-20 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="erDots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" fillOpacity=".09" /></pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#erDots)" />
      </svg>
      <div className="pointer-events-none absolute -top-40 -left-40 -z-10 h-[34rem] w-[34rem] rounded-full bg-success-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-primary-500/15 blur-3xl" />
      <div className="flag-stripe !h-1"><span /><span /><span /></div>

      <header className="px-6 sm:px-10 pt-7">
        <span className="inline-flex rounded-xl bg-white px-4 py-2.5 shadow-lg">
          <img src="/assets/lonaci-logo.png" alt={INSTITUTION.sigle} className="h-8 w-auto" />
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="text-center max-w-[520px]">
          <div className="mx-auto mb-6 flex justify-center"><BrandBadge size={64} /></div>
          <div className="font-display text-[110px] sm:text-[150px] leading-none font-bold tracking-[0.04em] text-transparent bg-clip-text bg-gradient-to-b from-primary-400 to-primary-600 select-none">
            {code}
          </div>
          <h1 className="!text-white !text-[30px] sm:!text-[36px] !font-semibold mt-1 mb-3">{titre}</h1>
          <p className="text-[14.5px] leading-relaxed text-white/70 mb-8">{texte}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {variant === 'session' ? (
              <Link to="/login" className="btn btn-primary !h-10 !px-6"><LogIn className="w-4 h-4" />Se connecter</Link>
            ) : variant === 'erreur' ? (
              <button type="button" onClick={onRetry ?? (() => window.location.reload())} className="btn btn-primary !h-10 !px-6">
                <RefreshCw className="w-4 h-4" />Recharger la page
              </button>
            ) : (
              <>
                <Link to="/" className="btn btn-primary !h-10 !px-6"><LayoutDashboard className="w-4 h-4" />Tableau de bord</Link>
                <button type="button" onClick={() => navigate(-1)} className={secondaire}><ArrowLeft className="w-4 h-4" />Page précédente</button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-[11.5px] text-white/60">
        {INSTITUTION.republique} · {INSTITUTION.devise}
      </footer>
    </div>
  );
}
