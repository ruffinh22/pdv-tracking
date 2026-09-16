import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  MapPin,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Save,
  Route,
  Radio,
  Crosshair,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pdvService, estNomProvisoire } from '../services/pdvService';
import { PdvAttributValorise } from '../services/pdvAttributService';
import { pdvChampFixeService, PdvChampFixe } from '../services/pdvChampFixeService';
import { agenceService } from '../services/agenceService';
import { userService } from '../services/userService';
import { produitService } from '../services/produitService';
import PDVTrackingMap from '../components/PDVTrackingMap';

/** Champs fixes de la fiche, ceux que le serveur exige pour valider le dossier. */
interface FicheState {
  nom_pdv: string;
  msisdn_responsable: string;
  vendeur_nom: string;
  contact_vendeur: string;
  concessionnaire_nom: string;
  pays: string;
  ville: string;
  commune: string;
  quartier: string;
  agence_id: number | '';
  superviseur_id: number | '';
  chef_zone_id: number | '';
  // Champs du mapping standard partenaire (Template_mapping.xlsx)
  type_terminal: string;
  sous_zone: string;
  id_distributeur: string;
  statut: 'actif' | 'inactif' | 'suspendu';
}

const FICHE_VIDE: FicheState = {
  nom_pdv: '',
  msisdn_responsable: '',
  vendeur_nom: '',
  contact_vendeur: '',
  concessionnaire_nom: '',
  pays: '',
  ville: '',
  commune: '',
  quartier: '',
  agence_id: '',
  superviseur_id: '',
  chef_zone_id: '',
  type_terminal: '',
  sous_zone: '',
  id_distributeur: '',
  statut: 'actif',
};

type ValeurAttribut = string | number | boolean | string[] | null;

/**
 * Rend un champ personnalisé à partir de sa définition. Les types sont ceux
 * que l'administrateur peut choisir dans la page "Attributs PDV" : ajouter un
 * type là-bas revient à ajouter un cas ici.
 */
