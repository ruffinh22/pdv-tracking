import api from './api';

export interface Alerte {
  id: number;
  pdv_id: number;
  zone_id?: number;
  type_alerte: string;
  description: string;
  horodatage: string;
  statut: 'non_traitee' | 'traitee';
  pdv?: any;
  zone?: any;
}

export const alerteService = {
  getAllAlertes: async (page: number = 1, limit: number = 10) => {
    const response = await api.get('/alertes', { params: { page, limit } });
    return response.data;
  },

  getAlerteById: async (id: number): Promise<Alerte> => {
    const response = await api.get(`/alertes/${id}`);
    return response.data;
  },

  createAlerte: async (alerte: Partial<Alerte>): Promise<Alerte> => {
    const response = await api.post('/alertes', alerte);
    return response.data;
  },

  traiterAlerte: async (id: number): Promise<void> => {
    await api.put(`/alertes/${id}/traiter`);
  },

  getAlertesByPDV: async (pdvId: number): Promise<Alerte[]> => {
    const response = await api.get(`/alertes/pdv/${pdvId}`);
    return response.data;
  },

  getAlertesByZone: async (zoneId: number): Promise<Alerte[]> => {
    const response = await api.get(`/alertes/zone/${zoneId}`);
    return response.data;
  }
};
