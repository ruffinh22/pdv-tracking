import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../contexts/authContext';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

type RequeteRejouable = InternalAxiosRequestConfig & { _retry?: boolean };

// Routes d'authentification : un 401 y est un vrai refus, jamais une expiration à réparer.
const ROUTES_AUTH = ['/auth/login', '/auth/refresh'];

// Une seule demande de rafraîchissement à la fois : toutes les requêtes qui expirent
// en même temps (le tableau de bord en lance plusieurs) attendent la même promesse.
let rafraichissementEnCours: Promise<string> | null = null;

async function rafraichirJeton(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('Aucun refresh token');

  // `axios` nu (sans nos intercepteurs) : évite toute boucle infinie sur /auth/refresh.
  const { data } = await axios.post('/api/auth/refresh', { refreshToken });
  localStorage.setItem('token', data.token);
  useAuthStore.setState({ token: data.token, isAuthenticated: true });
  return data.token as string;
}

function terminerSession(): void {
  useAuthStore.getState().logout();
  // Événement global : l'application navigue vers /login côté client (voir App.tsx).
  window.dispatchEvent(new CustomEvent('api:unauthorized'));
}

// Ajoute le jeton d'accès à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Sur 401 : tente un rafraîchissement silencieux du jeton, rejoue la requête une fois,
// et ne renvoie à la connexion qu'en cas d'échec définitif.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originale = error.config as RequeteRejouable | undefined;
    const statut = error.response?.status;

    if (statut !== 401 || !originale) return Promise.reject(error);

    const estRouteAuth = ROUTES_AUTH.some((r) => originale.url?.includes(r));
    if (estRouteAuth || originale._retry) {
      if (!estRouteAuth) terminerSession();
      return Promise.reject(error);
    }

    originale._retry = true;
    try {
      rafraichissementEnCours ??= rafraichirJeton().finally(() => {
        rafraichissementEnCours = null;
      });
      const nouveauJeton = await rafraichissementEnCours;
      originale.headers.Authorization = `Bearer ${nouveauJeton}`;
      return api(originale);
    } catch (refreshError) {
      terminerSession();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
