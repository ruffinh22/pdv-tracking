import api from './api';

export type PdvAttributType =
  | 'texte'
  | 'texte_long'
  | 'nombre'
  | 'booleen'
  | 'date'
  | 'liste'
  | 'liste_multiple'
  | 'telephone'
  | 'email';

export const TYPE_LABELS: Record<PdvAttributType, string> = {
  texte: 'Texte court',
  texte_long: 'Texte long',
  nombre: 'Nombre',
  booleen: 'Oui / Non',
  date: 'Date',
  liste: 'Liste (choix unique)',
  liste_multiple: 'Liste (choix multiples)',
  telephone: 'Téléphone',
  email: 'Email',
};

/** Définition d'un champ personnalisé, administrée par l'admin. */
export interface PdvAttribut {
  id: number;
  code: string;
  libelle: string;
  type: PdvAttributType;
  options?: string[];
  obligatoire: boolean;
  groupe: string;
  aide?: string | null;
  ordre: number;
  actif: boolean;
}

/** Définition + valeur courante, telle que renvoyée sur la fiche d'un PDV. */
export interface PdvAttributValorise extends Omit<PdvAttribut, 'actif'> {
  valeur: string | number | boolean | string[] | null;
}

export const pdvAttributService = {
  getAll: async (seulementActifs = false): Promise<PdvAttribut[]> => {
    const response = await api.get('/pdv-attributs', {
      params: seulementActifs ? { actif: 'true' } : {},
    });
    return response.data;
  },

  create: async (attribut: Partial<PdvAttribut>): Promise<PdvAttribut> => {
    const response = await api.post('/pdv-attributs', attribut);
    return response.data;
  },

  update: async (id: number, attribut: Partial<PdvAttribut>): Promise<PdvAttribut> => {
    const response = await api.put(`/pdv-attributs/${id}`, attribut);
    return response.data;
  },

  remove: async (id: number): Promise<{ valeurs_supprimees: number }> => {
    const response = await api.delete(`/pdv-attributs/${id}`);
    return response.data;
  },

  reorder: async (ordres: { id: number; ordre: number }[]): Promise<PdvAttribut[]> => {
    const response = await api.put('/pdv-attributs/reorder', { ordres });
    return response.data;
  },
};
