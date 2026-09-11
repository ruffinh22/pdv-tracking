export interface PDV {
  id: number;
  nom_pdv: string;
  msisdn_responsable: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: 'actif' | 'inactif' | 'suspendu';
  derniere_position_latitude?: number | null;
  derniere_position_longitude?: number | null;
  derniere_position_date?: string | null;
}

export interface Produit {
  id: number;
  nom_produit: string;
  categorie?: string | null;
  prix_unitaire?: number | string | null;
  statut?: string;
}

export interface VenteLocale {
  id: number;
  produit: string;
  nom_concessionnaire: string;
  nom_vendeur: string;
  contact_vendeur: string;
  montant: number;
  latitude: number;
  longitude: number;
  horodatage: string;
  statut: string;
  synchronise: number;
  pdv_id: number | null;
}

export interface VenteInput {
  produit: string;
  nom_concessionnaire: string;
  nom_vendeur: string;
  contact_vendeur: string;
  montant?: number;
  latitude: number;
  longitude: number;
  horodatage: string;
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
