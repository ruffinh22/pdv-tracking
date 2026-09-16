import { create } from 'zustand';

/**
 * Callbacks de purge enregistrés par l'application (voir App.tsx). Le store
 * d'authentification ne peut pas importer le QueryClient sans créer un cycle
 * d'imports, donc c'est l'application qui vient s'enregistrer ici.
 */
const purgeurs: Array<() => void> = [];

export function enregistrerPurgeSession(purge: () => void): void {
  purgeurs.push(purge);
}

function purgerSession(): void {
  for (const purge of purgeurs) {
    try {
      purge();
    } catch (error) {
      console.warn('[auth] Purge de session partielle:', error);
    }
  }
}

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  agence_id?: number | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  login: async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mot_de_passe: password }),
    });

    if (!response.ok) {
      throw new Error('Email ou mot de passe incorrect');
    }

    const data = await response.json();

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Le cache React Query survit au changement de compte : sans cette purge,
    // un utilisateur qui se connecte après un autre hérite des listes du
    // précédent (liste des PDV, référentiels...). Il voyait donc des PDV hors
    // de son périmètre, et tout clic dessus renvoyait un 403 du serveur —
    // lequel, lui, filtrait correctement.
    purgerSession();

    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Même raison qu'à la connexion : ne laisser aucune donnée du compte
    // sortant en mémoire pour le compte suivant.
    purgerSession();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
  setUser: (user: User) => set({ user }),
  setToken: (token: string) => set({ token }),
}));
