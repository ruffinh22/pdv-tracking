// Types et interfaces communs entre le backend, frontend et mobile

// ==================== User ====================
export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: 'admin' | 'superviseur' | 'commercial';
  statut: 'actif' | 'inactif';
  telephone?: string;
  date_creation: string;
  date_modification: string;
}

// ==================== PDV ====================
export interface PDV {
  id: number;
  nom_pdv: string;
  msisdn_responsable: string;
  latitude_creation: number;
  longitude_creation: number;
  date_installation_app: string;
  statut: 'actif' | 'inactif' | 'suspendu';
  zone_geofence_id?: number;
  device_info?: Record<string, any>;
  derniere_position_latitude?: number;
  derniere_position_longitude?: number;
  derniere_position_date?: string;
  date_creation: string;
  date_modification: string;
}

// ==================== Position ====================
export interface Position {
  id: number;
  pdv_id: number;
  latitude: number;
  longitude: number;
  precision?: number;
  horodatage: string;
  source: 'gps' | 'network' | 'passive';
  date_creation: string;
  date_modification: string;
}

// ==================== Vente ====================
export interface Vente {
  id: number;
  pdv_id: number;
  produit: string;
  nom_concessionnaire: string;
  nom_vendeur: string;
  contact_vendeur: string;
  latitude_saisie: number;
  longitude_saisie: number;
  horodatage: string;
  statut_sync: 'synchronise' | 'en_attente' | 'erreur';
  montant?: number;
  quantite?: number;
  date_creation: string;
  date_modification: string;
}

// ==================== Geofence Zone ====================
export interface GeofenceZone {
  id: number;
  nom_zone: string;
  type: 'cercle' | 'polygone';
  coordonnees: GeoJSON;
  rayon?: number;
  date_creation: string;
  cree_par?: number;
  statut: 'actif' | 'inactif';
  couleur: string;
  date_modification: string;
}

// ==================== Alerte ====================
export interface Alerte {
  id: number;
  pdv_id: number;
  zone_id: number;
  type_alerte: 'sortie_zone' | 'entree_zone' | 'deplacement_anormal';
  latitude: number;
  longitude: number;
  horodatage: string;
  statut: 'traitee' | 'non_traitee' | 'en_cours';
  traitee_par?: number;
  date_traitement?: string;
  commentaire?: string;
  notification_envoyee: boolean;
  date_creation: string;
  date_modification: string;
}

// ==================== Produit ====================
export interface Produit {
  id: number;
  nom_produit: string;
  categorie?: string;
  description?: string;
  prix_unitaire?: number;
  statut: 'actif' | 'inactif';
  date_creation: string;
  date_modification: string;
}

// ==================== GeoJSON Types ====================
export interface GeoJSON {
  type: 'Feature' | 'FeatureCollection' | 'Polygon' | 'Point';
  coordinates?: number[][] | number[][][];
  features?: GeoJSONFeature[];
  geometry?: GeoJSONGeometry;
  properties?: Record<string, any>;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface GeoJSONGeometry {
  type: 'Polygon' | 'Point' | 'Circle';
  coordinates?: number[][] | number[][][];
  center?: number[];
  radius?: number;
}

// ==================== API Response ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== Auth ====================
export interface LoginRequest {
  email: string;
  mot_de_passe: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'mot_de_passe'>;
}

export interface RegisterRequest {
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe: string;
  role?: 'admin' | 'superviseur' | 'commercial';
}

// ==================== Dashboard ====================
export interface KPIs {
  pdv_actifs: number;
  ventes_aujourdhui: number;
  alertes_actives: number;
  taux_couverture?: number;
}

// ==================== WebSocket Events ====================
export interface SocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface PositionUpdateEvent extends SocketEvent {
  type: 'position-update';
  data: {
    pdv_id: number;
    latitude: number;
    longitude: number;
    precision?: number;
  };
}

export interface AlerteEvent extends SocketEvent {
  type: 'alerte';
  data: {
    type_alerte: 'sortie_zone' | 'entree_zone' | 'deplacement_anormal';
    pdv_id: number;
    pdv_nom: string;
    zone_nom: string;
    latitude: number;
    longitude: number;
    horodatage: string;
  };
}
