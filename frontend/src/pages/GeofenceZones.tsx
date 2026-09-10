import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Layers, UserPlus, UserMinus } from 'lucide-react';
import { geofenceService, GeofenceZone } from '../services/geofenceService';
import { pdvService, PDV } from '../services/pdvService';
import { useState } from 'react';
import toast from 'react-hot-toast';

const GeofenceZones = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);
  const [selectedZoneForAssign, setSelectedZoneForAssign] = useState<GeofenceZone | null>(null);
  const [formData, setFormData] = useState({
    nom_zone: '',
    type: 'cercle' as 'cercle' | 'polygone',
    coordonnees: {} as any,
    rayon: 100
  });

  const { data: zones, isLoading } = useQuery({
    queryKey: ['geofenceZones'],
    queryFn: geofenceService.getAllZones,
  });

  const { data: pdvsResponse } = useQuery({
    queryKey: ['pdvsAll'],
    queryFn: () => pdvService.getAllPDVsNoPagination(),
  });

  const pdvs: PDV[] = pdvsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: geofenceService.createZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofenceZones'] });
      setShowModal(false);
      toast.success('Zone créée avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la création de la zone');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GeofenceZone> }) => 
      geofenceService.updateZone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofenceZones'] });
      setShowModal(false);
      toast.success('Zone mise à jour avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de la zone');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: geofenceService.deleteZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofenceZones'] });
      toast.success('Zone supprimée avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression de la zone');
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ zoneId, pdvId }: { zoneId: number; pdvId: number }) => 
      geofenceService.assignPDVToZone(zoneId, pdvId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofenceZones'] });
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      toast.success('PDV assigné à la zone avec succès');
      setShowAssignModal(false);
      setSelectedZoneForAssign(null);
    },
    onError: () => {
      toast.error('Erreur lors de l\'assignation du PDV');
    }
  });

  const removeMutation = useMutation({
    mutationFn: ({ zoneId, pdvId }: { zoneId: number; pdvId: number }) => 
      geofenceService.removePDVFromZone(zoneId, pdvId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofenceZones'] });
      queryClient.invalidateQueries({ queryKey: ['pdvs'] });
      toast.success('PDV retiré de la zone avec succès');
    },
    onError: () => {
      toast.error('Erreur lors du retrait du PDV');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const zoneData = {
      ...formData,
      coordonnees: formData.type === 'cercle' 
        ? { type: 'Point', coordinates: [0, 0], radius: formData.rayon }
        : { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }
    };
    
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: zoneData });
    } else {
      createMutation.mutate(zoneData);
    }
  };

  const handleEdit = (zone: GeofenceZone) => {
    setEditingZone(zone);
    setFormData({
      nom_zone: zone.nom_zone,
      type: zone.type,
      coordonnees: zone.coordonnees,
      rayon: zone.rayon || 100
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette zone ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAssignPDV = (zone: GeofenceZone) => {
    setSelectedZoneForAssign(zone);
    setShowAssignModal(true);
  };

  const handleRemovePDV = (zoneId: number, pdvId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir retirer ce PDV de la zone ?')) {
      removeMutation.mutate({ zoneId, pdvId });
    }
  };

  const handleAssignSubmit = (pdvId: number) => {
    if (selectedZoneForAssign) {
      assignMutation.mutate({ zoneId: selectedZoneForAssign.id, pdvId });
    }
  };

  const resetForm = () => {
    setFormData({
      nom_zone: '',
      type: 'cercle',
      coordonnees: {},
      rayon: 100
    });
    setEditingZone(null);
    setSelectedZoneForAssign(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Zones Geofence</h1>
          <p className="text-gray-600 mt-1">Gestion des zones géographiques et assignation des PDV</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Zone
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones?.map((zone) => (
          <div key={zone.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Layers className="w-8 h-8 text-primary-600 mr-3" />
                <div>
                  <h3 className="font-semibold">{zone.nom_zone}</h3>
                  <p className="text-sm text-gray-600">{zone.type}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(zone)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                <span>{zone.type === 'cercle' ? `Rayon: ${zone.rayon}m` : 'Polygone'}</span>
              </div>
              <div className="text-gray-600">
                PDV assignés: {zone.pdvs?.length || 0}
              </div>
              <div className="text-gray-500 text-xs">
                Créée le: {new Date(zone.date_creation).toLocaleDateString()}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">PDV dans cette zone:</span>
                <button
                  onClick={() => handleAssignPDV(zone)}
                  className="p-1 hover:bg-primary-50 rounded text-primary-600"
                  title="Assigner un PDV"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              
              {zone.pdvs && zone.pdvs.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {zone.pdvs.map((pdv: any) => (
                    <div key={pdv.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                      <span className="text-gray-700">{pdv.nom_pdv}</span>
                      <button
                        onClick={() => handleRemovePDV(zone.id, pdv.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-600"
                        title="Retirer"
                      >
                        <UserMinus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Aucun PDV assigné</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom de la zone</label>
                  <input
                    type="text"
                    value={formData.nom_zone}
                    onChange={(e) => setFormData({ ...formData, nom_zone: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type de zone</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="cercle">Cercle</option>
                    <option value="polygone">Polygone</option>
                  </select>
                </div>
                {formData.type === 'cercle' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Rayon (mètres)</label>
                    <input
                      type="number"
                      value={formData.rayon}
                      onChange={(e) => setFormData({ ...formData, rayon: parseInt(e.target.value) })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                )}
                <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
                  <p>⚠️ Pour une implémentation complète, utilisez une carte interactive pour définir les coordonnées précises.</p>
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
                  {editingZone ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'assignation de PDV */}
      {showAssignModal && selectedZoneForAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Assigner un PDV à {selectedZoneForAssign.nom_zone}
            </h2>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pdvs.filter((pdv: PDV) => pdv.zone_geofence_id !== selectedZoneForAssign.id).map((pdv: PDV) => (
                <button
                  key={pdv.id}
                  onClick={() => handleAssignSubmit(pdv.id)}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded border border-gray-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{pdv.nom_pdv}</p>
                    <p className="text-sm text-gray-500">{pdv.msisdn_responsable}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-primary-600" />
                </button>
              ))}
              
              {pdvs.filter((pdv: PDV) => pdv.zone_geofence_id !== selectedZoneForAssign.id).length === 0 && (
                <p className="text-gray-500 text-center py-4">Tous les PDV sont déjà assignés à cette zone</p>
              )}
            </div>
            
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedZoneForAssign(null);
              }}
              className="w-full mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeofenceZones;
