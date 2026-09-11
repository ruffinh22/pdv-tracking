import api from './api';

export interface KPIs {
  pdv_actifs: number;
  ventes_aujourdhui: number;
  alertes_actives: number;
}

export type Periode = 'jour' | 'semaine' | 'mois' | 'all';
export type Dimension = 'ville' | 'commune' | 'quartier' | 'pays' | 'agence' | 'commercial' | 'superviseur' | 'chef_zone';

export interface PDVStats {
  periode: Periode;
  tagues: number;
  actifs: number;
  inactifs: number;
  suspendus: number;
}

export interface AnalyseLigne {
  label: string;
  total: number;
  actifs: number;
  inactifs: number;
}

export interface AnalyseResponse {
  dimension: Dimension;
  libelle: string;
  periode: Periode;
  data: AnalyseLigne[];
}

export interface RatioProduit {
  produit_id: number;
  produit: string;
  total_pdv: number;
  pourcentage: number;
}

export const dashboardService = {
  getKPIs: async (): Promise<KPIs> => {
    const response = await api.get('/dashboard/kpi');
    return response.data;
  },

  // Point 5 : PDV tagués / actifs / inactifs sur une période glissante
  getPDVStats: async (periode: Periode = 'jour'): Promise<PDVStats> => {
    const response = await api.get('/dashboard/pdv-stats', { params: { periode } });
    return response.data;
  },

  // Point 5 : nombre de PDV tagués par type de produit vendu
  getPDVParProduit: async (periode: Periode = 'all') => {
    const response = await api.get('/dashboard/pdv-par-produit', { params: { periode } });
    return response.data;
  },

  // Point 5 : ratio de chaque produit vs la base totale de PDV tagués
  getRatioProduits: async (periode: Periode = 'all'): Promise<{ total_pdv_tagues: number; produits: RatioProduit[] }> => {
    const response = await api.get('/dashboard/ratio-produits', { params: { periode } });
    return response.data;
  },

  // Point 3 : analyses transverses (ville, commune, quartier, agence, commercial, superviseur, chef de zone)
  getAnalyses: async (dimension: Dimension, periode: Periode = 'all'): Promise<AnalyseResponse> => {
    const response = await api.get('/dashboard/analyses', { params: { dimension, periode } });
    return response.data;
  },

  // Point 6 : instrus (PDV ayant quitté leur zone/position initiale)
  getInstrus: async (statut?: string): Promise<any[]> => {
    const response = await api.get('/dashboard/instrus', { params: { statut } });
    return response.data;
  },

  exportInstrusExcel: async (statut?: string): Promise<Blob> => {
    const response = await api.get('/dashboard/instrus/export', {
      params: { statut },
      responseType: 'blob'
    });
    return response.data;
  },

  getVentesPeriode: async (debut: string, fin: string): Promise<any[]> => {
    const response = await api.get('/dashboard/ventes/periode', { params: { debut, fin } });
    return response.data;
  },

  getVentesParProduit: async (): Promise<any[]> => {
    const response = await api.get('/dashboard/ventes/produit');
    return response.data;
  },

  getVentesParZone: async (): Promise<any> => {
    const response = await api.get('/dashboard/ventes/zone');
    return response.data;
  },

  getPDVActifs: async (): Promise<any[]> => {
    const response = await api.get('/dashboard/pdv/actifs');
    return response.data;
  },

  getAlertesActives: async (): Promise<any[]> => {
    const response = await api.get('/dashboard/alertes/actives');
    return response.data;
  },

  getCouvertureGeographique: async (): Promise<any> => {
    const response = await api.get('/dashboard/couverture');
    return response.data;
  },

  exportExcel: async (debut?: string, fin?: string): Promise<Blob> => {
    const response = await api.get('/dashboard/export/excel', {
      params: { debut, fin },
      responseType: 'blob'
    });
    return response.data;
  }
};