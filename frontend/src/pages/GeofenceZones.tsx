import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Layers, UserPlus, UserMinus, X } from 'lucide-react';
import { geofenceService, GeofenceZone } from '../services/geofenceService';
import { pdvService, PDV } from '../services/pdvService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import GeofenceZonesMap from '../components/GeofenceZonesMap';
import GeofenceZoneEditorMap from '../components/GeofenceZoneEditorMap';

const GeofenceZones = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);
  const [selectedZoneForAssign, setSelectedZoneForAssign] = useState<GeofenceZone | null>(null);
  const [highlightedZoneId, setHighlightedZoneId] = useState<number | null>(null);
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

    const isValidCercle =
      formData.type === 'cercle' &&
      formData.coordonnees?.type === 'Point' &&
      Array.isArray(formData.coordonnees.coordinates);
    const isValidPolygone =
      formData.type === 'polygone' &&
      formData.coordonnees?.type === 'Polygon' &&
      formData.coordonnees.coordinates?.[0]?.length >= 4;

    if (!isValidCercle && !isValidPolygone) {
      toast.error(
        formData.type === 'cercle'
          ? 'Cliquez sur la carte pour placer le centre de la zone'
          : 'Tracez au moins 3 sommets sur la carte pour définir le polygone'
      );
      return;
    }

    const zoneData = { ...formData };

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
    return <div className="flex items-center justify-center h-64 text-ink-400">Chargement...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Zones Geofence</h1>
          <p className="text-sm text-ink-500 mt-0.5">Gestion des zones géographiques et assignation des PDV</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Zone
        </button>
      </div>

      {zones && zones.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="h-80">
            <GeofenceZonesMap zones={zones} selectedZoneId={highlightedZoneId} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {zones?.map((zone) => (
          <div
            key={zone.id}
            className="card cursor-pointer transition-shadow hover:shadow-popover"
            onClick={() => setHighlightedZoneId(zone.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900 truncate">{zone.nom_zone}</h3>
                  <p className="text-xs text-ink-400 capitalize">{zone.type}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(zone); }}
                  className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(zone.id); }}
                  className="btn-icon hover:text-danger-600 hover:bg-danger-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center text-ink-600">
                <MapPin className="w-4 h-4 mr-2 text-ink-400" />
                <span>{zone.type === 'cercle' ? `Rayon: ${zone.rayon}m` : 'Polygone'}</span>
              </div>
              <div className="text-ink-600">
                PDV assignés: <span className="font-medium text-ink-900">{zone.pdvs?.length || 0}</span>
              </div>
              <div className="text-ink-400 text-xs">
                Créée le: {new Date(zone.date_creation).toLocaleDateString()}
              </div>
            </div>

            <div className="border-t border-ink-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink-700">PDV dans cette zone</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAssignPDV(zone); }}
                  className="btn-icon w-8 h-8 hover:text-primary-600 hover:bg-primary-50"
                  title="Assigner un PDV"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              
              {zone.pdvs && zone.pdvs.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {zone.pdvs.map((pdv: any) => (
                    <div key={pdv.id} className="flex items-center justify-between text-sm bg-ink-50 px-3 py-2 rounded-lg">
                      <span className="text-ink-700 truncate">{pdv.nom_pdv}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePDV(zone.id, pdv.id); }}
                        className="p-1 hover:bg-danger-50 rounded text-danger-500 shrink-0"
                        title="Retirer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-400 italic">Aucun PDV assigné</p>
              )}
            </div>
          </div>
        ))}

        {zones?.length === 0 && (
          <div className="card col-span-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6 text-ink-300" />
            </div>
            <p className="text-ink-500">Aucune zone géofence créée</p>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="label">Nom de la zone</label>
                  <input
                    type="text"
                    value={formData.nom_zone}
                    onChange={(e) => setFormData({ ...formData, nom_zone: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Type de zone</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any, coordonnees: {} })}
                    className="input"
                  >
                    <option value="cercle">Cercle</option>
                    <option value="polygone">Polygone</option>
                  </select>
                </div>
                {formData.type === 'cercle' && (
                  <div>
                    <label className="label">Rayon (mètres)</label>
                    <input
                      type="number"
                      value={formData.rayon}
                      onChange={(e) => setFormData({ ...formData, rayon: parseInt(e.target.value) })}
                      className="input"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="label">
                    {formData.type === 'cercle' ? 'Placer le centre de la zone' : 'Tracer le contour du polygone'}
                  </label>
                  <GeofenceZoneEditorMap
                    key={formData.type}
                    type={formData.type}
                    coordonnees={formData.coordonnees}
                    rayon={formData.rayon}
                    onChange={(coordonnees) => setFormData((prev) => ({ ...prev, coordonnees }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
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
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                Assigner un PDV à {selectedZoneForAssign.nom_zone}
              </h2>
              <button
                onClick={() => { setShowAssignModal(false); setSelectedZoneForAssign(null); }}
                className="btn-icon"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pdvs.filter((pdv: PDV) => pdv.zone_geofence_id !== selectedZoneForAssign.id).map((pdv: PDV) => (
                <button
                  key={pdv.id}
                  onClick={() => handleAssignSubmit(pdv.id)}
                  className="w-full text-left p-3 hover:bg-ink-50 rounded-lg border border-ink-100 flex items-center justify-between transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 truncate">{pdv.nom_pdv}</p>
                    <p className="text-sm text-ink-400 truncate">{pdv.msisdn_responsable}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-primary-600 shrink-0 ml-2" />
                </button>
              ))}
              
              {pdvs.filter((pdv: PDV) => pdv.zone_geofence_id !== selectedZoneForAssign.id).length === 0 && (
                <p className="text-ink-400 text-center py-4 text-sm">Tous les PDV sont déjà assignés à cette zone</p>
              )}
            </div>
            
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedZoneForAssign(null);
              }}
              className="btn btn-secondary w-full mt-4"
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