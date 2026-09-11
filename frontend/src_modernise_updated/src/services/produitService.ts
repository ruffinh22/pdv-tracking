import api from './api';

export const produitService = {
  getAllProduits: async (page: number = 1, limit: number = 10) => {
    const response = await api.get('/produits', { params: { page, limit } });
    return response.data;
  },

  getProduitById: async (id: number) => {
    const response = await api.get(`/produits/${id}`);
    return response.data;
  },

  createProduit: async (produit: any) => {
    const response = await api.post('/produits', produit);
    return response.data;
  },

  updateProduit: async (id: number, produit: any) => {
    const response = await api.put(`/produits/${id}`, produit);
    return response.data;
  },

  deleteProduit: async (id: number) => {
    const response = await api.delete(`/produits/${id}`);
    return response.data;
  },

  getProduitsList: async () => {
    const response = await api.get('/produits/list');
    return response.data;
  },

  // Liste complète (sans pagination), utilisée pour le multi-select "Type de produit vendu"
  getAllProduitsFull: async () => {
    const response = await api.get('/produits', { params: { all: true } });
    return response.data;
  }
};