const { Produit } = require('../models');
const logger = require('../utils/logger');

const produitController = {
  async createProduit(req, res) {
    try {
      const produit = await Produit.create(req.body);
      logger.info(`Nouveau produit créé: ${produit.id}`);
      res.status(201).json(produit);
    } catch (error) {
      logger.error('Erreur lors de la création du produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllProduits(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: produits } = await Produit.findAndCountAll({
        where: { statut: 'actif' },
        order: [['nom_produit', 'ASC']],
        limit,
        offset
      });

      res.json({
        data: produits,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des produits:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getProduitById(req, res) {
    try {
      const produit = await Produit.findByPk(req.params.id);
      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }
      res.json(produit);
    } catch (error) {
      logger.error('Erreur lors de la récupération du produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateProduit(req, res) {
    try {
      const produit = await Produit.findByPk(req.params.id);
      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }
      await produit.update(req.body);
      res.json(produit);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deleteProduit(req, res) {
    try {
      const produit = await Produit.findByPk(req.params.id);
      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }
      await produit.update({ statut: 'inactif' });
      res.json({ message: 'Produit désactivé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression du produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = produitController;