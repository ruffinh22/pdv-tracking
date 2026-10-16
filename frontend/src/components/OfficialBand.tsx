import { INSTITUTION } from '../config/institution';

/** Bandeau officiel : liseré tricolore (orange · blanc · vert), République et devise. */
export default function OfficialBand() {
  return (
    <div className="official-band print:hidden hidden sm:block" style={{ background: 'var(--deep)' }}>
      <div className="flag-stripe !h-[3px]"><span /><span /><span /></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-7 flex items-center justify-between gap-4 text-[10.5px] uppercase tracking-[0.14em] text-white/70">
        <span className="font-medium text-white/85 truncate">{INSTITUTION.republique}</span>
        <span className="hidden md:inline text-primary-400 font-medium">{INSTITUTION.devise}</span>
        <span className="hidden lg:inline truncate text-white/55">{INSTITUTION.sigle} · {INSTITUTION.nom}</span>
      </div>
    </div>
  );
}
