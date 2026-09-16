import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agenceService, Agence } from '../services/agenceService';
import { Plus, Edit, Trash2, Building2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const Agences = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAgence, setEditingAgence] = useState<Agence | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({ nom_agence: '', ville: '', statut: 'actif' as 'actif' | 'inactif' });

  const queryClient = useQueryClient();

  const { data: agencesResponse, isLoading } = useQuery({
    queryKey: ['agences', currentPage, itemsPerPage],
    queryFn: () => agenceService.getAllAgences(currentPage, itemsPerPage),
    // Les données précédentes restent affichées pendant le rechargement :
    // changer de page ou de filtre ne doit pas vider la table puis la
    // reconstruire, ce qui donnait l'impression d'un rechargement complet.
    placeholderData: keepPreviousData,
  });

  const agences = agencesResponse?.data || [];
  const pagination = agencesResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const createMutation = useMutation({
    mutationFn: agenceService.createAgence,
    onSuccess: () => {
      toast.success('Agence créée avec succès');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['agences'] });
    },
    onError: () => toast.error('Erreur lors de la création de l\'agence')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Agence> }) => agenceService.updateAgence(id, data),
    onSuccess: () => {
      toast.success('Agence mise à jour avec succès');
      setShowModal(false);
      resetForm();
      setEditingAgence(null);
      queryClient.invalidateQueries({ queryKey: ['agences'] });
    },
    onError: () => toast.error('Erreur lors de la mise à jour de l\'agence')
  });

  const deleteMutation = useMutation({
    mutationFn: agenceService.deleteAgence,
    onSuccess: () => {
      toast.success('Agence désactivée avec succès');
      queryClient.invalidateQueries({ queryKey: ['agences'] });
    },
    onError: () => toast.error('Erreur lors de la désactivation de l\'agence')
  });

  const filteredAgences = agences.filter((a: Agence) =>
    a.nom_agence.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.ville?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => setFormData({ nom_agence: '', ville: '', statut: 'actif' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAgence) {
      updateMutation.mutate({ id: editingAgence.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (agence: Agence) => {
    setEditingAgence(agence);
    setFormData({ nom_agence: agence.nom_agence, ville: agence.ville || '', statut: agence.statut });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir désactiver cette agence ?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Agences</h1>
          <p className="text-sm text-ink-500 mt-0.5">Référentiel utilisé pour le tagging des points de vente</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingAgence(null); setShowModal(true); }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Agence
        </button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une agence, une ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <span className="ml-auto text-xs text-ink-400">
            {filteredAgences.length} résultat{filteredAgences.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nom de l'agence</th>
                <th>Ville</th>
                <th>Statut</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-10 text-ink-400">Chargement...</td></tr>
              ) : filteredAgences.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-ink-400">Aucune agence trouvée</td></tr>
              ) : (
                filteredAgences.map((agence: Agence) => (
                  <tr key={agence.id}>
                    <td>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="font-medium text-ink-900">{agence.nom_agence}</span>
                      </div>
                    </td>
                    <td className="text-ink-600">{agence.ville || '-'}</td>
                    <td>
                      <span className={agence.statut === 'actif' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {agence.statut === 'actif' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(agence)} className="btn-icon hover:text-primary-600 hover:bg-primary-50">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(agence.id)} className="btn-icon hover:text-danger-600 hover:bg-danger-50">
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
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                {editingAgence ? 'Modifier l\'agence' : 'Nouvelle agence'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); setEditingAgence(null); }} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nom de l'agence *</label>
                <input
                  type="text"
                  value={formData.nom_agence}
                  onChange={(e) => setFormData({ ...formData, nom_agence: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Ville</label>
                <input
                  type="text"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Statut</label>
                <select
                  value={formData.statut}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                  className="input"
                >
                  <option value="actif">Active</option>
                  <option value="inactif">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); setEditingAgence(null); }}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAgence ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agences;