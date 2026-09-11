// Configuration de l'application mobile
// Modifiez API_BASE_URL selon votre environnement (IP locale en dev, domaine en prod).

export const CONFIG = {
  API_BASE_URL: 'http://10.0.2.15:3001/api',

  // NOTE: mis à jour automatiquement par l'agent pour le développement local
  // Remplace par l'IP de ta machine si besoin
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
