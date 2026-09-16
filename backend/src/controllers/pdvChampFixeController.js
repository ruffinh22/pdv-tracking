const pdvChampFixeService = require('../services/pdvChampFixeService');
const logger = require('../utils/logger');

const pdvChampFixeController = {
  /**
   * Liste complète des champs fixes et de leur réglage courant. Lecture
   * ouverte à tous les rôles authentifiés : le formulaire de complétion en a
   * besoin pour savoir quels champs afficher et lesquels sont obligatoires,
   * pas seulement l'admin.
   */
  async getAll(req, res) {
    try {
      const champs = await pdvChampFixeService.getAll();
      res.json(champs);
    } catch (error) {
      logger.error('Erreur lors de la récupération des champs fixes PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Modifie le libellé, le caractère obligatoire ou la visibilité d'un champ
   * fixe. Réservé à l'admin (voir la route). Pas de création ni de
   * suppression : la liste des champs fixes est câblée dans le code.
   */
  async update(req, res) {
    try {
      const { libelle, obligatoire, visible } = req.body;
      const champ = await pdvChampFixeService.mettreAJour(req.params.code, {
        libelle,
        obligatoire,
        visible
      });
      logger.info(
        `Champ fixe PDV "${champ.code}" mis à jour par l'utilisateur ${req.user?.userId} — visible: ${champ.visible}, obligatoire: ${champ.obligatoire}`
      );
      res.json(champ);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      logger.error('Erreur lors de la mise à jour du champ fixe PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = pdvChampFixeController;
