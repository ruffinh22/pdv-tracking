import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { produitService } from '../services/produitService';
import { Plus, Edit, Trash2, Package, Search } from 'lucide-react';
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
    queryFn: () => produitService.getAllProduits(currentPage, itemsPerPage)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Produits</h1>
          <p className="text-gray-600 mt-1">Catalogue de produits pour les ventes</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingProduit(null);
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Produit
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Nom</th>
                <th className="text-left p-4">Catégorie</th>
                <th className="text-left p-4">Prix Unitaire</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center p-8">Chargement...</td>
                </tr>
              ) : filteredProduits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-gray-500">
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                filteredProduits.map((produit: any) => (
                  <tr key={produit.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 text-gray-500" />
                        <span className="font-medium">{produit.nom_produit}</span>
                      </div>
                      {produit.description && (
                        <p className="text-sm text-gray-500 mt-1">{produit.description}</p>
                      )}
                    </td>
                    <td className="p-4">{produit.categorie || '-'}</td>
                    <td className="p-4 font-medium">
                      {produit.prix_unitaire ? `${Number(produit.prix_unitaire).toLocaleString('fr-FR')} FCFA` : '-'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        produit.statut === 'actif' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {produit.statut === 'actif' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(produit)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(produit.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingProduit ? 'Modifier le Produit' : 'Nouveau Produit'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom du produit *</label>
                <input
                  type="text"
                  value={formData.nom_produit}
                  onChange={(e) => setFormData({ ...formData, nom_produit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie</label>
                <input
                  type="text"
                  value={formData.categorie}
                  onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prix Unitaire (FCFA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.prix_unitaire}
                  onChange={(e) => setFormData({ ...formData, prix_unitaire: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.statut === 'actif'}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.checked ? 'actif' : 'inactif' })}
                  className="w-4 h-4"
                />
                <label htmlFor="actif" className="text-sm">Produit actif</label>
              </div>
              <div className="flex space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setEditingProduit(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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