function ChampDynamique({
  attribut,
  valeur,
  onChange,
}: {
  attribut: PdvAttributValorise;
  valeur: ValeurAttribut;
  onChange: (v: ValeurAttribut) => void;
}) {
  const commun = { id: `attr-${attribut.code}`, className: 'input' };

  switch (attribut.type) {
    case 'texte_long':
      return (
        <textarea
          {...commun}
          rows={3}
          value={(valeur as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'nombre':
      return (
        <input
          {...commun}
          type="number"
          value={valeur === null || valeur === undefined ? '' : String(valeur)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );

    case 'booleen':
      return (
        <label className="flex items-center gap-2 h-[38px] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={valeur === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-primary-600"
          />
          <span className="text-sm text-ink-600">{valeur === true ? 'Oui' : 'Non'}</span>
        </label>
      );

    case 'date':
      return (
        <input
          {...commun}
          type="date"
          value={(valeur as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'liste':
      return (
        <select {...commun} value={(valeur as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {(attribut.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'liste_multiple': {
      // Cases à cocher plutôt qu'un <select multiple> : sur un formulaire long
      // rempli au clavier et à la souris, la sélection multiple native est une
      // source classique de valeurs perdues (un clic efface tout le reste).
      const selection = Array.isArray(valeur) ? valeur : [];
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {(attribut.options || []).map((opt) => {
            const actif = selection.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() =>
                  onChange(actif ? selection.filter((v) => v !== opt) : [...selection, opt])
                }
                className={
                  actif
                    ? 'chip !bg-primary-50 !text-primary-700 !border-primary-200'
                    : 'chip'
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case 'telephone':
      return (
        <input
          {...commun}
          type="tel"
          value={(valeur as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'email':
      return (
        <input
          {...commun}
          type="email"
          value={(valeur as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <input
          {...commun}
          type="text"
          value={(valeur as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

const PDVDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const pdvId = Number(id);

  const [fiche, setFiche] = useState<FicheState>(FICHE_VIDE);
  const [attributs, setAttributs] = useState<Record<string, ValeurAttribut>>({});
  const [produitsIds, setProduitsIds] = useState<number[]>([]);
  const [periodeHeures, setPeriodeHeures] = useState<24 | 168 | 720>(24);
  const [positionLive, setPositionLive] = useState<{
    latitude: number;
    longitude: number;
    horodatage: string;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const { data: pdv, isLoading, error } = useQuery({
    queryKey: ['pdv', pdvId],
    queryFn: () => pdvService.getPDVById(pdvId),
    enabled: Number.isFinite(pdvId),
    // Le dossier est relu à chaque ouverture : il porte aussi les attributs
    // personnalisés (définitions + valeurs). Si l'admin vient d'ajouter ou de
    // retirer un champ, l'agent doit le voir sans recharger son onglet.
    staleTime: 0,
    refetchOnMount: 'always',
    // Un 403 (hors périmètre) et un 404 (inexistant) sont des réponses
    // définitives : les réessayer ne fait que multiplier les appels inutiles
    // et retarder l'affichage du message à l'utilisateur.
    retry: (nombreEchecs, err: any) => {
      const code = err?.response?.status;
      if (code === 403 || code === 404 || code === 401) return false;
      return nombreEchecs < 1;
    },
  });

  const codeErreur = (error as any)?.response?.status;
  // Les requêtes de suivi visent le même PDV : inutile de les lancer si la
  // fiche elle-même est hors périmètre — elles renverraient trois 403 de plus.
  const accesAutorise = !codeErreur;

  const { data: agences = [] } = useQuery({
    queryKey: ['agences-list'],
    queryFn: agenceService.getAllAgencesList,
  });
  const { data: superviseurs = [] } = useQuery({
    queryKey: ['users-list', 'superviseur'],
    queryFn: () => userService.getUsersByRole('superviseur'),
  });
  const { data: chefsZone = [] } = useQuery({
    queryKey: ['users-list', 'chef_zone'],
    queryFn: () => userService.getUsersByRole('chef_zone'),
  });
  const { data: produits = [] } = useQuery({
    queryKey: ['produits-list-full'],
    queryFn: produitService.getAllProduitsFull,
  });

  // Réglage admin de visibilité / obligation des champs fixes (Paramètres >
  // Champs PDV). En attendant le chargement, on affiche tout comme avant —
  // repli permissif plutôt que de faire disparaître des champs le temps d'un
  // aller-retour réseau.
  const { data: champsFixes = [] } = useQuery({
    queryKey: ['pdv-champs-fixes'],
    queryFn: pdvChampFixeService.getAll,
    // Le `staleTime` global de 5 minutes s'appliquait aussi à ce réglage : un
    // champ masqué ou renommé par l'admin restait invisible pour l'agent tant
    // que son onglet n'avait pas été rechargé. La configuration du formulaire
    // est relue à chaque ouverture d'un dossier — c'est un appel léger, et
    // c'est ce qui garantit que l'agent remplit bien le formulaire courant.
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const champsFixesParCode = useMemo(
    () => new Map(champsFixes.map((c) => [c.code, c] as [string, PdvChampFixe])),
    [champsFixes]
  );
  const champVisible = (code: string) => champsFixesParCode.get(code)?.visible !== false;
  const champObligatoire = (code: string) => champsFixesParCode.get(code)?.obligatoire === true;
  const champLibelle = (code: string, defaut: string) =>
    champsFixesParCode.get(code)?.libelle || defaut;
  const etoile = (code: string) => (champObligatoire(code) ? ' *' : '');

  // Fenêtre de suivi demandée. Calculée une fois par changement de période pour
  // que la clé de requête reste stable — sinon `new Date()` à chaque rendu
  // relancerait la requête en boucle.
  const fenetre = useMemo(() => {
    const fin = new Date();
    const debut = new Date(fin.getTime() - periodeHeures * 60 * 60 * 1000);
    return { debut: debut.toISOString(), fin: fin.toISOString() };
  }, [periodeHeures]);

  const { data: historique } = useQuery({
    queryKey: ['pdv-historique', pdvId, periodeHeures],
    queryFn: () => pdvService.getPDVHistorique(pdvId, { ...fenetre, limit: 1000 }),
    enabled: Number.isFinite(pdvId) && accesAutorise,
    // Le direct passe par le socket ; ce rafraîchissement n'est qu'un filet de
    // sécurité si la connexion temps réel tombe.
    refetchInterval: 120_000,
  });

  const { data: trajet } = useQuery({
    queryKey: ['pdv-trajet', pdvId, periodeHeures],
    queryFn: () => pdvService.getPDVTrajet(pdvId, fenetre),
    enabled: Number.isFinite(pdvId) && accesAutorise,
    refetchInterval: 120_000,
  });

  // Suivi en direct : on ne garde que les positions de CE point de vente, le
  // serveur diffusant l'ensemble des mises à jour à tous les clients.
  useEffect(() => {
    if (!Number.isFinite(pdvId)) return;

    const socket = io(undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('position_update', (data: any) => {
      if (Number(data?.pdv_id) !== pdvId) return;
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
      setPositionLive({
        latitude,
        longitude,
        horodatage: data.horodatage || new Date().toISOString(),
      });
    });

    return () => {
      socket.off('position_update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pdvId]);

  // Initialisation du formulaire depuis la fiche serveur. Le brouillon issu du
  // mobile n'a que le terminal et le GPS : tous les autres champs arrivent
  // vides, c'est normal et c'est précisément ce que l'agent vient remplir.
  useEffect(() => {
    if (!pdv) return;
    setFiche({
      // Le nom provisoire posé à l'enrôlement n'est pas une saisie de l'agent :
      // on présente le champ vide plutôt que de lui faire effacer un libellé
      // technique avant d'écrire la vraie enseigne.
      nom_pdv: estNomProvisoire(pdv.nom_pdv) ? '' : pdv.nom_pdv || '',
      msisdn_responsable: pdv.msisdn_responsable || '',
      vendeur_nom: pdv.vendeur_nom || '',
      contact_vendeur: pdv.contact_vendeur || '',
      concessionnaire_nom: pdv.concessionnaire_nom || '',
      pays: pdv.pays || '',
      ville: pdv.ville || '',
      commune: pdv.commune || '',
      quartier: pdv.quartier || '',
      agence_id: pdv.agence_id ?? '',
      superviseur_id: pdv.superviseur_id ?? '',
      chef_zone_id: pdv.chef_zone_id ?? '',
      type_terminal: pdv.type_terminal || '',
      sous_zone: pdv.sous_zone || '',
      id_distributeur: pdv.id_distributeur || '',
      statut: pdv.statut || 'actif',
    });
    setProduitsIds((pdv.produits || []).map((p) => p.id));
    setAttributs(
      Object.fromEntries((pdv.attributs_personnalises || []).map((a) => [a.code, a.valeur]))
    );
  }, [pdv]);

  const mutation = useMutation({
    mutationFn: (payload: any) => pdvService.completerPDV(pdvId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pdv', pdvId] });
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      if (data.statut_dossier === 'complet') {
        toast.success('Dossier complété et validé');
      } else {
        toast.success('Brouillon enregistré — il reste des informations à renseigner');
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  // Reprise du géocodage inverse. Le remplissage automatique a lieu à
  // l'enrôlement, mais il dépend d'un service externe : quand il a échoué sur
  // le terrain, l'agent relance le calcul ici au lieu de ressaisir à la main
  // une adresse que les coordonnées GPS suffisent à déterminer.
  const geocodage = useMutation({
    mutationFn: () => pdvService.regeocoderPDV(pdvId),
    onSuccess: (data) => {
      if (!data.champs_remplis || data.champs_remplis.length === 0) {
        toast('Ces coordonnées ne permettent pas d\'en déduire plus. Complétez à la main.', {
          icon: 'ℹ️',
        });
        return;
      }
      setFiche((f) => ({
        ...f,
        pays: data.pays || f.pays,
        ville: data.ville || f.ville,
        commune: data.commune || f.commune,
        quartier: data.quartier || f.quartier,
      }));
      queryClient.invalidateQueries({ queryKey: ['pdv', pdvId] });
      toast.success(`Rempli depuis le GPS : ${data.champs_remplis.join(', ')}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Géocodage impossible pour le moment');
    },
  });

  // Les champs personnalisés sont regroupés par section pour rester lisibles
  // même quand l'admin en a déclaré beaucoup.
  const groupes = useMemo(() => {
    const parGroupe = new Map<string, PdvAttributValorise[]>();
    (pdv?.attributs_personnalises || []).forEach((a) => {
      const liste = parGroupe.get(a.groupe) || [];
      liste.push(a);
      parGroupe.set(a.groupe, liste);
    });
    return Array.from(parGroupe.entries());
  }, [pdv]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...fiche,
      agence_id: fiche.agence_id || null,
      superviseur_id: fiche.superviseur_id || null,
      chef_zone_id: fiche.chef_zone_id || null,
      produits_ids: produitsIds,
      attributs,
    });
  };

  if (isLoading) {
    return (
      <div className="card text-center py-16 text-ink-400">Chargement du dossier…</div>
    );
  }

  if (codeErreur === 403) {
    return (
      <div className="card text-center py-16">
        <p className="text-base font-semibold text-ink-900">Dossier hors de votre périmètre</p>
        <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto">
          Ce point de vente n'est pas rattaché à votre compte. Demandez à votre superviseur de vous
          l'assigner si vous devez le compléter.
        </p>
        <button type="button" onClick={() => navigate('/pdv')} className="btn btn-secondary mt-5 mx-auto">
          Retour à la liste
        </button>
      </div>
    );
  }

  if (!pdv) {
    return (
      <div className="card text-center py-16">
        <p className="text-base font-semibold text-ink-900">Ce dossier est introuvable</p>
        <p className="text-sm text-ink-500 mt-2">
          Il a peut-être été supprimé, ou l'adresse est incorrecte.
        </p>
        <button type="button" onClick={() => navigate('/pdv')} className="btn btn-secondary mt-5 mx-auto">
          Retour à la liste
        </button>
      </div>
    );
  }

  const manquants = pdv.informations_manquantes || [];
  const estBrouillon = pdv.statut_dossier === 'brouillon';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink-900">
            {estNomProvisoire(pdv.nom_pdv) ? 'Dossier à compléter' : pdv.nom_pdv}
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Dossier point de vente #{pdv.id}
          </p>
        </div>
        <span className={estBrouillon ? 'badge badge-warning' : 'badge badge-success'}>
          {estBrouillon ? 'Brouillon' : 'Dossier complet'}
        </span>
      </div>

      {/* Ce que le terminal a remonté du terrain : non modifiable ici, c'est la
          trace de l'enrôlement. */}
      <div className="card">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
          Relevé du terrain
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-ink-400 text-xs mb-1">ID unique</div>
            <div className="font-medium text-ink-900">{pdv.id_unique || '—'}</div>
            <div className="text-xs text-ink-400">Référence pour les échanges externes</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-ink-400 text-xs mb-1">
              <Smartphone className="w-3.5 h-3.5" /> ID terminal
            </div>
            <div className="font-medium text-ink-900 break-all">{pdv.id_terminal || '—'}</div>
            <div className="text-xs text-ink-400">{pdv.type_terminal || 'Type non renseigné'}</div>
          </div>
          <div>
            <div className="text-ink-400 text-xs mb-1">Matricule agent</div>
            <div className="font-medium text-ink-900">{pdv.matricule_agent || '—'}</div>
            <div className="text-xs text-ink-400">
              {pdv.commercial ? `${pdv.commercial.prenom} ${pdv.commercial.nom}` : ''}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-ink-400 text-xs mb-1">
              <MapPin className="w-3.5 h-3.5" /> Coordonnées GPS
            </div>
            <div className="font-medium text-ink-900">
              {Number(pdv.latitude_creation).toFixed(6)}, {Number(pdv.longitude_creation).toFixed(6)}
            </div>
            <div className="text-xs text-ink-400">
              Installé le {new Date(pdv.date_installation_app).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      </div>


      {/* Suivi du terminal sur la carte : trajet, éloignement, position en direct */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-ink-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Suivi du terminal
            </h2>
            {positionLive ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-success-600 font-medium">
                <Radio className="w-3 h-3" /> En direct
              </span>
            ) : null}
          </div>

          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            {([
              { valeur: 24, libelle: '24 h' },
              { valeur: 168, libelle: '7 jours' },
              { valeur: 720, libelle: '30 jours' },
            ] as const).map((p) => (
              <button
                key={p.valeur}
                type="button"
                onClick={() => setPeriodeHeures(p.valeur)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodeHeures === p.valeur
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-ink-500 hover:bg-ink-50'
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </div>

        <PDVTrackingMap
          ancrage={{
            latitude: Number(pdv.latitude_creation),
            longitude: Number(pdv.longitude_creation),
          }}
          positions={historique?.data || []}
          positionLive={positionLive}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
          <div>
            <div className="text-xs text-ink-400 mb-0.5">Points relevés</div>
            <div className="font-semibold text-ink-900">{trajet?.points ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-ink-400 mb-0.5">Distance parcourue</div>
            <div className="font-semibold text-ink-900">
              {trajet ? `${(trajet.distance_parcourue_m / 1000).toFixed(2)} km` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-400 mb-0.5">Éloignement maximal</div>
            <div
              className={`font-semibold ${
                trajet && trajet.eloignement_max_m > 500 ? 'text-danger-600' : 'text-ink-900'
              }`}
            >
              {trajet ? `${trajet.eloignement_max_m} m` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-400 mb-0.5">Dernier relevé</div>
            <div className="font-semibold text-ink-900">
              {positionLive
                ? new Date(positionLive.horodatage).toLocaleString('fr-FR')
                : trajet?.derniere_position
                ? new Date(trajet.derniere_position).toLocaleString('fr-FR')
                : 'Aucun'}
            </div>
          </div>
        </div>

        {historique && historique.echantillonnage > 1 ? (
          <p className="text-xs text-ink-400 mt-3">
            {historique.total} points sur la période — un point sur {historique.echantillonnage} est
            affiché pour garder la carte lisible. Le tracé et la dernière position restent exacts.
          </p>
        ) : null}

        {trajet && trajet.points === 0 ? (
          <p className="text-xs text-ink-400 mt-3">
            Aucune position remontée sur cette période. Le terminal est peut-être éteint, hors
            réseau, ou le suivi en arrière-plan n'a pas été autorisé sur l'appareil.
          </p>
        ) : null}
      </div>

      {manquants.length > 0 ? (
        <div className="card !bg-warning-50 !border-warning-200">
          <div className="flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Informations encore requises pour valider ce dossier
              </p>
              <p className="text-xs text-ink-600 mt-1">{manquants.join(' · ')}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card !bg-success-50 !border-success-200">
          <div className="flex gap-2.5 items-center">
            <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
            <p className="text-sm text-ink-900">
              Ce dossier est complet
              {pdv.date_completion
                ? ` depuis le ${new Date(pdv.date_completion).toLocaleDateString('fr-FR')}`
                : ''}
              .
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Identité du point de vente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {champVisible('nom_pdv') && (
                <div>
                  <label className="label">{champLibelle('nom_pdv', 'Nom / enseigne du PDV')}{etoile('nom_pdv')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.nom_pdv}
                    onChange={(e) => setFiche({ ...fiche, nom_pdv: e.target.value })}
                  />
                </div>
              )}
              {champVisible('vendeur_nom') && (
                <div>
                  <label className="label">{champLibelle('vendeur_nom', 'Nom et prénom du vendeur')}{etoile('vendeur_nom')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.vendeur_nom}
                    onChange={(e) => setFiche({ ...fiche, vendeur_nom: e.target.value })}
                  />
                </div>
              )}
              {champVisible('contact_vendeur') && (
                <div>
                  <label className="label">{champLibelle('contact_vendeur', 'Contact du vendeur')}{etoile('contact_vendeur')}</label>
                  <input
                    type="tel"
                    className="input"
                    value={fiche.contact_vendeur}
                    onChange={(e) => setFiche({ ...fiche, contact_vendeur: e.target.value })}
                  />
                </div>
              )}
              {champVisible('msisdn_responsable') && (
                <div>
                  <label className="label">{champLibelle('msisdn_responsable', 'MSISDN responsable')}{etoile('msisdn_responsable')}</label>
                  <input
                    type="tel"
                    className="input"
                    value={fiche.msisdn_responsable}
                    onChange={(e) => setFiche({ ...fiche, msisdn_responsable: e.target.value })}
                  />
                </div>
              )}
              {champVisible('concessionnaire_nom') && (
                <div>
                  <label className="label">{champLibelle('concessionnaire_nom', 'Concessionnaire')}{etoile('concessionnaire_nom')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.concessionnaire_nom}
                    onChange={(e) => setFiche({ ...fiche, concessionnaire_nom: e.target.value })}
                  />
                </div>
              )}
              {champVisible('statut') && (
                <div>
                  <label className="label">{champLibelle('statut', 'Statut')}{etoile('statut')}</label>
                  <select
                    className="input"
                    value={fiche.statut}
                    onChange={(e) => setFiche({ ...fiche, statut: e.target.value as any })}
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="suspendu">Suspendu</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Rattachement commercial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {champVisible('agence_id') && (
                <div>
                  <label className="label">{champLibelle('agence_id', 'Agence')}{etoile('agence_id')}</label>
                  <select
                    className="input"
                    value={fiche.agence_id}
                    onChange={(e) =>
                      setFiche({ ...fiche, agence_id: e.target.value ? Number(e.target.value) : '' })
                    }
                  >
                    <option value="">— Sélectionner —</option>
                    {agences.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.nom_agence}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {champVisible('superviseur_id') && (
                <div>
                  <label className="label">{champLibelle('superviseur_id', 'Superviseur')}{etoile('superviseur_id')}</label>
                  <select
                    className="input"
                    value={fiche.superviseur_id}
                    onChange={(e) =>
                      setFiche({
                        ...fiche,
                        superviseur_id: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                  >
                    <option value="">— Sélectionner —</option>
                    {superviseurs.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.prenom} {u.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {champVisible('chef_zone_id') && (
                <div>
                  <label className="label">{champLibelle('chef_zone_id', 'Chef de zone')}{etoile('chef_zone_id')}</label>
                  <select
                    className="input"
                    value={fiche.chef_zone_id}
                    onChange={(e) =>
                      setFiche({ ...fiche, chef_zone_id: e.target.value ? Number(e.target.value) : '' })
                    }
                  >
                    <option value="">— Sélectionner —</option>
                    {chefsZone.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.prenom} {u.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {champVisible('sous_zone') && (
                <div>
                  <label className="label">{champLibelle('sous_zone', 'Sous-zone')}{etoile('sous_zone')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.sous_zone}
                    onChange={(e) => setFiche({ ...fiche, sous_zone: e.target.value })}
                    placeholder="Ex : SOUS_ZONE_1"
                  />
                </div>
              )}
              {champVisible('id_distributeur') && (
                <div>
                  <label className="label">{champLibelle('id_distributeur', 'ID Distributeur')}{etoile('id_distributeur')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.id_distributeur}
                    onChange={(e) => setFiche({ ...fiche, id_distributeur: e.target.value })}
                    placeholder="Ex : 3499"
                  />
                </div>
              )}
              {champVisible('type_terminal') && (
                <div>
                  <label className="label">{champLibelle('type_terminal', 'Type de terminal')}{etoile('type_terminal')}</label>
                  <input
                    type="text"
                    className="input"
                    value={fiche.type_terminal}
                    onChange={(e) => setFiche({ ...fiche, type_terminal: e.target.value })}
                    placeholder="Détecté automatiquement à l'enrôlement"
                  />
                  <p className="text-xs text-ink-400 mt-1">
                    Pré-rempli depuis le téléphone de l'agent ; à corriger si votre agence utilise sa
                    propre nomenclature de terminaux.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3 mb-2.5 flex-wrap">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Localisation administrative
              </h3>
              <button
                type="button"
                onClick={() => geocodage.mutate()}
                disabled={geocodage.isPending}
                className="btn btn-secondary !py-1 !px-2.5 !text-xs"
                title="Déduire pays, ville, commune et quartier des coordonnées relevées à l'installation"
              >
                <Crosshair className="w-3.5 h-3.5 mr-1" />
                {geocodage.isPending ? 'Calcul…' : 'Remplir depuis le GPS'}
              </button>
            </div>
            <p className="text-xs text-ink-400 mb-2.5">
              Pré-remplie automatiquement à partir des coordonnées relevées sur le terrain.
              Si le service de géolocalisation était indisponible au moment de la pose du terminal,
              relancez le calcul — les champs déjà saisis ne sont pas écrasés.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {(['pays', 'ville', 'commune', 'quartier'] as const)
                .filter((champ) => champVisible(champ))
                .map((champ) => (
                  <div key={champ}>
                    <label className="label">
                      {champLibelle(
                        champ,
                        champ.charAt(0).toUpperCase() + champ.slice(1)
                      )}
                      {etoile(champ)}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={fiche[champ]}
                      onChange={(e) => setFiche({ ...fiche, [champ]: e.target.value })}
                    />
                  </div>
                ))}
            </div>
          </div>

          {champVisible('produits') && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              {champLibelle('produits', 'Produits vendus')}{etoile('produits')}
            </h3>
            <p className="text-xs text-ink-400 mb-2.5">
              {champObligatoire('produits')
                ? "Au moins un produit est requis : c'est la colonne « Produit_vendu » du mapping standard. Seule la gamme est demandée ici, jamais les prix."
                : "Seule la gamme est demandée ici, jamais les prix."}
            </p>
            <div className="flex flex-wrap gap-2">
              {produits.map((p: any) => {
                const actif = produitsIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      // Debug: vérifier que le handler est appelé et quel id est cliqué
                      // eslint-disable-next-line no-console
                      console.log('[PDVDetail] toggle produit click:', p.id);
                      setProduitsIds((prev: number[]) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                      );
                    }}
                    className={actif ? 'chip chip--active' : 'chip'}
                  >
                    {p.nom_produit}
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Champs pilotés par l'admin depuis Paramètres > Attributs PDV */}
        {groupes.map(([groupe, champs]) => (
          <div className="card" key={groupe}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              {groupe}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {champs.map((attribut) => (
                <div key={attribut.code} className={attribut.type === 'texte_long' ? 'sm:col-span-2' : ''}>
                  <label className="label" htmlFor={`attr-${attribut.code}`}>
                    {attribut.libelle}
                    {attribut.obligatoire ? ' *' : ''}
                  </label>
                  <ChampDynamique
                    attribut={attribut}
                    valeur={attributs[attribut.code] ?? null}
                    onChange={(v) => setAttributs({ ...attributs, [attribut.code]: v })}
                  />
                  {attribut.aide ? (
                    <p className="text-xs text-ink-400 mt-1">{attribut.aide}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-end gap-3">
          <p className="text-xs text-ink-400 mr-auto">
            Les champs marqués d'une étoile sont obligatoires (réglable dans Paramètres &gt; Champs PDV). Un dossier incomplet
            s'enregistre quand même et reste en brouillon : rien n'est perdu.
          </p>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer le dossier'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PDVDetail;
