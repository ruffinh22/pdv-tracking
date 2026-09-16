import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  AlertTriangle, Calendar, CheckCircle2, Download, FileText, MapPin,
  Navigation, Radio, TrendingUp, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  dashboardService, telechargerBlob,
  LigneDetailReporting, LigneRepartition, Periode
} from '../services/dashboardService';
import { useAuthStore } from '../contexts/authContext';
import { ROLE_DIMENSIONS, Role } from '../config/permissions';

/**
 * Le produit tague et suit des points de vente ; il n'enregistre pas de
 * transactions. Ce reporting mesure donc les quatre seules choses que le
 * système observe vraiment :
 *   1. ENRÔLEMENT  — combien de PDV tagués, par qui, où, à quel rythme
 *   2. QUALITÉ     — part de dossiers complétés depuis le back-office
 *   3. COUVERTURE  — quels terminaux remontent encore du GPS, lesquels sont muets
 *   4. CONFORMITÉ  — sorties de zone (instrus), leur traitement, leur ampleur
 */

type Onglet = 'enrolement' | 'couverture' | 'conformite' | 'repartition';

const PERIODES: { valeur: Periode | 'custom'; libelle: string }[] = [
  { valeur: 'jour', libelle: "Aujourd'hui" },
  { valeur: 'semaine', libelle: '7 derniers jours' },
  { valeur: 'mois', libelle: '30 derniers jours' },
  { valeur: 'all', libelle: 'Depuis le début' },
  { valeur: 'custom', libelle: 'Personnalisé' },
];

const ONGLETS: { id: Onglet; libelle: string; icone: typeof MapPin }[] = [
  { id: 'enrolement', libelle: 'Enrôlement', icone: MapPin },
  { id: 'couverture', libelle: 'Couverture terrain', icone: Radio },
  { id: 'conformite', libelle: 'Conformité', icone: AlertTriangle },
  { id: 'repartition', libelle: 'Répartition', icone: Users },
];

const DIMENSIONS_REPARTITION = [
  { cle: 'ville', libelle: 'Ville' },
  { cle: 'commune', libelle: 'Commune' },
  { cle: 'quartier', libelle: 'Quartier' },
  { cle: 'agence', libelle: 'Agence' },
  { cle: 'commercial', libelle: 'Commercial' },
  { cle: 'superviseur', libelle: 'Superviseur' },
] as const;

type CleRepartition = (typeof DIMENSIONS_REPARTITION)[number]['cle'];

const COULEURS = ['#e06e00', '#009a44', '#3B82F6', '#c98a00', '#d64545', '#8f4500', '#14B8A6', '#6b6b78'];

const LIBELLE_TYPE_ALERTE: Record<string, string> = {
  sortie_zone: 'Sortie de zone',
  entree_zone: 'Retour en zone',
  deplacement_anormal: 'Déplacement anormal',
};

