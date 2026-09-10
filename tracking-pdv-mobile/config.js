// Configuration de l'application mobile
// Modifiez ces valeurs selon votre environnement

export const CONFIG = {
  // URL du backend API
  // Pour le développement local, utilisez l'IP de votre ordinateur
  // Pour trouver votre IP: ipconfig (Windows) ou ifconfig (Mac/Linux)
  API_BASE_URL: 'http://192.168.20.211:3001/api',
  
  // Configuration du tracking GPS
  LOCATION_CONFIG: {
    // Intervalle en millisecondes (30 secondes pour plus de précision)
    TRACKING_INTERVAL: 30000,
    // Distance en mètres (5 mètres pour détection de mouvement)
    TRACKING_DISTANCE: 5,
    // Précision GPS - HIGH pour une précision maximale
    ACCURACY: 'high', // 'high', 'balanced', 'low'
    // Options de précision supplémentaires
    HIGH_ACCURACY: true,
    // Timeout d'acquisition GPS (en millisecondes)
    TIMEOUT: 10000,
  },
  
  // Configuration de la synchronisation
  SYNC_CONFIG: {
    // Intervalle de synchronisation automatique (en secondes)
    AUTO_SYNC_INTERVAL: 300, // 5 minutes
    // Nombre maximum de tentatives de synchronisation
    MAX_RETRY_ATTEMPTS: 3,
    // Délai entre les tentatives (en secondes)
    RETRY_DELAY: 30,
  },
  
  // Configuration de la base de données
  DB_CONFIG: {
    NAME: 'trackingpdv.db',
    VERSION: 1,
  },
  
  // Configuration des notifications
  NOTIFICATION_CONFIG: {
    // Activer les notifications
    ENABLED: true,
    // Titre de la notification de tracking
    TRACKING_TITLE: 'Tracking PDV Actif',
    // Message de la notification de tracking
    TRACKING_MESSAGE: 'Votre position est enregistrée en arrière-plan',
  },
};

export default CONFIG;