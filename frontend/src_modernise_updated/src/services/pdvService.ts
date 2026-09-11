import api from './api';

export interface Agence {
  id: number;
  nom_agence: string;
  ville?: string;
  statut: 'actif' | 'inactif';
}

export interface PersonneRef {
  id: number;
  nom: string;
  prenom: string;
}

export interface ProduitRef {
  id: number;
  nom_produit: string;
}

export interface PDV {
  id: number;
  id_terminal?: string;
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

  // Tagging
  concessionnaire_nom?: string;
  vendeur_nom?: string;
  contact_vendeur?: string;

  // Localisation
  pays?: string;
  ville?: string;
  commune?: string;
  quartier?: string;

  // Hiérarchie (référentiels)
  agence_id?: number;
  commercial_id?: number;
  superviseur_id?: number;
  chef_zone_id?: number;
  agence?: Agence;
  commercial?: PersonneRef;
  superviseur?: PersonneRef;
  chefZone?: PersonneRef;

  // Produits vendus (choix multiples)
  produits?: ProduitRef[];
  produits_ids?: number[];

  zone?: any;
  positions?: any[];
  ventes?: any[];
  alertes?: any[];
}

export interface PDVFilters {
  statut?: string;
  ville?: string;
  commune?: string;
  quartier?: string;
  pays?: string;
  agence_id?: number;
  commercial_id?: number;
  superviseur_id?: number;
  chef_zone_id?: number;
  produit_id?: number;
  search?: string;
}

export const pdvService = {
  getAllPDVs: async (page: number = 1, limit: number = 10, filters: PDVFilters = {}) => {
    const response = await api.get('/pdv', { params: { page, limit, ...filters } });
    return response.data;
  },

  getAllPDVsNoPagination: async (filters: PDVFilters = {}) => {
    const response = await api.get('/pdv', { params: { page: 1, limit: 1000, ...filters } });
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

  updatePDVProduits: async (id: number, produits_ids: number[]): Promise<PDV> => {
    const response = await api.put(`/pdv/${id}/produits`, { produits_ids });
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