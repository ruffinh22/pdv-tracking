import { create } from 'zustand';

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
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
    console.log('Tentative de connexion avec:', email);
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mot_de_passe: password }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error('Email ou mot de passe incorrect');
    }

    const data = await response.json();
    console.log('Login response:', data);

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
  setUser: (user: User) => set({ user }),
  setToken: (token: string) => set({ token }),
}));
