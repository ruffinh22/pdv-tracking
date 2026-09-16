import { Platform } from 'react-native';

// Configuration de l'application mobile
//
// L'URL de l'API est surchageable via la variable d'environnement
// EXPO_PUBLIC_API_URL (fichier .env, ou `EXPO_PUBLIC_API_URL=... npx expo start`)
// sans avoir à modifier ce fichier ni reconstruire l'app — pratique quand on
// change de réseau Wi‑Fi ou que l'IP du PC de dev change (cause la plus
// fréquente de "Impossible de créer votre compte" en environnement de dev).
//
// Sur le web, le navigateur tourne sur la même machine que le serveur : localhost suffit.
// Sur un vrai téléphone, il doit joindre l'IP locale du PC sur le même réseau Wi‑Fi.
// Adresse IP locale de la machine de développement utilisée par défaut
// (affichée par Metro). Vous pouvez aussi surcharger via
// `EXPO_PUBLIC_API_URL` pour éviter de modifier ce fichier.
const FALLBACK_LAN_IP = '10.161.58.116';

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' ? 'http://localhost:3001/api' : `http://${FALLBACK_LAN_IP}:3001/api`);

export const CONFIG = {
  API_BASE_URL: apiBaseUrl,

  LOCATION: {
    // Intervalle entre deux remontées de position en arrière-plan (ms)
    TRACKING_INTERVAL: 30000,
    // Déplacement minimal déclenchant une nouvelle remontée (m)
    TRACKING_DISTANCE: 5,
    TIMEOUT: 10000,
  },

  // Rayon d'alerte "sortie de zone" par défaut (aligné sur le moteur de geofencing backend)
  GEOFENCE_DEFAULT_RADIUS_METERS: 500,

  SYNC: {
    AUTO_SYNC_INTERVAL_SECONDS: 300,
    MAX_RETRY_ATTEMPTS: 3,
  },

  DB: {
    NAME: 'trackingpdv.db',
  },

  NOTIFICATIONS: {
    TRACKING_TITLE: 'Tracking PDV actif',
    TRACKING_MESSAGE: 'Votre position est enregistrée en arrière-plan pour la couverture terrain.',
  },
};

export default CONFIG;
