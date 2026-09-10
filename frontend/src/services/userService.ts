import api from './api';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: 'admin' | 'superviseur' | 'commercial';
  statut: 'actif' | 'inactif';
  telephone?: string;
}

export const userService = {
  getAllUsers: async (page: number = 1, limit: number = 10) => {
    const response = await api.get('/users', { params: { page, limit } });
    return response.data;
  },

  getUserById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (user: Partial<User>): Promise<User> => {
    const response = await api.post('/users', user);
    return response.data;
  },

  updateUser: async (id: number, user: Partial<User>): Promise<User> => {
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
