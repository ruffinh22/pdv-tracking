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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pdvService, PDV } from '../services/pdvService';
import { PdvAttributValorise } from '../services/pdvAttributService';
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

  const { data: pdv, isLoading } = useQuery({
    queryKey: ['pdv', pdvId],
    queryFn: () => pdvService.getPDVById(pdvId),
    enabled: Number.isFinite(pdvId),
  });

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
    enabled: Number.isFinite(pdvId),
    // Le direct passe par le socket ; ce rafraîchissement n'est qu'un filet de
    // sécurité si la connexion temps réel tombe.
    refetchInterval: 120_000,
  });

  const { data: trajet } = useQuery({
    queryKey: ['pdv-trajet', pdvId, periodeHeures],
    queryFn: () => pdvService.getPDVTrajet(pdvId, fenetre),
    enabled: Number.isFinite(pdvId),
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
      nom_pdv: pdv.nom_pdv?.startsWith('PDV (brouillon)') ? '' : pdv.nom_pdv || '',
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

  if (!pdv) {
    return (
      <div className="card text-center py-16 text-ink-400">Ce PDV est introuvable.</div>
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
            {pdv.nom_pdv}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 text-ink-400 text-xs mb-1">
              <Smartphone className="w-3.5 h-3.5" /> ID terminal
            </div>
            <div className="font-medium text-ink-900 break-all">{pdv.id_terminal || '—'}</div>
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
              <div>
                <label className="label">Nom / enseigne du PDV *</label>
                <input
                  type="text"
                  className="input"
                  value={fiche.nom_pdv}
                  onChange={(e) => setFiche({ ...fiche, nom_pdv: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Nom et prénom du vendeur *</label>
                <input
                  type="text"
                  className="input"
                  value={fiche.vendeur_nom}
                  onChange={(e) => setFiche({ ...fiche, vendeur_nom: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Contact du vendeur</label>
                <input
                  type="tel"
                  className="input"
                  value={fiche.contact_vendeur}
                  onChange={(e) => setFiche({ ...fiche, contact_vendeur: e.target.value })}
                />
              </div>
              <div>
                <label className="label">MSISDN responsable</label>
                <input
                  type="tel"
                  className="input"
                  value={fiche.msisdn_responsable}
                  onChange={(e) => setFiche({ ...fiche, msisdn_responsable: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Concessionnaire</label>
                <input
                  type="text"
                  className="input"
                  value={fiche.concessionnaire_nom}
                  onChange={(e) => setFiche({ ...fiche, concessionnaire_nom: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Statut</label>
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
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Rattachement commercial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Agence *</label>
                <select
                  className="input"
                  value={fiche.agence_id}
                  onChange={(e) =>
                    setFiche({ ...fiche, agence_id: e.target.value ? Number(e.target.value) : '' })
                  }
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {agences.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.nom_agence}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Superviseur *</label>
                <select
                  className="input"
                  value={fiche.superviseur_id}
                  onChange={(e) =>
                    setFiche({
                      ...fiche,
                      superviseur_id: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {superviseurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.prenom} {u.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Chef de zone</label>
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
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Localisation administrative
            </h3>
            <p className="text-xs text-ink-400 mb-2.5">
              Pré-remplie par géocodage inverse à partir des coordonnées relevées sur le terrain.
              Corrigez si nécessaire.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {(['pays', 'ville', 'commune', 'quartier'] as const).map((champ) => (
                <div key={champ}>
                  <label className="label capitalize">{champ}</label>
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

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Produits vendus
            </h3>
            <div className="flex flex-wrap gap-2">
              {produits.map((p: any) => {
                const actif = produitsIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setProduitsIds(
                        actif ? produitsIds.filter((x) => x !== p.id) : [...produitsIds, p.id]
                      )
                    }
                    className={actif ? 'chip !bg-primary-50 !text-primary-700 !border-primary-200' : 'chip'}
                  >
                    {p.nom_produit}
                  </button>
                );
              })}
            </div>
          </div>
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
            Un dossier incomplet reste enregistré en brouillon : rien n'est perdu.
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
