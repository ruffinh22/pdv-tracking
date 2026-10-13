/**
 * Clé API Google Maps JavaScript (utilisée par toutes les cartes de
 * l'application : suivi temps réel, détail PDV, zones de géofencing).
 *
 * Mise en place :
 * 1. Créez un projet sur https://console.cloud.google.com/, activez
 *    "Maps JavaScript API" et créez une clé API (Credentials > Create
 *    credentials > API key).
 * 2. Restreignez impérativement cette clé : "Application restrictions" >
 *    HTTP referrers (vos domaines, ex. https://votre-domaine.ci/*,
 *    http://localhost:5173/* en dev) — une clé non restreinte peut être
 *    réutilisée par n'importe qui qui l'extrait du code source servi au
 *    navigateur.
 * 3. En développement, créez un fichier `.env.local` à la racine du dossier
 *    frontend (à côté de package.json) contenant :
 *      VITE_GOOGLE_MAPS_API_KEY=votre_cle_ici
 *    En production, définissez la même variable d'environnement au moment
 *    du build (Vite inline les variables VITE_* à la compilation).
 */
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Style de carte neutre (gris clair, peu de bruit visuel) proche du fond de
 * carte Esri utilisé auparavant, pour que les marqueurs colorés (statut PDV,
 * zones de géofencing) restent le point focal.
 */
export const GOOGLE_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9ccd1' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3e5e8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0ece3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e3f0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
