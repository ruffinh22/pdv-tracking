import axios from 'axios';
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

export default api;
