import axios from 'axios';
import { Platform } from 'react-native';
import { CONFIG } from '@/config';

export const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  // Défaut raisonnable pour les appels sans timeout explicite. Les opérations
  // qui doivent échouer vite (sync en arrière-plan, health-check) passent déjà
  // leur propre timeout plus court par appel — celui-ci n'est qu'un filet de
  // sécurité pour ne jamais laisser une requête pendre 15s+ sans retour.
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (Platform.OS !== 'web') {
    try {
      const SecureStore = require('expo-secure-store');
      const token = await SecureStore.getItemAsync('mobilePositionToken');
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
    } catch (error) {
      console.warn('[api] Lecture du jeton terminal impossible:', error);
    }
  }
  return config;
});

export default api;
