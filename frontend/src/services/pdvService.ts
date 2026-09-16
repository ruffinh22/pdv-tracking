import api from './api';

/**
 * Préfixe du nom provisoire posé par le serveur à l'enrôlement mobile. Le
 * back-office ne l'affiche jamais comme une saisie de l'agent : tant qu'il est
 * présent, le dossier compte comme « nom non renseigné ». Doit rester aligné
 * avec `PREFIXE_NOM_BROUILLON` du contrôleur backend.
 */
export const PREFIXE_NOM_BROUILLON = 'PDV (brouillon)';

export const estNomProvisoire = (nom?: string | null): boolean =>
  !nom || nom.trim() === '' || nom.startsWith(PREFIXE_NOM_BROUILLON);

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

import type { PdvAttributValorise } from './pdvAttributService';

export interface PDV {
  id: number;
  // Code métier lisible (ex: "PDV-000123"), généré côté serveur. Colonne
  // ID_unique du mapping standard partenaire.
  id_unique?: string;
  id_terminal?: string;
  // Colonne Type_Terminal du mapping ; pré-rempli à l'enrôlement mobile,
  // modifiable depuis le web.
  type_terminal?: string;
  nom_pdv: string;
  msisdn_responsable?: string;
  latitude_creation: number;
  longitude_creation: number;
  date_installation_app: string;
  statut: 'actif' | 'inactif' | 'suspendu';

  // Cycle de vie du dossier : 'brouillon' = enrôlé depuis le mobile (terminal
  // + GPS seulement), 'complet' = fiche renseignée depuis le back-office.
  statut_dossier: 'brouillon' | 'complet';
  matricule_agent?: string;
  date_completion?: string;
  complete_par?: number;

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
  // Colonnes sous-zone et ID_Distrib du mapping standard.
  sous_zone?: string;
  id_distributeur?: string;
  agence?: Agence;
  commercial?: PersonneRef;
  superviseur?: PersonneRef;
  chefZone?: PersonneRef;

  // Produits vendus (choix multiples)
  produits?: ProduitRef[];
  produits_ids?: number[];

  // Champs personnalisés définis par l'admin, avec leur valeur courante.
  // Renvoyés par getPDVById / completerPDV uniquement.
  attributs_personnalises?: PdvAttributValorise[];
  // Ce qu'il reste à renseigner pour que le dossier passe en 'complet'.
  informations_manquantes?: string[];

  zone?: any;
  positions?: any[];
  ventes?: any[];
  alertes?: any[];
}

export interface HistoriqueParams {
  /** Date ISO de début (défaut : il y a 24 h) */
  debut?: string;
  /** Date ISO de fin (défaut : maintenant) */
  fin?: string;
  /** Plafond de points renvoyés, entre 100 et 5000 (défaut : 1000) */
  limit?: number;
}

export interface PositionPDV {
  id: number;
  latitude: number;
  longitude: number;
  precision?: number;
  horodatage: string;
  source: 'gps' | 'network' | 'passive';
}

export interface HistoriquePositions {
  data: PositionPDV[];
  periode: { debut: string; fin: string };
  total: number;
  retournes: number;
  /** 1 = aucun échantillonnage ; n = un point sur n a été conservé */
  echantillonnage: number;
}

export interface TrajetPDV {
  pdv_id: number;
  periode: { debut: string; fin: string };
  points: number;
  distance_parcourue_m: number;
  eloignement_max_m: number;
  premiere_position: string | null;
  derniere_position: string | null;
  point_ancrage: { latitude: number; longitude: number };
}

