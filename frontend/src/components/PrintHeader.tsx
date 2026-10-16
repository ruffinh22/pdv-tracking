import { INSTITUTION } from '../config/institution';

interface Props {
  titre: string;
  auteur?: string;
}

/** En-tête officiel visible uniquement à l'impression / export PDF. */
export default function PrintHeader({ titre, auteur }: Props) {
  const maintenant = new Date();
  return (
    <div className="print-only print-official">
      <div className="po-flag"><span /><span /><span /></div>
      <div className="po-row">
        <img src="/assets/lonaci-logo.png" alt={INSTITUTION.sigle} />
        <div className="po-center">
          <strong>{INSTITUTION.republique}</strong>
          <span>{INSTITUTION.devise}</span>
        </div>
        <div className="po-right">
          <strong>{INSTITUTION.nom}</strong>
          <span>{INSTITUTION.systeme}</span>
        </div>
      </div>
      <div className="po-title">
        <h1>{titre}</h1>
        <span>
          Édité le {maintenant.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à{' '}
          {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {auteur ? ` · par ${auteur}` : ''}
        </span>
      </div>
    </div>
  );
}

/** Zone de signature en bas du document imprimé. */
export function PrintSignature() {
  return (
    <div className="print-only print-signature">
      <div><span>Établi par</span></div>
      <div><span>Visa du responsable</span></div>
      <div><span>Cachet</span></div>
    </div>
  );
}
