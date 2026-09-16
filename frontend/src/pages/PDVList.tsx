import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, MapPin, Phone, Search, X, ChevronDown, Tag, Filter, FileEdit, Download } from 'lucide-react';
import { pdvService, PDV } from '../services/pdvService';
import { agenceService } from '../services/agenceService';
import { userService } from '../services/userService';
import { produitService } from '../services/produitService';
import { pdvChampFixeService, PdvChampFixe } from '../services/pdvChampFixeService';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { useAuthStore } from '../contexts/authContext';

const STATUS_BADGE: Record<string, string> = {
  actif: 'badge badge-success',
  inactif: 'badge badge-neutral',
  suspendu: 'badge badge-danger',
};

interface FormState {
  id_terminal: string;
  nom_pdv: string;
  msisdn_responsable: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: 'actif' | 'inactif' | 'suspendu';
  concessionnaire_nom: string;
  vendeur_nom: string;
  contact_vendeur: string;
  pays: string;
  ville: string;
  commune: string;
  quartier: string;
  agence_id: number | '';
  commercial_id: number | '';
  superviseur_id: number | '';
  chef_zone_id: number | '';
  produits_ids: number[];
}

const EMPTY_FORM: FormState = {
  id_terminal: '',
  nom_pdv: '',
  msisdn_responsable: '',
  latitude_creation: 0,
  longitude_creation: 0,
  statut: 'actif',
  concessionnaire_nom: '',
  vendeur_nom: '',
  contact_vendeur: '',
  pays: '',
  ville: '',
  commune: '',
  quartier: '',
  agence_id: '',
  commercial_id: '',
  superviseur_id: '',
  chef_zone_id: '',
  produits_ids: [],
};

