import { Building2, ChevronDown, Keyboard, LifeBuoy, Mail, Phone, Clock, ScrollText, Info } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { INSTITUTION } from '../config/institution';

const GUIDE: { q: string; r: string }[] = [
  {
    q: 'Comprendre l’état GPS d’un point de vente',
    r: 'Le tableau de bord distingue quatre états selon la dernière position reçue : « En ligne » (position récente), « Position en retard », « Hors ligne » (aucune position depuis plusieurs heures) et « Jamais connecté ». L’état GPS est indépendant du statut de la fiche (actif, inactif, suspendu).',
  },
  {
    q: 'Rechercher et filtrer des points de vente',
    r: 'Dans « Points de vente », utilisez la barre de recherche (nom, numéro, identifiant terminal), les statuts et le bouton « Filtres » pour affiner par agence, commercial, superviseur, chef de zone ou produit. Vos filtres sont mémorisés pour votre prochaine visite ; « Réinitialiser les filtres » les efface.',
  },
  {
    q: 'Suivre les équipes en temps réel',
    r: 'La page « Tracking » affiche les points de vente sur la carte. Vous pouvez filtrer par statut ou par zone, mettre le suivi en pause, actualiser, ou passer en plein écran.',
  },
  {
    q: 'Traiter une alerte',
    r: 'Les alertes (sortie de zone, déplacement anormal) apparaissent dans la cloche de l’en-tête et dans la page « Alertes ». Ouvrez l’alerte concernée pour la consulter, puis marquez-la comme traitée une fois l’anomalie vérifiée.',
  },
  {
    q: 'Exporter ou imprimer un rapport',
    r: 'Dans « Reporting », le bouton « Export Excel » génère le fichier. Pour un document officiel, ouvrez le menu de votre compte puis « Imprimer cette page » : choisissez « Enregistrer au format PDF ». L’en-tête LONACI, la date d’édition et la zone de signature sont ajoutés automatiquement.',
  },
];

const RACCOURCIS: [string, string][] = [
  ['Ctrl K  /  ⌘ K', 'Ouvrir la recherche rapide'],
  ['↑  ↓', 'Naviguer dans les résultats'],
  ['Entrée', 'Ouvrir le résultat sélectionné'],
  ['Échap', 'Fermer un menu ou une fenêtre'],
];

export default function Help() {
  const { support } = INSTITUTION;
  const aSupport = !!(support.email || support.telephone || support.horaires);
  const titre = 'flex items-center gap-2 font-display text-[0.95rem] font-semibold uppercase tracking-[0.12em] text-success-700 mb-3';

  return (
    <div className="space-y-5">
      <PageHeader title="Aide et informations" subtitle="Guide d’utilisation, raccourcis, assistance et mentions légales" />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="h-guide">
          <h2 id="h-guide" className={titre}><LifeBuoy className="h-4 w-4" />Guide d’utilisation</h2>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {GUIDE.map((g) => (
              <details key={g.q} className="group py-3 first:pt-0 last:pb-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-ink-900 marker:hidden [&::-webkit-details-marker]:hidden">
                  {g.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-success-600 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">{g.r}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="card" aria-labelledby="h-about">
            <h2 id="h-about" className={titre}><Info className="h-4 w-4" />À propos</h2>
            <p className="text-[13.5px] font-semibold text-ink-900">Tracking PDV · {INSTITUTION.version}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{INSTITUTION.systeme} de la {INSTITUTION.nom} ({INSTITUTION.sigle}).</p>
          </section>

          <section className="card" aria-labelledby="h-keys">
            <h2 id="h-keys" className={titre}><Keyboard className="h-4 w-4" />Raccourcis clavier</h2>
            <dl className="space-y-2">
              {RACCOURCIS.map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-3 text-[13px]">
                  <dd className="text-ink-600 order-1">{d}</dd>
                  <dt className="order-2 shrink-0"><kbd className="rounded-md border px-2 py-0.5 font-sans text-[11.5px] font-medium text-ink-700" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }}>{k}</kbd></dt>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card" aria-labelledby="h-support">
          <h2 id="h-support" className={titre}><Building2 className="h-4 w-4" />Assistance</h2>
          {aSupport ? (
            <ul className="space-y-2.5 text-[13.5px] text-ink-700">
              {support.email && <li className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-success-600" /><a className="font-medium text-success-700 hover:underline" href={`mailto:${support.email}`}>{support.email}</a></li>}
              {support.telephone && <li className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-success-600" /><a className="font-medium hover:underline" href={`tel:${support.telephone.replace(/\s/g, '')}`}>{support.telephone}</a></li>}
              {support.horaires && <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-success-600" />{support.horaires}</li>}
            </ul>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-ink-600">Pour toute question ou anomalie, contactez votre administrateur ou le service informatique de la {INSTITUTION.sigle}.</p>
          )}
        </section>

        <section className="card" aria-labelledby="h-legal">
          <h2 id="h-legal" className={titre}><ScrollText className="h-4 w-4" />Mentions légales et confidentialité</h2>
          <p className="text-[13px] leading-relaxed text-ink-600">
            Ce service est exploité par la {INSTITUTION.nom} ({INSTITUTION.sigle}). {INSTITUTION.mention} Toute consultation, extraction ou diffusion non autorisée des informations qu’il contient est interdite. Les identifiants de connexion sont personnels et ne doivent pas être partagés ; en cas de doute sur la sécurité de votre compte, signalez-le sans délai à votre administrateur.
          </p>
        </section>
      </div>
    </div>
  );
}
