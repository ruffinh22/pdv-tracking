import api from './api';

/**
 * Réglage d'un champ FIXE de la fiche PDV — une vraie colonne du modèle PDV
 * (ou la relation "produits"), pas un attribut personnalisé (voir
 * pdvAttributService pour ceux-là). L'admin peut changer `libelle`,
 * `obligatoire` et `visible`, mais ne peut ni créer ni supprimer de ligne :
 * la liste est câblée côté serveur.
 */
export interface PdvChampFixe {
  id: number;
  code: string;
  libelle: string;
  obligatoire: boolean;
  visible: boolean;
}

export const pdvChampFixeService = {
  getAll: async (): Promise<PdvChampFixe[]> => {
    try {
      const response = await api.get('/pdv-champs-fixes');
      if (response?.data && response.data.code === 403) {
        console.warn('Accès interdit à /pdv-champs-fixes (body.code=403)');
        return [];
      }
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.data?.code === 403) {
        console.warn('Accès interdit à /pdv-champs-fixes (HTTP 403)');
        return [];
      }
      if (err?.response?.status === 429) {
        console.warn('Trop de requêtes reçues pour /pdv-champs-fixes (HTTP 429) — renvoi d\'un tableau vide');
        return [];
      }
      throw err;
    }
  },

  update: async (
    code: string,
    data: Partial<Pick<PdvChampFixe, 'libelle' | 'obligatoire' | 'visible'>>
  ): Promise<PdvChampFixe> => {
    const response = await api.put(`/pdv-champs-fixes/${code}`, data);
    return response.data;
  },
};
