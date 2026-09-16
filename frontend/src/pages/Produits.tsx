import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { produitService } from '../services/produitService';
import { Plus, Edit, Trash2, Package, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const Produits = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    nom_produit: '',
    description: '',
    prix_unitaire: '',
    categorie: '',
    statut: 'actif'
  });

  const queryClient = useQueryClient();

  const { data: produitsResponse, isLoading } = useQuery({
    queryKey: ['produits', currentPage, itemsPerPage],
    queryFn: () => produitService.getAllProduits(currentPage, itemsPerPage),
    // Les données précédentes restent affichées pendant le rechargement :
    // changer de page ou de filtre ne doit pas vider la table puis la
    // reconstruire, ce qui donnait l'impression d'un rechargement complet.
    placeholderData: keepPreviousData,
  });

  const produits = produitsResponse?.data || [];
  const pagination = produitsResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const createMutation = useMutation({
    mutationFn: produitService.createProduit,
    onSuccess: () => {
      toast.success('Produit créé avec succès');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['produits'] });
    },
    onError: () => {
      toast.error('Erreur lors de la création du produit');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => produitService.updateProduit(id, data),
    onSuccess: () => {
      toast.success('Produit mis à jour avec succès');
      setShowModal(false);
      resetForm();
      setEditingProduit(null);
      queryClient.invalidateQueries({ queryKey: ['produits'] });
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du produit');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: produitService.deleteProduit,
    onSuccess: () => {
      toast.success('Produit désactivé avec succès');
      queryClient.invalidateQueries({ queryKey: ['produits'] });
    },
    onError: () => {
      toast.error('Erreur lors de la désactivation du produit');
    }
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const filteredProduits = produits.filter((produit: any) =>
    produit.nom_produit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produit.categorie?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      nom_produit: '',
      description: '',
      prix_unitaire: '',
      categorie: '',
      statut: 'actif'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduit) {
      updateMutation.mutate({ id: editingProduit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (produit: any) => {
    setEditingProduit(produit);
    setFormData({
      nom_produit: produit.nom_produit,
      description: produit.description || '',
      prix_unitaire: produit.prix_unitaire || '',
      categorie: produit.categorie || '',
      statut: produit.statut || 'actif'
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir désactiver ce produit?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Gestion des Produits</h1>
          <p className="text-sm text-ink-500 mt-0.5">Catalogue de produits pour les ventes</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingProduit(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nouveau Produit
        </button>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="toolbar">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un produit, une catégorie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <span className="ml-auto text-xs text-ink-400">
            {filteredProduits.length} résultat{filteredProduits.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix Unitaire</th>
                <th>Statut</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-ink-400">Chargement...</td>
                </tr>
              ) : filteredProduits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-ink-400">
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                filteredProduits.map((produit: any) => (
                  <tr key={produit.id}>
                    <td>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-ink-900">{produit.nom_produit}</p>
                          {produit.description && (
                            <p className="text-xs text-ink-400 mt-0.5">{produit.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-ink-600">{produit.categorie || '-'}</td>
                    <td className="font-medium text-ink-900">
                      {produit.prix_unitaire ? `${Number(produit.prix_unitaire).toLocaleString('fr-FR')} FCFA` : '-'}
                    </td>
                    <td>
                      <span className={produit.statut === 'actif' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {produit.statut === 'actif' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(produit)}
                          className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(produit.id)}
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

        {/* Pagination */}
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
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                {editingProduit ? 'Modifier le Produit' : 'Nouveau Produit'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); setEditingProduit(null); }}
                className="btn-icon"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nom du produit *</label>
                <input
                  type="text"
                  value={formData.nom_produit}
                  onChange={(e) => setFormData({ ...formData, nom_produit: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <input
                  type="text"
                  value={formData.categorie}
                  onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Prix Unitaire (FCFA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.prix_unitaire}
                  onChange={(e) => setFormData({ ...formData, prix_unitaire: e.target.value })}
                  className="input"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.statut === 'actif'}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.checked ? 'actif' : 'inactif' })}
                  className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-ink-700">Produit actif</span>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setEditingProduit(null);
                  }}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingProduit ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Produits;