const PDVList = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Un commercial ne peut taguer/modifier que ses propres PDV (voir
  // utils/scope.js côté API) : le champ "Commercial" du formulaire n'a donc
  // pas de sens à lui laisser en libre choix, c'est toujours lui-même.
  const { user } = useAuthStore();
  const estCommercial = user?.role === 'commercial';
  const [showModal, setShowModal] = useState(false);
  const [editingPDV, setEditingPDV] = useState<PDV | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  // Recherche débattue : la clé de requête ne doit pas changer à chaque
  // frappe, sinon on déclenche un appel réseau (et un re-rendu de la table)
  // par caractère saisi.
  const [rechercheDebattue, setRechercheDebattue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'inactif' | 'suspendu'>('all');
  // File de travail de l'agent commercial : les dossiers enrôlés depuis le
  // mobile qui attendent d'être complétés.
  const [dossierFilter, setDossierFilter] = useState<'all' | 'brouillon' | 'complet'>('all');
  const [exportEnCours, setExportEnCours] = useState(false);
  const [agenceFilter, setAgenceFilter] = useState<number | ''>('');
  const [commercialFilter, setCommercialFilter] = useState<number | ''>('');
  const [superviseurFilter, setSuperviseurFilter] = useState<number | ''>('');
  const [chefZoneFilter, setChefZoneFilter] = useState<number | ''>('');
  const [produitFilter, setProduitFilter] = useState<number | ''>('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  // Référentiels pour les listes déroulantes (Agence, Commercial, Superviseur, Chef de zone, Produits)
  const { data: agences = [] } = useQuery({
    queryKey: ['agences-list'],
    queryFn: agenceService.getAllAgencesList,
  });
  const { data: commerciaux = [] } = useQuery({
    queryKey: ['users-list', 'commercial'],
    queryFn: () => userService.getUsersByRole('commercial'),
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

  // Configuration des champs fixes, administrée depuis Paramètres > Champs PDV.
  // Le formulaire de création la respecte désormais comme le fait déjà la fiche
  // de complétion : un champ masqué par l'admin ne doit pas réapparaître ici,
  // sinon les deux écrans se contredisent. `staleTime: 0` + `refetchOnMount`
  // parce que le défaut global (5 min) laissait les agents sur une version
  // périmée du formulaire après un changement côté admin.
  const { data: champsFixes = [] } = useQuery({
    queryKey: ['pdv-champs-fixes'],
    queryFn: pdvChampFixeService.getAll,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const champsFixesParCode = useMemo(
    () => new Map(champsFixes.map((c) => [c.code, c] as [string, PdvChampFixe])),
    [champsFixes]
  );
  // Repli permissif tant que la configuration n'est pas chargée : mieux vaut
  // afficher un champ de trop une fraction de seconde que de faire clignoter
  // le formulaire.
  const champVisible = (code: string) => champsFixesParCode.get(code)?.visible !== false;
  const champObligatoire = (code: string) => champsFixesParCode.get(code)?.obligatoire === true;
  const champLibelle = (code: string, defaut: string) =>
    champsFixesParCode.get(code)?.libelle || defaut;
  const etoile = (code: string) => (champObligatoire(code) ? ' *' : '');

  useEffect(() => {
    const minuteur = setTimeout(() => {
      setRechercheDebattue(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(minuteur);
  }, [searchTerm]);

  const filters = useMemo(() => ({
    ...(statusFilter !== 'all' ? { statut: statusFilter } : {}),
    ...(dossierFilter !== 'all' ? { statut_dossier: dossierFilter } : {}),
    ...(agenceFilter ? { agence_id: agenceFilter } : {}),
    ...(commercialFilter ? { commercial_id: commercialFilter } : {}),
    ...(superviseurFilter ? { superviseur_id: superviseurFilter } : {}),
    ...(chefZoneFilter ? { chef_zone_id: chefZoneFilter } : {}),
    ...(produitFilter ? { produit_id: produitFilter } : {}),
    ...(rechercheDebattue ? { search: rechercheDebattue } : {}),
  }), [statusFilter, dossierFilter, agenceFilter, commercialFilter, superviseurFilter, chefZoneFilter, produitFilter, rechercheDebattue]);

  const { data: pdvsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['pdvs', currentPage, itemsPerPage, filters],
    queryFn: () => pdvService.getAllPDVs(currentPage, itemsPerPage, filters),
    // La clé de requête contient la page et les filtres : sans
    // `keepPreviousData`, chaque clic sur "page suivante", sur un onglet ou
    // sur un filtre repassait la table entière en "Chargement…" avant de la
    // reconstruire — d'où l'impression que toute la page se rechargeait.
    // Ici les lignes précédentes restent à l'écran pendant la requête.
    placeholderData: keepPreviousData,
  });

  const pdvs: PDV[] = pdvsResponse?.data || [];
  const pagination = pdvsResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const activeFiltersCount = [agenceFilter, commercialFilter, superviseurFilter, chefZoneFilter, produitFilter].filter(Boolean).length;

  const createMutation = useMutation({
    mutationFn: (data: Partial<PDV>) => pdvService.createPDV(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      setShowModal(false);
      toast.success('PDV tagué avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la création du PDV');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PDV> }) =>
      pdvService.updatePDV(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      setShowModal(false);
      toast.success('PDV mis à jour avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du PDV');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: pdvService.deletePDV,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      toast.success('PDV supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du PDV');
    }
  });

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);
  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const buildPayload = (): Partial<PDV> & { produits_ids: number[] } => ({
    id_terminal: formData.id_terminal || undefined,
    nom_pdv: formData.nom_pdv,
    msisdn_responsable: formData.msisdn_responsable,
    latitude_creation: formData.latitude_creation,
    longitude_creation: formData.longitude_creation,
    statut: formData.statut,
    concessionnaire_nom: formData.concessionnaire_nom || undefined,
    vendeur_nom: formData.vendeur_nom || undefined,
    contact_vendeur: formData.contact_vendeur || undefined,
    pays: formData.pays || undefined,
    ville: formData.ville || undefined,
    commune: formData.commune || undefined,
    quartier: formData.quartier || undefined,
    agence_id: formData.agence_id === '' ? undefined : Number(formData.agence_id),
    commercial_id: formData.commercial_id === '' ? undefined : Number(formData.commercial_id),
    superviseur_id: formData.superviseur_id === '' ? undefined : Number(formData.superviseur_id),
    chef_zone_id: formData.chef_zone_id === '' ? undefined : Number(formData.chef_zone_id),
    produits_ids: formData.produits_ids,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (editingPDV) {
      updateMutation.mutate({ id: editingPDV.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (pdv: PDV) => {
    setEditingPDV(pdv);
    setFormData({
      id_terminal: pdv.id_terminal || '',
      nom_pdv: pdv.nom_pdv,
      msisdn_responsable: pdv.msisdn_responsable || '',
      latitude_creation: pdv.latitude_creation,
      longitude_creation: pdv.longitude_creation,
      statut: pdv.statut,
      concessionnaire_nom: pdv.concessionnaire_nom || '',
      vendeur_nom: pdv.vendeur_nom || '',
      contact_vendeur: pdv.contact_vendeur || '',
      pays: pdv.pays || '',
      ville: pdv.ville || '',
      commune: pdv.commune || '',
      quartier: pdv.quartier || '',
      agence_id: pdv.agence_id ?? pdv.agence?.id ?? '',
      // Un commercial édite forcément l'un de ses propres PDV (portée API) :
      // on reverrouille sur lui-même par cohérence, même si `pdv.commercial_id`
      // devrait déjà être le sien.
      commercial_id: estCommercial && user ? user.id : pdv.commercial_id ?? pdv.commercial?.id ?? '',
      superviseur_id: pdv.superviseur_id ?? pdv.superviseur?.id ?? '',
      chef_zone_id: pdv.chef_zone_id ?? pdv.chefZone?.id ?? '',
      produits_ids: (pdv.produits || []).map((p) => p.id),
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce PDV ?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    // Pour un commercial, le champ est verrouillé sur lui-même dès
    // l'ouverture du formulaire plutôt que laissé vide — voir estCommercial.
    setFormData({ ...EMPTY_FORM, commercial_id: estCommercial && user ? user.id : '' });
    setEditingPDV(null);
  };

  const resetFilters = () => {
    setAgenceFilter('');
    setCommercialFilter('');
    setSuperviseurFilter('');
    setChefZoneFilter('');
    setProduitFilter('');
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((f) => ({
            ...f,
            latitude_creation: position.coords.latitude,
            longitude_creation: position.coords.longitude
          }));
          toast.success('Position GPS obtenue');
        },
        () => {
          toast.error('Impossible d\'obtenir la position GPS');
        }
      );
    } else {
      toast.error('Géolocalisation non supportée');
    }
  };

  const toggleProduit = (id: number) => {
    setFormData((f) => ({
      ...f,
      produits_ids: f.produits_ids.includes(id)
        ? f.produits_ids.filter((p) => p !== id)
        : [...f.produits_ids, id]
    }));
  };

  const nomComplet = (u?: { nom: string; prenom: string }) => u ? `${u.prenom} ${u.nom}` : '';

  // Par défaut on n'exporte que les dossiers validés : une ligne issue d'un
  // brouillon arrive chez le partenaire avec des colonnes vides qu'il ne peut
  // pas distinguer d'une information réellement absente. L'export exhaustif
  // reste accessible pour un contrôle interne.
  const handleExport = async (statut_dossier: 'complet' | 'tous' = 'complet') => {
    setExportEnCours(true);
    try {
      await pdvService.exportMapping({ statut_dossier });
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Points de Vente</h1>
          <p className="text-sm text-ink-500 mt-0.5">{pagination.total} point{pagination.total > 1 ? 's' : ''} de vente tagué{pagination.total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            <button
              onClick={() => handleExport('complet')}
              disabled={exportEnCours}
              className="btn btn-secondary !border-0 !rounded-none"
              title="Exporter les dossiers complets au format du mapping standard (sans les prix)"
            >
              <Download className="w-4 h-4" />
              {exportEnCours ? 'Export…' : 'Exporter'}
            </button>
            <button
              onClick={() => handleExport('tous')}
              disabled={exportEnCours}
              className="px-2.5 text-xs font-medium text-ink-500 hover:bg-ink-50 border-l border-ink-200 disabled:opacity-50"
              title="Inclure aussi les brouillons — pour un contrôle interne, pas pour un envoi partenaire"
            >
              + brouillons
            </button>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Nouveau PDV
          </button>
        </div>
      </div>

      <div className="panel">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un PDV, un numéro, un ID terminal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
            className="toolbar-select"
          >
            <option value="all">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="suspendu">Suspendu</option>
          </select>
          {/* Bascule rapide sur la file des dossiers à compléter : c'est le
              point d'entrée quotidien après une tournée d'installation. */}
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            {([
              { cle: 'all', libelle: 'Tous' },
              { cle: 'brouillon', libelle: 'Brouillons' },
              { cle: 'complet', libelle: 'Complets' },
            ] as const).map((onglet) => (
              <button
                key={onglet.cle}
                type="button"
                onClick={() => { setDossierFilter(onglet.cle); setCurrentPage(1); }}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  dossierFilter === onglet.cle
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-ink-500 hover:bg-ink-50'
                }`}
              >
                {onglet.libelle}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`btn btn-secondary !py-2 ${activeFiltersCount > 0 ? '!border-primary-400 !text-primary-700' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
          </button>
          <span className="ml-auto text-xs text-ink-400">
            {isFetching && !isLoading ? 'Mise à jour… · ' : ''}
            {pagination.total} résultat{pagination.total > 1 ? 's' : ''}
          </span>
        </div>

        {showMoreFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 px-5 py-4 border-b border-ink-100 bg-ink-50/50">
            <div>
              <label className="label !mb-1 !text-xs">Agence</label>
              <select
                value={agenceFilter}
                onChange={(e) => { setAgenceFilter(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}
                className="input !py-2 text-sm"
              >
                <option value="">Toutes les agences</option>
                {agences.map((a) => <option key={a.id} value={a.id}>{a.nom_agence}</option>)}
              </select>
            </div>
            <div>
              <label className="label !mb-1 !text-xs">Commercial</label>
              <select
                value={commercialFilter}
                onChange={(e) => { setCommercialFilter(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}
                className="input !py-2 text-sm"
              >
                <option value="">Tous les commerciaux</option>
                {commerciaux.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
              </select>
            </div>
            <div>
              <label className="label !mb-1 !text-xs">Superviseur</label>
              <select
                value={superviseurFilter}
                onChange={(e) => { setSuperviseurFilter(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}
                className="input !py-2 text-sm"
              >
                <option value="">Tous les superviseurs</option>
                {superviseurs.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
              </select>
            </div>
            <div>
              <label className="label !mb-1 !text-xs">Chef de zone</label>
              <select
                value={chefZoneFilter}
                onChange={(e) => { setChefZoneFilter(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}
                className="input !py-2 text-sm"
              >
                <option value="">Tous les chefs de zone</option>
                {chefsZone.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
              </select>
            </div>
            <div>
              <label className="label !mb-1 !text-xs">Type de produit</label>
              <select
                value={produitFilter}
                onChange={(e) => { setProduitFilter(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}
                className="input !py-2 text-sm"
              >
                <option value="">Tous les produits</option>
                {produits.map((p: any) => <option key={p.id} value={p.id}>{p.nom_produit}</option>)}
              </select>
            </div>
            {activeFiltersCount > 0 && (
              <div className="lg:col-span-5">
                <button type="button" onClick={resetFilters} className="text-xs text-primary-600 font-medium hover:text-primary-700">
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ID Terminal / PDV</th>
                <th>Contact</th>
                <th>Produits vendus</th>
                <th>Agence</th>
                <th>Commercial</th>
                <th>Superviseur</th>
                <th>Chef de zone</th>
                <th>Localisation</th>
                <th>Statut</th>
                <th>Dossier</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-ink-400">Chargement...</td>
                </tr>
              ) : pdvs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-ink-400">Aucun PDV trouvé</td>
                </tr>
              ) : (
                pdvs.map((pdv) => (
                  <tr
                    key={pdv.id}
                    onClick={() => navigate(`/pdv/${pdv.id}`)}
                    className="cursor-pointer hover:bg-ink-50/60"
                  >
                    <td>
                      <div className="font-medium text-ink-900">{pdv.nom_pdv}</div>
                      <div className="text-xs text-ink-400 break-all">{pdv.id_terminal || '—'}</div>
                      {pdv.matricule_agent ? (
                        <div className="text-xs text-ink-400">Agent {pdv.matricule_agent}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex items-center text-ink-600">
                        <Phone className="w-3.5 h-3.5 mr-1.5 text-ink-400" />
                        {pdv.msisdn_responsable || '—'}
                      </div>
                    </td>
                    <td>
                      {pdv.produits && pdv.produits.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {pdv.produits.map((p) => (
                            <span key={p.id} className="chip !py-0.5">{p.nom_produit}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-300 text-xs">Non renseigné</span>
                      )}
                    </td>
                    <td className="text-ink-600">{pdv.agence?.nom_agence || '—'}</td>
                    <td className="text-ink-600">{pdv.commercial ? nomComplet(pdv.commercial) : '—'}</td>
                    <td className="text-ink-600">{pdv.superviseur ? nomComplet(pdv.superviseur) : '—'}</td>
                    <td className="text-ink-600">{pdv.chefZone ? nomComplet(pdv.chefZone) : '—'}</td>
                    <td>
                      <div className="flex items-center text-ink-600 text-xs">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-ink-400 shrink-0" />
                        <span>
                          {[pdv.quartier, pdv.commune, pdv.ville].filter(Boolean).join(', ') || `${Number(pdv.latitude_creation).toFixed(3)}, ${Number(pdv.longitude_creation).toFixed(3)}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={STATUS_BADGE[pdv.statut] ?? 'badge badge-neutral'}>
                        {pdv.statut}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          pdv.statut_dossier === 'brouillon'
                            ? 'badge badge-warning'
                            : 'badge badge-success'
                        }
                      >
                        {pdv.statut_dossier === 'brouillon' ? 'À compléter' : 'Complet'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/pdv/${pdv.id}`)}
                          className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                          title="Compléter le dossier"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(pdv)}
                          className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pdv.id)}
                          className="btn-icon hover:text-danger-600 hover:bg-danger-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                {editingPDV ? 'Modifier le PDV' : 'Nouveau PDV'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                {/* Identification */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Identification</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">ID Terminal</label>
                      <input
                        type="text"
                        value={formData.id_terminal}
                        onChange={(e) => setFormData({ ...formData, id_terminal: e.target.value })}
                        className="input"
                        placeholder="Optionnel"
                      />
                    </div>
                    {champVisible('nom_pdv') && (
                      <div>
                        <label className="label">{champLibelle('nom_pdv', 'Nom du PDV')}{etoile('nom_pdv')}</label>
                        <input
                          type="text"
                          value={formData.nom_pdv}
                          onChange={(e) => setFormData({ ...formData, nom_pdv: e.target.value })}
                          className="input"
                          required={champObligatoire('nom_pdv')}
                        />
                      </div>
                    )}
                    {champVisible('msisdn_responsable') && (
                      <div>
                        <label className="label">
                          {champLibelle('msisdn_responsable', 'MSISDN Responsable')}{etoile('msisdn_responsable')}
                        </label>
                        <input
                          type="text"
                          value={formData.msisdn_responsable}
                          onChange={(e) => setFormData({ ...formData, msisdn_responsable: e.target.value })}
                          className="input"
                          required={champObligatoire('msisdn_responsable')}
                        />
                      </div>
                    )}
                    {champVisible('statut') && (
                      <div>
                      <label className="label">{champLibelle('statut', 'Statut')}</label>
                      <select
                        value={formData.statut}
                        onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                        className="input"
                      >
                        <option value="actif">Actif</option>
                        <option value="inactif">Inactif</option>
                        <option value="suspendu">Suspendu</option>
                      </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tagging */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Tagging (Concessionnaire / Vendeur)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {champVisible('concessionnaire_nom') && (
                      <div>
                        <label className="label">{champLibelle('concessionnaire_nom', 'Nom du concessionnaire')}{etoile('concessionnaire_nom')}</label>
                        <input
                          type="text"
                          value={formData.concessionnaire_nom}
                          onChange={(e) => setFormData({ ...formData, concessionnaire_nom: e.target.value })}
                          className="input"
                          required={champObligatoire('concessionnaire_nom')}
                        />
                      </div>
                    )}
                    {champVisible('vendeur_nom') && (
                      <div>
                        <label className="label">{champLibelle('vendeur_nom', 'Nom du vendeur')}{etoile('vendeur_nom')}</label>
                        <input
                          type="text"
                          value={formData.vendeur_nom}
                          onChange={(e) => setFormData({ ...formData, vendeur_nom: e.target.value })}
                          className="input"
                          required={champObligatoire('vendeur_nom')}
                        />
                      </div>
                    )}
                    {champVisible('contact_vendeur') && (
                      <div>
                        <label className="label">{champLibelle('contact_vendeur', 'Contact du vendeur')}{etoile('contact_vendeur')}</label>
                        <input
                          type="text"
                          value={formData.contact_vendeur}
                          onChange={(e) => setFormData({ ...formData, contact_vendeur: e.target.value })}
                          className="input"
                          required={champObligatoire('contact_vendeur')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Produits (choix multiples) */}
                {champVisible('produits') && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    {champLibelle('produits', 'Type(s) de produit vendu')}{etoile('produits')}
                  </h3>
                  {produits.length === 0 ? (
                    <p className="text-sm text-ink-400">Aucun produit référencé. Ajoutez-en depuis la page Produits.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {produits.map((p: any) => {
                        const selected = formData.produits_ids.includes(p.id);
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => toggleProduit(p.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selected
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'bg-white border-ink-200 text-ink-600 hover:border-primary-300'
                            }`}
                          >
                            {p.nom_produit}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}

                {/* Hiérarchie commerciale */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Hiérarchie commerciale</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {champVisible('agence_id') && (
                      <div>
                      <label className="label">{champLibelle('agence_id', 'Agence')}{etoile('agence_id')}</label>
                      <select
                        value={formData.agence_id}
                        onChange={(e) => setFormData({ ...formData, agence_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner une agence</option>
                        {agences.map((a) => <option key={a.id} value={a.id}>{a.nom_agence}</option>)}
                      </select>
                      </div>
                    )}
                    <div>
                      <label className="label">Commercial</label>
                      {estCommercial ? (
                        // Toujours lui-même : verrouillé plutôt qu'un select à
                        // une seule option utile, cohérent avec la fiche PDV
                        // (PDVDetail) qui l'affiche déjà en lecture seule.
                        <input
                          type="text"
                          className="input bg-ink-50 text-ink-500"
                          value={user ? nomComplet(user) : ''}
                          disabled
                          title="Un commercial ne peut taguer que ses propres PDV"
                        />
                      ) : (
                        <select
                          value={formData.commercial_id}
                          onChange={(e) => setFormData({ ...formData, commercial_id: e.target.value ? Number(e.target.value) : '' })}
                          className="input"
                        >
                          <option value="">Sélectionner un commercial</option>
                          {commerciaux.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                        </select>
                      )}
                    </div>
                    {champVisible('superviseur_id') && (
                      <div>
                      <label className="label">{champLibelle('superviseur_id', 'Superviseur')}{etoile('superviseur_id')}</label>
                      <select
                        value={formData.superviseur_id}
                        onChange={(e) => setFormData({ ...formData, superviseur_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner un superviseur</option>
                        {superviseurs.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                      </select>
                      </div>
                    )}
                    {champVisible('chef_zone_id') && (
                      <div>
                      <label className="label">{champLibelle('chef_zone_id', 'Chef de zone')}{etoile('chef_zone_id')}</label>
                      <select
                        value={formData.chef_zone_id}
                        onChange={(e) => setFormData({ ...formData, chef_zone_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner un chef de zone</option>
                        {chefsZone.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                      </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Localisation */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Localisation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {champVisible('pays') && (
                      <div>
                        <label className="label">{champLibelle('pays', 'Pays')}{etoile('pays')}</label>
                        <input
                          type="text"
                          value={formData.pays}
                          onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                          className="input"
                          required={champObligatoire('pays')}
                        />
                      </div>
                    )}
                    {champVisible('ville') && (
                      <div>
                        <label className="label">{champLibelle('ville', 'Ville')}{etoile('ville')}</label>
                        <input
                          type="text"
                          value={formData.ville}
                          onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                          className="input"
                          required={champObligatoire('ville')}
                        />
                      </div>
                    )}
                    {champVisible('commune') && (
                      <div>
                        <label className="label">{champLibelle('commune', 'Commune')}{etoile('commune')}</label>
                        <input
                          type="text"
                          value={formData.commune}
                          onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                          className="input"
                          required={champObligatoire('commune')}
                        />
                      </div>
                    )}
                    {champVisible('quartier') && (
                      <div>
                        <label className="label">{champLibelle('quartier', 'Quartier')}{etoile('quartier')}</label>
                        <input
                          type="text"
                          value={formData.quartier}
                          onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                          className="input"
                          required={champObligatoire('quartier')}
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.latitude_creation}
                        onChange={(e) => setFormData({ ...formData, latitude_creation: parseFloat(e.target.value) })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.longitude_creation}
                        onChange={(e) => setFormData({ ...formData, longitude_creation: parseFloat(e.target.value) })}
                        className="input"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="btn btn-secondary w-full mt-3"
                  >
                    <MapPin className="w-4 h-4" />
                    Obtenir ma position GPS
                  </button>
                  <p className="text-xs text-ink-400 mt-2">
                    Cette position sert de référence pour la détection d'activité suspecte (sortie du rayon de 500m).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPDV ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDVList;
