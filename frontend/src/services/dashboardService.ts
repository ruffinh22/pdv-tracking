import api from './api';

export type Periode = 'jour' | 'semaine' | 'mois' | 'all';
export type Dimension =
  | 'ville' | 'commune' | 'quartier' | 'pays'
  | 'agence' | 'commercial' | 'superviseur' | 'chef_zone';

export interface KPIs {
  total_pdv: number;
  pdv_actifs: number;
  pdv_tagues_aujourdhui: number;
  dossiers_brouillon: number;
  alertes_actives: number;
  pdv_vus_24h: number;
  pdv_muets: number;
  seuil_inactivite_heures: number;
}

export interface PDVStats {
  periode: Periode;
  tagues: number;
  actifs: number;
  inactifs: number;
  suspendus: number;
  complets: number;
  brouillons: number;
}

export interface AnalyseLigne {
  label: string;
  total: number;
  actifs: number;
  inactifs: number;
  complets: number;
  taux_completion: number;
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

export interface LigneRepartition {
  label: string;
  total: number;
}

export interface LigneDetailReporting {
  id: number;
  id_terminal: string | null;
  nom_pdv: string;
  statut: string;
  statut_dossier: string;
  date_tagging: string;
  derniere_position_date: string | null;
  muet: boolean;
  instru: boolean;
  pays: string | null;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  agence: string | null;
  commercial: string | null;
  superviseur: string | null;
  matricule_agent: string | null;
}

export interface ReportingSynthese {
  periode: string;
  intervalle: { debut: string | null; fin: string };
  seuil_inactivite_heures: number;
  enrolement: {
    base_totale: number;
    tagues_periode: number;
    part_de_la_base: number;
    actifs: number;
    inactifs: number;
    suspendus: number;
    courbe: { jour: string; total: number }[];
  };
  qualite_dossiers: {
    complets: number;
    brouillons: number;
    taux_completion: number;
  };
  activite_terrain: {
    positions_remontees: number;
    pdv_vus_24h: number;
    pdv_muets: number;
    jamais_vus: number;
    taux_couverture: number;
  };
  conformite: {
    total_alertes: number;
    instrus: number;
    pdv_concernes: number;
    taux_instrus: number;
    non_traitees: number;
    en_cours: number;
    traitees: number;
    distance_moyenne_m: number;
    distance_max_m: number;
    par_type: LigneRepartition[];
  };
  repartition: Record<
    'ville' | 'commune' | 'quartier' | 'agence' | 'commercial' | 'superviseur',
    LigneRepartition[]
  >;
  detail: LigneDetailReporting[];
  detail_tronque: boolean;
}

/** Bornes envoyées au backend : soit une période nommée, soit un intervalle explicite. */
export interface FiltrePeriode {
  periode?: Periode;
  debut?: string;
  fin?: string;
}

export const dashboardService = {
  getKPIs: async (): Promise<KPIs> => {
    const response = await api.get('/dashboard/kpi');
    return response.data;
  },

  /** Synthèse complète de la page Reporting, en un seul aller-retour. */
  getReporting: async (filtre: FiltrePeriode = {}): Promise<ReportingSynthese> => {
    const response = await api.get('/dashboard/reporting', { params: filtre });
    return response.data;
  },

  getPDVStats: async (periode: Periode = 'jour'): Promise<PDVStats> => {
    const response = await api.get('/dashboard/pdv-stats', { params: { periode } });
    return response.data;
  },

  getPDVParProduit: async (periode: Periode = 'all') => {
    const response = await api.get('/dashboard/pdv-par-produit', { params: { periode } });
    return response.data;
  },

  getRatioProduits: async (
    periode: Periode = 'all'
  ): Promise<{ total_pdv_tagues: number; produits: RatioProduit[] }> => {
    const response = await api.get('/dashboard/ratio-produits', { params: { periode } });
    return response.data;
  },

  getAnalyses: async (dimension: Dimension, periode: Periode = 'all'): Promise<AnalyseResponse> => {
    const response = await api.get('/dashboard/analyses', { params: { dimension, periode } });
    return response.data;
  },

  getInstrus: async (statut?: string, filtre: FiltrePeriode = {}): Promise<any[]> => {
    const response = await api.get('/dashboard/instrus', { params: { statut, ...filtre } });
    return response.data;
  },

  exportInstrusExcel: async (statut?: string, filtre: FiltrePeriode = {}): Promise<Blob> => {
    const response = await api.get('/dashboard/instrus/export', {
      params: { statut, ...filtre },
      responseType: 'blob'
    });
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

  getCouvertureGeographique: async (filtre: FiltrePeriode = {}): Promise<any> => {
    const response = await api.get('/dashboard/couverture', { params: filtre });
    return response.data;
  },

  exportExcel: async (filtre: FiltrePeriode = {}): Promise<Blob> => {
    const response = await api.get('/dashboard/export/excel', {
      params: filtre,
      responseType: 'blob'
    });
    return response.data;
  }
};

/**
 * Déclenche le téléchargement d'un blob côté navigateur. Factorisé ici parce
 * que chaque page ré-implémentait la même séquence createObjectURL / <a> /
 * revokeObjectURL — et oubliait souvent le revoke, ce qui retient le fichier
 * en mémoire tant que l'onglet est ouvert.
 */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  window.URL.revokeObjectURL(url);
}
