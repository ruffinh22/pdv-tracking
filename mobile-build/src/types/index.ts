/**
 * L'application mobile tague et suit des points de vente : elle n'enregistre
 * aucune transaction. Les types Vente / VenteInput / Produit et tout ce qui
 * touchait aux montants ont été retirés — ils décrivaient des données que ni
 * l'app ni le backend n'ont vocation à produire ici.
 */

export interface PDV {
  id: number;
  nom_pdv: string;
  id_terminal?: string | null;
  msisdn_responsable?: string | null;
  latitude_creation: number;
  longitude_creation: number;
  statut: 'actif' | 'inactif' | 'suspendu';
  statut_dossier?: 'brouillon' | 'complet';
  derniere_position_latitude?: number | null;
  derniere_position_longitude?: number | null;
  derniere_position_date?: string | null;
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
}

/** Position enregistrée localement, en attente d'envoi au serveur. */
export interface PositionLocale {
  id: number;
  latitude: number;
  longitude: number;
  horodatage: string;
  precision: number | null;
  synchronise: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
