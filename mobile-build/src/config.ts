import { Platform } from 'react-native';

// Configuration de l'application mobile
// En web, l'app doit appeler localhost pour la machine hôte.
// Sur vrai téléphone connecté au même Wi‑Fi, utiliser l'IP locale du PC.
const apiBaseUrl = Platform.OS === 'web'
  ? 'http://localhost:3001/api'
  : 'http://10.199.199.116:3001/api';

export const CONFIG = {
  API_BASE_URL: apiBaseUrl,

  // NOTE: si tu changes de machine ou de point d'accès, remplace ici la bonne URL
  // API_BASE_URL: 'http://<TON_IP>:<PORT>/api',

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
