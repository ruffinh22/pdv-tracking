import api from './api';

export interface GeofenceZone {
  id: number;
  nom_zone: string;
  type: 'cercle' | 'polygone';
  coordonnees: any;
  rayon?: number;
  cree_par: number;
  date_creation: string;
  pdvs?: any[];
}

export const geofenceService = {
  getAllZones: async (): Promise<GeofenceZone[]> => {
    const response = await api.get('/geofence');
    return response.data;
  },

  getZoneById: async (id: number): Promise<GeofenceZone> => {
    const response = await api.get(`/geofence/${id}`);
    return response.data;
  },

  createZone: async (zone: Partial<GeofenceZone>): Promise<GeofenceZone> => {
    const response = await api.post('/geofence', zone);
    return response.data;
  },

  updateZone: async (id: number, zone: Partial<GeofenceZone>): Promise<GeofenceZone> => {
    const response = await api.put(`/geofence/${id}`, zone);
    return response.data;
  },

  deleteZone: async (id: number): Promise<void> => {
    await api.delete(`/geofence/${id}`);
  },

  assignPDVToZone: async (zoneId: number, pdvId: number): Promise<void> => {
    await api.post(`/geofence/${zoneId}/assign-pdv`, { pdvId });
  },

  removePDVFromZone: async (zoneId: number, pdvId: number): Promise<void> => {
    await api.delete(`/geofence/${zoneId}/remove-pdv/${pdvId}`);
  },

  checkPositionInZone: async (latitude: number, longitude: number, zoneId: number): Promise<{ isInside: boolean; zoneId: number }> => {
    const response = await api.post('/geofence/check-position', { latitude, longitude, zoneId });
    return response.data;
  }
};