function formatDate(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateHeure(valeur: string | null | undefined): string {
  if (!valeur) return 'Jamais';
  return new Date(valeur).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Carte d'indicateur : un chiffre, son libellé, et la lecture qu'il faut en faire. */
function Indicateur({
  icone: Icone, label, valeur, unite, aide, ton = 'neutre',
}: {
  icone: typeof MapPin;
  label: string;
  valeur: number | string;
  unite?: string;
  aide?: string;
  ton?: 'neutre' | 'succes' | 'alerte' | 'danger';
}) {
  const tons = {
    neutre: { barre: 'bg-primary-500', fond: 'bg-primary-50', texte: 'text-primary-600' },
    succes: { barre: 'bg-success-500', fond: 'bg-success-50', texte: 'text-success-600' },
    alerte: { barre: 'bg-amber-500', fond: 'bg-amber-50', texte: 'text-amber-600' },
    danger: { barre: 'bg-danger-500', fond: 'bg-danger-50', texte: 'text-danger-600' },
  }[ton];

  return (
    <div className="relative flex items-start gap-3 rounded-xl p-3.5 kpi-card">
      <div className={`absolute top-0 left-0 bottom-0 w-[3px] rounded-l-xl ${tons.barre}`} />
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tons.fond}`}>
        <Icone className={`w-4 h-4 ${tons.texte}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-ink-900 leading-none tracking-tight">
          {valeur}
          {unite ? <span className="text-sm font-semibold text-ink-500 ml-0.5">{unite}</span> : null}
        </p>
        <p className="text-xs font-semibold text-ink-700 mt-1">{label}</p>
        {aide ? <p className="text-[11px] text-ink-400 mt-0.5 leading-snug">{aide}</p> : null}
      </div>
    </div>
  );
}

/** Barre de progression simple, pour les taux qui se lisent mieux qu'en chiffre brut. */
function Jauge({ valeur, ton }: { valeur: number; ton: 'succes' | 'alerte' | 'danger' }) {
  const couleur = { succes: 'bg-success-500', alerte: 'bg-amber-500', danger: 'bg-danger-500' }[ton];
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
      <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.min(100, Math.max(0, valeur))}%` }} />
    </div>
  );
}

function Vide({ message }: { message: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-ink-400">{message}</div>;
}

const Reporting = () => {
  const { user } = useAuthStore();
  const role = (user?.role as Role) ?? 'commercial';

  const [periode, setPeriode] = useState<Periode | 'custom'>('mois');
  const [intervalle, setIntervalle] = useState({ debut: '', fin: '' });
  const [onglet, setOnglet] = useState<Onglet>('enrolement');
  const [dimension, setDimension] = useState<CleRepartition>('ville');
  const [filtreDetail, setFiltreDetail] = useState<'tous' | 'brouillon' | 'muet' | 'instru'>('tous');
  const [exportEnCours, setExportEnCours] = useState(false);

  // Dimensions de répartition restreintes au périmètre du rôle : un commercial
  // n'a rien à ventiler "par commercial", il n'y en a qu'un — lui.
  const dimensionsAutorisees = useMemo(
    () => DIMENSIONS_REPARTITION.filter((d) => ROLE_DIMENSIONS[role]?.includes(d.cle as any) ?? true),
    [role]
  );

  // Bornes envoyées au backend. En mode personnalisé tant que les deux dates ne
  // sont pas saisies, on reste sur le dernier mois plutôt que d'envoyer un
  // intervalle à moitié rempli qui renverrait une page vide sans explication.
  const filtre = useMemo(() => {
    if (periode === 'custom') {
      if (intervalle.debut && intervalle.fin) {
        return {
          debut: new Date(`${intervalle.debut}T00:00:00`).toISOString(),
          fin: new Date(`${intervalle.fin}T23:59:59`).toISOString(),
        };
      }
      return { periode: 'mois' as Periode };
    }
    return { periode };
  }, [periode, intervalle]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['reporting', filtre],
    queryFn: () => dashboardService.getReporting(filtre),
    // Sans ça, chaque changement de période vidait l'écran le temps de la
    // requête : toute la page repassait en "Chargement…" puis se reconstruisait,
    // ce qui donnait l'impression d'un rechargement complet.
    placeholderData: keepPreviousData,
  });

  const handleExport = async () => {
    setExportEnCours(true);
    try {
      const blob = await dashboardService.exportExcel(filtre);
      telechargerBlob(blob, `reporting_tracking_pdv_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export Excel généré');
    } catch {
      toast.error("L'export Excel a échoué");
    } finally {
      setExportEnCours(false);
    }
  };

  const courbe = useMemo(
    () =>
      (data?.enrolement.courbe || []).map((point) => ({
        jour: formatDate(point.jour),
        PDV: point.total,
      })),
    [data]
  );

  const repartition: LigneRepartition[] = useMemo(
    () => data?.repartition?.[dimension] || [],
    [data, dimension]
  );

  const statutData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Actifs', value: data.enrolement.actifs },
      { name: 'Inactifs', value: data.enrolement.inactifs },
      { name: 'Suspendus', value: data.enrolement.suspendus },
    ].filter((s) => s.value > 0);
  }, [data]);

  const alertesParType = useMemo(
    () =>
      (data?.conformite.par_type || []).map((ligne) => ({
        type: LIBELLE_TYPE_ALERTE[ligne.label] || ligne.label,
        total: ligne.total,
      })),
    [data]
  );

  const detail: LigneDetailReporting[] = useMemo(() => {
    const lignes = data?.detail || [];
    if (filtreDetail === 'brouillon') return lignes.filter((l) => l.statut_dossier === 'brouillon');
    if (filtreDetail === 'muet') return lignes.filter((l) => l.muet);
    if (filtreDetail === 'instru') return lignes.filter((l) => l.instru);
    return lignes;
  }, [data, filtreDetail]);

  const seuil = data?.seuil_inactivite_heures ?? 48;

  if (isError) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-ink-600">Le reporting n'a pas pu être chargé.</p>
        <button type="button" onClick={() => refetch()} className="btn btn-secondary mt-4 mx-auto">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Reporting</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Enrôlement, couverture terrain et conformité des points de vente tagués
          </p>
        </div>
        <button type="button" onClick={handleExport} disabled={exportEnCours} className="btn btn-primary shrink-0">
          <Download className="w-4 h-4" />
          {exportEnCours ? 'Génération…' : 'Export Excel'}
        </button>
      </div>

      {/* Sélection de période */}
      <div className="card !p-4">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-ink-700">
            <Calendar className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-medium">Période</span>
          </div>

          <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg flex-wrap">
            {PERIODES.map((p) => (
              <button
                key={p.valeur}
                type="button"
                onClick={() => setPeriode(p.valeur)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  periode === p.valeur ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>

          {periode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={intervalle.debut}
                max={intervalle.fin || undefined}
                onChange={(e) => setIntervalle((v) => ({ ...v, debut: e.target.value }))}
                className="input py-1.5"
              />
              <span className="text-ink-400 text-sm">à</span>
              <input
                type="date"
                value={intervalle.fin}
                min={intervalle.debut || undefined}
                onChange={(e) => setIntervalle((v) => ({ ...v, fin: e.target.value }))}
                className="input py-1.5"
              />
            </div>
          )}

          {/* Indicateur discret de rafraîchissement : les chiffres précédents
              restent affichés pendant le chargement, il faut juste signaler
              qu'ils sont en cours de mise à jour. */}
          {isFetching && !isLoading ? (
            <span className="text-xs text-ink-400 ml-auto">Mise à jour…</span>
          ) : null}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="card text-center py-16 text-ink-400 text-sm">Chargement du reporting…</div>
      ) : (
        <>
          {/* Indicateurs de tête — la lecture en 5 secondes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Indicateur
              icone={MapPin}
              label="PDV tagués sur la période"
              valeur={data.enrolement.tagues_periode}
              aide={`${data.enrolement.part_de_la_base}% d'une base de ${data.enrolement.base_totale}`}
            />
            <Indicateur
              icone={CheckCircle2}
              label="Dossiers complétés"
              valeur={data.qualite_dossiers.taux_completion}
              unite="%"
              aide={`${data.qualite_dossiers.brouillons} encore en brouillon`}
              ton={data.qualite_dossiers.taux_completion >= 80 ? 'succes' : 'alerte'}
            />
            <Indicateur
              icone={Radio}
              label="Couverture terrain"
              valeur={data.activite_terrain.taux_couverture}
              unite="%"
              aide={`${data.activite_terrain.pdv_muets} terminaux muets depuis ${seuil}h`}
              ton={data.activite_terrain.taux_couverture >= 80 ? 'succes' : 'danger'}
            />
            <Indicateur
              icone={AlertTriangle}
              label="PDV sortis de leur zone"
              valeur={data.conformite.pdv_concernes}
              aide={`${data.conformite.non_traitees} alerte(s) non traitée(s)`}
              ton={data.conformite.pdv_concernes > 0 ? 'danger' : 'succes'}
            />
          </div>

          {/* Onglets d'analyse */}
          <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg w-fit flex-wrap">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  onglet === o.id ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <o.icone className="w-4 h-4" />
                {o.libelle}
              </button>
            ))}
          </div>

          {/* ---------------- ENRÔLEMENT ---------------- */}
          {onglet === 'enrolement' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="panel-pro lg:col-span-2">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">Rythme de tagging</h2>
                  <span className="text-xs text-ink-400">Nombre de PDV enrôlés par jour</span>
                </div>
                <div className="h-72 p-4">
                  {courbe.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={courbe}>
                        <defs>
                          <linearGradient id="gradTagging" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e06e00" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#e06e00" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                        <XAxis dataKey="jour" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="PDV" stroke="#e06e00" strokeWidth={2} fill="url(#gradTagging)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Vide message="Aucun PDV tagué sur cette période" />
                  )}
                </div>
              </div>

              <div className="panel-pro">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">Statut des PDV</h2>
                </div>
                <div className="h-72 p-4">
                  {statutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {statutData.map((_, i) => (
                            <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Vide message="Aucune donnée" />
                  )}
                </div>
              </div>

              <div className="card lg:col-span-3">
                <h3 className="text-sm font-semibold text-ink-800 mb-3">Qualité des dossiers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <div className="flex justify-between text-xs text-ink-600 mb-1.5">
                      <span>Dossiers complets</span>
                      <span className="font-semibold">
                        {data.qualite_dossiers.complets} / {data.enrolement.tagues_periode}
                      </span>
                    </div>
                    <Jauge
                      valeur={data.qualite_dossiers.taux_completion}
                      ton={data.qualite_dossiers.taux_completion >= 80 ? 'succes' : 'alerte'}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-ink-600 mb-1.5">
                      <span>PDV actifs</span>
                      <span className="font-semibold">
                        {data.enrolement.actifs} / {data.enrolement.tagues_periode}
                      </span>
                    </div>
                    <Jauge
                      valeur={
                        data.enrolement.tagues_periode
                          ? (data.enrolement.actifs / data.enrolement.tagues_periode) * 100
                          : 0
                      }
                      ton="succes"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-ink-600 mb-1.5">
                      <span>Part de la base totale</span>
                      <span className="font-semibold">{data.enrolement.part_de_la_base}%</span>
                    </div>
                    <Jauge valeur={data.enrolement.part_de_la_base} ton="succes" />
                  </div>
                </div>
                <p className="text-[11px] text-ink-400 mt-4 leading-relaxed">
                  Un dossier reste en brouillon tant qu'il n'a été complété que par l'application mobile
                  (terminal + position GPS). C'est le back-office qui renseigne ensuite l'identité, la
                  hiérarchie commerciale et la localisation administrative.
                </p>
              </div>
            </div>
          )}

          {/* ---------------- COUVERTURE TERRAIN ---------------- */}
          {onglet === 'couverture' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Indicateur
                  icone={Navigation}
                  label="Positions remontées"
                  valeur={data.activite_terrain.positions_remontees.toLocaleString('fr-FR')}
                  aide="Points GPS reçus sur la période"
                />
                <Indicateur
                  icone={Radio}
                  label="Terminaux vus (24 h)"
                  valeur={data.activite_terrain.pdv_vus_24h}
                  ton="succes"
                  aide="Ont remonté une position récente"
                />
                <Indicateur
                  icone={AlertTriangle}
                  label={`Muets depuis ${seuil} h`}
                  valeur={data.activite_terrain.pdv_muets}
                  ton={data.activite_terrain.pdv_muets > 0 ? 'danger' : 'succes'}
                  aide="Terminal éteint, désinstallé ou hors réseau"
                />
                <Indicateur
                  icone={TrendingUp}
                  label="Jamais localisés"
                  valeur={data.activite_terrain.jamais_vus}
                  ton={data.activite_terrain.jamais_vus > 0 ? 'alerte' : 'succes'}
                  aide="Enrôlés sans aucune remontée GPS ensuite"
                />
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold text-ink-800 mb-1">Comment lire ces chiffres</h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                  La couverture terrain est le rapport entre les terminaux qui remontent encore des
                  positions et l'ensemble de la cohorte taguée. Un taux qui baisse sans que la base
                  diminue signale des terminaux éteints ou l'app désinstallée, pas une baisse
                  d'activité commerciale. Les « jamais localisés » sont à traiter en priorité : ils
                  indiquent un enrôlement qui n'a jamais réellement démarré.
                </p>
              </div>

              <div className="panel-pro">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">PDV sans remontée récente</h2>
                  <span className="text-xs text-ink-400">
                    {detail.filter((l) => l.muet).length} terminal(aux) concerné(s)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>PDV</th>
                        <th>ID terminal</th>
                        <th>Localisation</th>
                        <th>Commercial</th>
                        <th>Tagué le</th>
                        <th>Dernière position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.filter((l) => l.muet).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-ink-400">
                            Tous les terminaux ont remonté une position récemment.
                          </td>
                        </tr>
                      ) : (
                        detail
                          .filter((l) => l.muet)
                          .slice(0, 100)
                          .map((ligne) => (
                            <tr key={ligne.id}>
                              <td className="font-medium text-ink-900">{ligne.nom_pdv}</td>
                              <td className="text-ink-500">{ligne.id_terminal || '—'}</td>
                              <td>{[ligne.quartier, ligne.commune, ligne.ville].filter(Boolean).join(', ') || '—'}</td>
                              <td>{ligne.commercial || '—'}</td>
                              <td>{formatDate(ligne.date_tagging)}</td>
                              <td>
                                <span className="badge badge-danger">
                                  {formatDateHeure(ligne.derniere_position_date)}
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- CONFORMITÉ ---------------- */}
          {onglet === 'conformite' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Indicateur
                  icone={AlertTriangle}
                  label="Alertes déclenchées"
                  valeur={data.conformite.total_alertes}
                  aide={`dont ${data.conformite.instrus} sorties de zone`}
                  ton={data.conformite.total_alertes > 0 ? 'alerte' : 'succes'}
                />
                <Indicateur
                  icone={MapPin}
                  label="PDV concernés"
                  valeur={data.conformite.pdv_concernes}
                  unite={data.conformite.taux_instrus ? ` (${data.conformite.taux_instrus}%)` : undefined}
                  aide="Ont quitté leur zone au moins une fois"
                  ton={data.conformite.pdv_concernes > 0 ? 'danger' : 'succes'}
                />
                <Indicateur
                  icone={Navigation}
                  label="Écart moyen"
                  valeur={data.conformite.distance_moyenne_m}
                  unite=" m"
                  aide={`Maximum observé : ${data.conformite.distance_max_m} m`}
                />
                <Indicateur
                  icone={CheckCircle2}
                  label="Alertes traitées"
                  valeur={
                    data.conformite.total_alertes
                      ? Math.round((data.conformite.traitees / data.conformite.total_alertes) * 100)
                      : 100
                  }
                  unite="%"
                  aide={`${data.conformite.non_traitees} en attente, ${data.conformite.en_cours} en cours`}
                  ton={data.conformite.non_traitees === 0 ? 'succes' : 'alerte'}
                />
              </div>

              <div className="panel-pro">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">Alertes par type</h2>
                </div>
                <div className="h-64 p-4">
                  {alertesParType.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertesParType} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={140} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#d64545" radius={[0, 4, 4, 0]} name="Alertes" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Vide message="Aucune alerte sur cette période" />
                  )}
                </div>
              </div>

              <div className="panel-pro">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">PDV sortis de leur zone (instrus)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>PDV</th>
                        <th>ID terminal</th>
                        <th>Localisation</th>
                        <th>Commercial</th>
                        <th>Dossier</th>
                        <th>Tagué le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.filter((l) => l.instru).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-ink-400">
                            Aucun PDV n'a quitté sa zone sur cette période.
                          </td>
                        </tr>
                      ) : (
                        detail
                          .filter((l) => l.instru)
                          .map((ligne) => (
                            <tr key={ligne.id}>
                              <td className="font-medium text-ink-900">{ligne.nom_pdv}</td>
                              <td className="text-ink-500">{ligne.id_terminal || '—'}</td>
                              <td>{[ligne.quartier, ligne.commune, ligne.ville].filter(Boolean).join(', ') || '—'}</td>
                              <td>{ligne.commercial || '—'}</td>
                              <td>
                                <span className={`badge ${ligne.statut_dossier === 'complet' ? 'badge-success' : 'badge-warning'}`}>
                                  {ligne.statut_dossier}
                                </span>
                              </td>
                              <td>{formatDate(ligne.date_tagging)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- RÉPARTITION ---------------- */}
          {onglet === 'repartition' && (
            <div className="space-y-4">
              <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg w-fit flex-wrap">
                {dimensionsAutorisees.map((d) => (
                  <button
                    key={d.cle}
                    type="button"
                    onClick={() => setDimension(d.cle)}
                    className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      dimension === d.cle ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {d.libelle}
                  </button>
                ))}
              </div>

              <div className="panel-pro">
                <div className="panel-pro-head">
                  <h2 className="text-base font-semibold text-ink-900">
                    PDV tagués par {DIMENSIONS_REPARTITION.find((d) => d.cle === dimension)?.libelle.toLowerCase()}
                  </h2>
                  <span className="text-xs text-ink-400">Top 12</span>
                </div>
                <div className="h-80 p-4">
                  {repartition.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={repartition} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="total" name="PDV tagués" radius={[4, 4, 0, 0]}>
                          {repartition.map((_, i) => (
                            <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Vide message="Aucune donnée pour cette dimension" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- DÉTAIL ---------------- */}
          <div className="panel-pro">
            <div className="panel-pro-head flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-ink-400" />
                <h2 className="text-base font-semibold text-ink-900">Détail des PDV tagués</h2>
              </div>
              <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg">
                {(
                  [
                    { cle: 'tous', libelle: 'Tous' },
                    { cle: 'brouillon', libelle: 'Brouillons' },
                    { cle: 'muet', libelle: 'Muets' },
                    { cle: 'instru', libelle: 'Instrus' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.cle}
                    type="button"
                    onClick={() => setFiltreDetail(f.cle)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      filtreDetail === f.cle ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {f.libelle}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>PDV</th>
                    <th>ID terminal</th>
                    <th>Ville</th>
                    <th>Commune</th>
                    <th>Quartier</th>
                    <th>Agence</th>
                    <th>Commercial</th>
                    <th>Tagué le</th>
                    <th>Dossier</th>
                    <th>Suivi GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-ink-400">
                        Aucun PDV ne correspond à ce filtre sur la période sélectionnée.
                      </td>
                    </tr>
                  ) : (
                    detail.slice(0, 200).map((ligne) => (
                      <tr key={ligne.id}>
                        <td className="font-medium text-ink-900">{ligne.nom_pdv}</td>
                        <td className="text-ink-500">{ligne.id_terminal || '—'}</td>
                        <td>{ligne.ville || '—'}</td>
                        <td>{ligne.commune || '—'}</td>
                        <td>{ligne.quartier || '—'}</td>
                        <td>{ligne.agence || '—'}</td>
                        <td>{ligne.commercial || '—'}</td>
                        <td>{formatDate(ligne.date_tagging)}</td>
                        <td>
                          <span className={`badge ${ligne.statut_dossier === 'complet' ? 'badge-success' : 'badge-warning'}`}>
                            {ligne.statut_dossier}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${ligne.muet ? 'badge-danger' : 'badge-success'}`}>
                            {ligne.muet ? 'Muet' : 'Actif'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {(data.detail_tronque || detail.length > 200) && (
              <p className="px-6 py-3 text-xs text-ink-400 border-t border-ink-100">
                Aperçu limité aux 200 premières lignes. L'export Excel contient la totalité de la période.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reporting;