export interface PDVFilters {
  statut?: string;
  statut_dossier?: 'brouillon' | 'complet';
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
    try {
      const response = await api.get('/pdv', { params: { page, limit, ...filters } });
      if (response?.data && response.data.code === 403) {
        console.warn('Accès interdit à /pdv (body.code=403)');
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.data?.code === 403) {
        console.warn('Accès interdit à /pdv (HTTP 403)');
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      if (err?.response?.status === 429) {
        console.warn('Trop de requêtes vers /pdv (HTTP 429) — renvoi page vide');
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      throw err;
    }
  },

  getAllPDVsNoPagination: async (filters: PDVFilters = {}) => {
    try {
      const response = await api.get('/pdv', { params: { page: 1, limit: 1000, ...filters } });
      if (response?.data && response.data.code === 403) {
        console.warn('Accès interdit à /pdv (body.code=403)');
        return { data: [] };
      }
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.data?.code === 403) {
        console.warn('Accès interdit à /pdv (HTTP 403)');
        return { data: [] };
      }
      if (err?.response?.status === 429) {
        console.warn('Trop de requêtes vers /pdv (HTTP 429) — renvoi d\'un tableau vide');
        return { data: [] };
      }
      throw err;
    }
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

  /**
   * Enregistre la complétion d'un dossier enrôlé depuis le mobile.
   *
   * `attributs` est un objet { code_attribut: valeur }. Le serveur décide seul
   * si le dossier bascule en 'complet' : on peut donc enregistrer un dossier
   * partiellement rempli sans perdre la saisie, il reste simplement en
   * brouillon et la réponse indique ce qui manque encore.
   */
  completerPDV: async (
    id: number,
    payload: Partial<PDV> & { attributs?: Record<string, unknown>; produits_ids?: number[] }
  ): Promise<PDV> => {
    const response = await api.put(`/pdv/${id}/completer`, payload);
    return response.data;
  },

  updatePDVProduits: async (id: number, produits_ids: number[]): Promise<PDV> => {
    const response = await api.put(`/pdv/${id}/produits`, { produits_ids });
    return response.data;
  },

  deletePDV: async (id: number): Promise<void> => {
    await api.delete(`/pdv/${id}`);
  },

  /**
   * Historique de positions. L'API borne la période (24 h par défaut) et
   * échantillonne au-delà de `limit` points : on récupère donc toujours une
   * réponse de taille raisonnable, quelle que soit l'ancienneté du PDV.
   * L'enveloppe est déballée ici pour rester compatible avec les appelants
   * existants, qui attendent un simple tableau.
   */
  getPDVPositions: async (id: number, params: HistoriqueParams = {}): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/positions`, { params });
    return Array.isArray(response.data) ? response.data : response.data?.data || [];
  },

  /** Même donnée, avec les métadonnées de période et d'échantillonnage. */
  getPDVHistorique: async (id: number, params: HistoriqueParams = {}): Promise<HistoriquePositions> => {
    const response = await api.get(`/pdv/${id}/positions`, { params });
    return response.data;
  },

  /** Synthèse du déplacement sur une période (distance, éloignement max). */
  getPDVTrajet: async (id: number, params: HistoriqueParams = {}): Promise<TrajetPDV> => {
    const response = await api.get(`/pdv/${id}/trajet`, { params });
    return response.data;
  },

  getPDVVentes: async (id: number): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/ventes`);
    return response.data;
  },

  getPDVAlertes: async (id: number): Promise<any[]> => {
    const response = await api.get(`/pdv/${id}/alertes`);
    return response.data;
  },

  /**
   * Déclenche le téléchargement de l'export CSV au format du mapping
   * standard partenaire (colonnes ID_unique, Pays, Ville... voir
   * Template_mapping.xlsx). Respecte le périmètre de données de l'utilisateur
   * connecté, comme la liste des PDV.
   */
  /**
   * Rejoue le géocodage inverse d'un dossier à partir de ses coordonnées
   * d'enrôlement. Utilisé quand le remplissage automatique a échoué sur le
   * terrain (service externe indisponible au moment de la pose).
   */
  regeocoderPDV: async (
    id: number,
    options: { force?: boolean } = {}
  ): Promise<PDV & { champs_remplis: string[]; message?: string }> => {
    const { data } = await api.post(`/pdv/${id}/geocoder`, { force: options.force === true });
    return data;
  },

  /**
   * Export CSV au format du mapping standard. Par défaut, seuls les dossiers
   * complets partent : un brouillon donnerait une ligne à trous une fois le
   * fichier sorti de la plateforme. Les colonnes sont désormais dynamiques
   * (champs fixes masqués retirés, attributs personnalisés actifs ajoutés) :
   * ce client n'a rien à savoir de la liste, il télécharge simplement ce que
   * le serveur a généré.
   */
  exportMapping: async (
    options: { statut_dossier?: 'complet' | 'tous' } = {}
  ): Promise<void> => {
    const response = await api.get('/pdv/export/mapping', {
      responseType: 'blob',
      params: { statut_dossier: options.statut_dossier || 'complet' },
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `export-pdv-mapping-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    window.URL.revokeObjectURL(url);
  }
};