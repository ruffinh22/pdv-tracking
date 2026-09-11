import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Phone, Search, X, ChevronDown, Tag, Filter } from 'lucide-react';
import { pdvService, PDV } from '../services/pdvService';
import { agenceService } from '../services/agenceService';
import { userService } from '../services/userService';
import { produitService } from '../services/produitService';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

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
  const [showModal, setShowModal] = useState(false);
  const [editingPDV, setEditingPDV] = useState<PDV | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'inactif' | 'suspendu'>('all');
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

  const filters = useMemo(() => ({
    ...(statusFilter !== 'all' ? { statut: statusFilter } : {}),
    ...(agenceFilter ? { agence_id: agenceFilter } : {}),
    ...(commercialFilter ? { commercial_id: commercialFilter } : {}),
    ...(superviseurFilter ? { superviseur_id: superviseurFilter } : {}),
    ...(chefZoneFilter ? { chef_zone_id: chefZoneFilter } : {}),
    ...(produitFilter ? { produit_id: produitFilter } : {}),
    ...(searchTerm ? { search: searchTerm } : {}),
  }), [statusFilter, agenceFilter, commercialFilter, superviseurFilter, chefZoneFilter, produitFilter, searchTerm]);

  const { data: pdvsResponse, isLoading } = useQuery({
    queryKey: ['pdvs', currentPage, itemsPerPage, filters],
    queryFn: () => pdvService.getAllPDVs(currentPage, itemsPerPage, filters),
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
      msisdn_responsable: pdv.msisdn_responsable,
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
      commercial_id: pdv.commercial_id ?? pdv.commercial?.id ?? '',
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
    setFormData(EMPTY_FORM);
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Points de Vente</h1>
          <p className="text-sm text-ink-500 mt-0.5">{pagination.total} point{pagination.total > 1 ? 's' : ''} de vente tagué{pagination.total > 1 ? 's' : ''}</p>
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

      <div className="panel">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un PDV, un numéro, un ID terminal..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-ink-400">Chargement...</td>
                </tr>
              ) : pdvs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-ink-400">Aucun PDV trouvé</td>
                </tr>
              ) : (
                pdvs.map((pdv) => (
                  <tr key={pdv.id}>
                    <td>
                      <div className="font-medium text-ink-900">{pdv.nom_pdv}</div>
                      <div className="text-xs text-ink-400">{pdv.id_terminal || '—'}</div>
                    </td>
                    <td>
                      <div className="flex items-center text-ink-600">
                        <Phone className="w-3.5 h-3.5 mr-1.5 text-ink-400" />
                        {pdv.msisdn_responsable}
                      </div>
                    </td>
                    <td>
                      {pdv.produits && pdv.produits.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {pdv.produits.map((p) => (
                            <span key={p.id} className="badge badge-primary !py-0.5">{p.nom_produit}</span>
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
                      <div className="flex justify-end gap-1">
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
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                    <div>
                      <label className="label">Nom du PDV</label>
                      <input
                        type="text"
                        value={formData.nom_pdv}
                        onChange={(e) => setFormData({ ...formData, nom_pdv: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">MSISDN Responsable</label>
                      <input
                        type="text"
                        value={formData.msisdn_responsable}
                        onChange={(e) => setFormData({ ...formData, msisdn_responsable: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Statut</label>
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
                  </div>
                </div>

                {/* Tagging */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Tagging (Concessionnaire / Vendeur)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nom du concessionnaire</label>
                      <input
                        type="text"
                        value={formData.concessionnaire_nom}
                        onChange={(e) => setFormData({ ...formData, concessionnaire_nom: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Nom du vendeur</label>
                      <input
                        type="text"
                        value={formData.vendeur_nom}
                        onChange={(e) => setFormData({ ...formData, vendeur_nom: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Contact du vendeur</label>
                      <input
                        type="text"
                        value={formData.contact_vendeur}
                        onChange={(e) => setFormData({ ...formData, contact_vendeur: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                {/* Produits (choix multiples) */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Type(s) de produit vendu
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

                {/* Hiérarchie commerciale */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Hiérarchie commerciale</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Agence</label>
                      <select
                        value={formData.agence_id}
                        onChange={(e) => setFormData({ ...formData, agence_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner une agence</option>
                        {agences.map((a) => <option key={a.id} value={a.id}>{a.nom_agence}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Commercial</label>
                      <select
                        value={formData.commercial_id}
                        onChange={(e) => setFormData({ ...formData, commercial_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner un commercial</option>
                        {commerciaux.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Superviseur</label>
                      <select
                        value={formData.superviseur_id}
                        onChange={(e) => setFormData({ ...formData, superviseur_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner un superviseur</option>
                        {superviseurs.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Chef de zone</label>
                      <select
                        value={formData.chef_zone_id}
                        onChange={(e) => setFormData({ ...formData, chef_zone_id: e.target.value ? Number(e.target.value) : '' })}
                        className="input"
                      >
                        <option value="">Sélectionner un chef de zone</option>
                        {chefsZone.map((u) => <option key={u.id} value={u.id}>{nomComplet(u)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Localisation */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2.5">Localisation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label">Pays</label>
                      <input type="text" value={formData.pays} onChange={(e) => setFormData({ ...formData, pays: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Ville</label>
                      <input type="text" value={formData.ville} onChange={(e) => setFormData({ ...formData, ville: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Commune</label>
                      <input type="text" value={formData.commune} onChange={(e) => setFormData({ ...formData, commune: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Quartier</label>
                      <input type="text" value={formData.quartier} onChange={(e) => setFormData({ ...formData, quartier: e.target.value })} className="input" />
                    </div>
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
