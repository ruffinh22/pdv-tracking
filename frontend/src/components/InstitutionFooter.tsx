import { INSTITUTION } from '../config/institution';

/** Pied de page : bandeau vert-noir, filet orange, identité LONACI (même structure que Boussole). */
export default function InstitutionFooter() {
  const annee = new Date().getFullYear();
  return (
    <footer className="pf print:hidden" style={{ background: 'var(--deep)', borderTop: '2px solid var(--accent)' }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-[11px] text-white/70">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 flex items-center">
            <img src="/assets/lonaci-logo.png" alt={INSTITUTION.sigle} className="h-[18px] w-auto" />
          </span>
          <span className="leading-tight min-w-0 truncate">
            {INSTITUTION.systeme}
            {INSTITUTION.republique ? (
              <span className="hidden md:inline text-white/45"> · {INSTITUTION.republique} · {INSTITUTION.devise}</span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-4 text-white/55">
          <span className="hidden lg:inline">{INSTITUTION.mention}</span>
          <span>
            © {annee} <b className="font-medium text-white">{INSTITUTION.sigle}</b>
          </span>
          <span className="flex items-center gap-2">
            <i className="w-[7px] h-[7px] rounded-full bg-[#4ade80] shadow-[0_0_0_3px_rgba(74,222,128,.18)]" />
            Tracking PDV · {INSTITUTION.version}
          </span>
        </div>
      </div>
    </footer>
  );
}
