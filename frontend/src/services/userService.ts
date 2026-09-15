import api from './api';

export type UserRole = 'admin' | 'superviseur' | 'commercial' | 'chef_zone' | 'agence';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  statut: 'actif' | 'inactif';
  telephone?: string;
  // Identifiant que l'agent saisit sur l'app mobile pour enrôler un PDV.
  // Sans matricule, un compte ne peut pas être utilisé sur le terrain.
  matricule?: string;
  agence_id?: number;
}

export const userService = {
  getAllUsers: async (page: number = 1, limit: number = 10, role?: UserRole) => {
    const response = await api.get('/users', { params: { page, limit, role } });
    return response.data;
  },

  // Liste complète (sans pagination), utilisée pour alimenter les listes
  // déroulantes Commercial / Superviseur / Chef de zone du formulaire de tagging PDV.
  getUsersByRole: async (role: UserRole): Promise<User[]> => {
    const response = await api.get('/users', { params: { role, all: true } });
    return response.data;
  },

  getUserById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (user: Partial<User> & { mot_de_passe?: string }): Promise<User> => {
    const response = await api.post('/users', user);
    return response.data;
  },

  updateUser: async (id: number, user: Partial<User> & { mot_de_passe?: string }): Promise<User> => {
    const response = await api.put(`/users/${id}`, user);
    return response.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  updateUserStatus: async (id: number, statut: 'actif' | 'inactif'): Promise<User> => {
    const response = await api.put(`/users/${id}/statut`, { statut });
    return response.data;
  }
};