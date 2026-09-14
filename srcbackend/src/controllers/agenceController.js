const { Agence } = require('../models');
const logger = require('../utils/logger');

const agenceController = {
  async createAgence(req, res) {
    try {
      const agence = await Agence.create(req.body);
      logger.info(`Nouvelle agence créée: ${agence.nom_agence}`);
      res.status(201).json(agence);
    } catch (error) {
      logger.error('Erreur lors de la création de l\'agence:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Liste des agences. Supporte la pagination classique (page/limit) pour
  // l'écran de gestion (réservé à l'admin), et le mode complet (?all=true)
  // pour alimenter les listes déroulantes du formulaire de tagging PDV
  // (ouvert à tous les rôles authentifiés).
  async getAllAgences(req, res) {
    try {
      if (req.query.all === 'true') {
        const agences = await Agence.findAll({
          where: { statut: 'actif' },
          order: [['nom_agence', 'ASC']]
        });
        return res.json(agences);
      }

      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: agences } = await Agence.findAndCountAll({
        order: [['nom_agence', 'ASC']],
        limit,
        offset
      });

      res.json({
        data: agences,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des agences:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAgenceById(req, res) {
    try {
      const agence = await Agence.findByPk(req.params.id);
      if (!agence) {
        return res.status(404).json({ error: 'Agence non trouvée' });
      }
      res.json(agence);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'agence:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateAgence(req, res) {
    try {
      const agence = await Agence.findByPk(req.params.id);
      if (!agence) {
        return res.status(404).json({ error: 'Agence non trouvée' });
      }
      await agence.update(req.body);
      res.json(agence);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'agence:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deleteAgence(req, res) {
    try {
      const agence = await Agence.findByPk(req.params.id);
      if (!agence) {
        return res.status(404).json({ error: 'Agence non trouvée' });
      }
      await agence.update({ statut: 'inactif' });
      res.json({ message: 'Agence désactivée avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la désactivation de l\'agence:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = agenceController;