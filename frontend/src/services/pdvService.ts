import api from './api';

export interface PDV {
  id: number;
  nom_pdv: string;
  msisdn_responsable: string;
  latitude_creation: number;
  longitude_creation: number;
  date_installation_app: string;
  statut: 'actif' | 'inactif' | 'suspendu';
  zone_geofence_id?: number;
  device_info?: any;
  derniere_position_latitude?: number;
  derniere_position_longitude?: number;
  derniere_position_date?: string;
  zone?: any;
  positions?: any[];
  ventes?: any[];
  alertes?: any[];
}

export const pdvService = {
  getAllPDVs: async (page: number = 1, limit: number = 10) => {
    const response = await api.get('/pdv', { params: { page, limit } });
    return response.data;
  },

  getAllPDVsNoPagination: async () => {
    const response = await api.get('/pdv', { params: { page: 1, limit: 1000 } });
    return response.data;
  },

  getPDVById: async (id: number): Promise<PDV> => {
    const response = await api.get(`/pdv/${id}`);
    return response.data;
  },

  createPDV: async (pdv: Partial<PDV>): Promise<PDV> => {
    const response = await api.post('/pdv', pdv);
    return response.data;
  },

  updatePDV: async (id: number, pdv: Partial<PDV>): Promise<PDV> => {
    const response = await api.put(`/pdv/${id}`, pdv);
    return response.data;
  },

  deletePDV: async (id: number): Promise<void> => {
    await api.delete(`/pdv/${id}`);
  },

  getPDVPositions: async (id: number): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/positions`);
    return response.data;
  },

  getPDVVentes: async (id: number): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/ventes`);
    return response.data;
  },

  getPDVAlertes: async (id: number): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/alertes`);
    return response.data;
  }
};
