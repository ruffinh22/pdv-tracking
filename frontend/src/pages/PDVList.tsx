import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Phone } from 'lucide-react';
import { pdvService, PDV } from '../services/pdvService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const PDVList = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPDV, setEditingPDV] = useState<PDV | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    nom_pdv: '',
    msisdn_responsable: '',
    latitude_creation: 0,
    longitude_creation: 0,
    statut: 'actif' as 'actif' | 'inactif' | 'suspendu'
  });

  const { data: pdvsResponse, isLoading } = useQuery({
    queryKey: ['pdvs', currentPage, itemsPerPage],
    queryFn: () => pdvService.getAllPDVs(currentPage, itemsPerPage)
  });

  const pdvs = pdvsResponse?.data || [];
  const pagination = pdvsResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const createMutation = useMutation({
    mutationFn: pdvService.createPDV,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      setShowModal(false);
      toast.success('PDV créé avec succès');
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

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPDV) {
      updateMutation.mutate({ id: editingPDV.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (pdv: PDV) => {
    setEditingPDV(pdv);
    setFormData({
      nom_pdv: pdv.nom_pdv,
      msisdn_responsable: pdv.msisdn_responsable,
      latitude_creation: pdv.latitude_creation,
      longitude_creation: pdv.longitude_creation,
      statut: pdv.statut
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce PDV ?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({
      nom_pdv: '',
      msisdn_responsable: '',
      latitude_creation: 0,
      longitude_creation: 0,
      statut: 'actif'
    });
    setEditingPDV(null);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude_creation: position.coords.latitude,
            longitude_creation: position.coords.longitude
          });
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Points de Vente</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau PDV
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Nom</th>
                <th className="text-left p-4">MSISDN</th>
                <th className="text-left p-4">Position</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4">Date installation</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pdvs.map((pdv) => (
                <tr key={pdv.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{pdv.nom_pdv}</td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-gray-500" />
                      {pdv.msisdn_responsable}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                      {parseFloat(pdv.latitude_creation).toFixed(4)}, {parseFloat(pdv.longitude_creation).toFixed(4)}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      pdv.statut === 'actif' ? 'bg-success-100 text-success-700' :
                      pdv.statut === 'inactif' ? 'bg-gray-100 text-gray-700' :
                      'bg-danger-100 text-danger-700'
                    }`}>
                      {pdv.statut}
                    </span>
                  </td>
                  <td className="p-4">
                    {new Date(pdv.date_installation_app).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(pdv)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(pdv.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingPDV ? 'Modifier le PDV' : 'Nouveau PDV'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom du PDV</label>
                  <input
                    type="text"
                    value={formData.nom_pdv}
                    onChange={(e) => setFormData({ ...formData, nom_pdv: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">MSISDN Responsable</label>
                  <input
                    type="text"
                    value={formData.msisdn_responsable}
                    onChange={(e) => setFormData({ ...formData, msisdn_responsable: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude_creation}
                      onChange={(e) => setFormData({ ...formData, latitude_creation: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude_creation}
                      onChange={(e) => setFormData({ ...formData, longitude_creation: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  className="w-full p-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Obtenir ma position GPS
                </button>
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="suspendu">Suspendu</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
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
