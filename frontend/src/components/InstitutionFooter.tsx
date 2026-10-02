import { INSTITUTION } from '../config/institution';

/** Pied de page officiel : identité, devise, mention de confidentialité. */
export default function InstitutionFooter() {
  const annee = new Date().getFullYear();
  return (
    <footer className="mt-10 border-t border-ink-200 bg-white print:hidden">
      <div className="flag-stripe"><span /><span /><span /></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center text-[12px]">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/assets/lonaci-logo.png" alt="" className="h-5 w-auto shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="font-extrabold text-ink-900 truncate">{INSTITUTION.nom}</p>
            <p className="font-medium text-ink-500 truncate">{INSTITUTION.systeme}</p>
          </div>
        </div>

        <div className="text-center leading-tight">
          {INSTITUTION.republique ? (
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink-500">{INSTITUTION.republique}</p>
          ) : null}
          <p className="font-display font-extrabold text-[13px] text-success-700 mt-0.5">{INSTITUTION.devise}</p>
        </div>

        <div className="md:text-right text-ink-500 font-medium leading-snug">
          <p>{INSTITUTION.mention}</p>
          <p className="mt-0.5 font-semibold">
            © {annee} {INSTITUTION.sigle} · {INSTITUTION.version}
          </p>
        </div>
      </div>
    </footer>
  );
}
