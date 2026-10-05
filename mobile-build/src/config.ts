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
    TRACKING_INTERVAL: 15000,
    // Déplacement minimal déclenchant une nouvelle remontée (m).
    // 0 = remontée purement périodique : avec un seuil de distance, un agent
    // immobile n'enverrait AUCUNE position et son PDV apparaîtrait « sans
    // position récente » sur la carte alors que tout fonctionne.
    TRACKING_DISTANCE: 0,
    TIMEOUT: 10000,
    // Battement de cœur : position envoyée même à l'arrêt, si rien n'a été
    // enregistré depuis HEARTBEAT_MIN_GAP_MS. Doit rester nettement sous le
    // seuil « position récente » du tableau de bord (2 min).
    HEARTBEAT_INTERVAL_MS: 30000,
    HEARTBEAT_MIN_GAP_MS: 25000,
    HEARTBEAT_FIX_TIMEOUT_MS: 10000,
    // Écart minimal entre deux enregistrements locaux (dédoublonne le suivi
    // d'arrière-plan et celui du premier plan, qui peuvent tourner ensemble).
    MIN_SAVE_GAP_MS: 8000,
    // Silence anormal du suivi (GPS actif, permissions OK) au-delà duquel la
    // tâche d'arrière-plan est redémarrée de force.
    SILENCE_REDEMARRAGE_MS: 90000,
    REDEMARRAGE_MIN_GAP_MS: 120000,
  },

  // Rayon d'alerte "sortie de zone" par défaut (aligné sur le moteur de geofencing backend)
  GEOFENCE_DEFAULT_RADIUS_METERS: 500,

  SYNC: {
    AUTO_SYNC_INTERVAL_SECONDS: 60,
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
