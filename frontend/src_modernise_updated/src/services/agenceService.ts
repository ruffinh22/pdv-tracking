import api from './api';

export interface Agence {
  id: number;
  nom_agence: string;
  ville?: string;
  statut: 'actif' | 'inactif';
}

export const agenceService = {
  getAllAgences: async (page: number = 1, limit: number = 10) => {
    const response = await api.get('/agences', { params: { page, limit } });
    return response.data;
  },

  getAllAgencesList: async (): Promise<Agence[]> => {
    const response = await api.get('/agences', { params: { all: true } });
    return response.data;
  },

  getAgenceById: async (id: number): Promise<Agence> => {
    const response = await api.get(`/agences/${id}`);
    return response.data;
  },

  createAgence: async (agence: Partial<Agence>): Promise<Agence> => {
    const response = await api.post('/agences', agence);
    return response.data;
  },

  updateAgence: async (id: number, agence: Partial<Agence>): Promise<Agence> => {
    const response = await api.put(`/agences/${id}`, agence);
    return response.data;
  },

  deleteAgence: async (id: number): Promise<void> => {
    await api.delete(`/agences/${id}`);
  }
};