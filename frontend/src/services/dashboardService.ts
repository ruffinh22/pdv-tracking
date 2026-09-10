import api from './api';

export interface KPIs {
  pdv_actifs: number;
  ventes_aujourdhui: number;
  alertes_actives: number;
}

export const dashboardService = {
  getKPIs: async (): Promise<KPIs> => {
    const response = await api.get('/dashboard/kpi');
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
