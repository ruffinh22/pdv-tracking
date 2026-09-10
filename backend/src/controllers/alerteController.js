const { Alerte } = require('../models');
const logger = require('../utils/logger');

const alerteController = {
  async getAllAlertes(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: alertes } = await Alerte.findAndCountAll({
        include: ['pdv', 'zone'],
        limit,
        offset
      });

      res.json({
        data: alertes,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAlerteById(req, res) {
    try {
      const alerte = await Alerte.findByPk(req.params.id, { include: ['pdv', 'zone'] });
      if (!alerte) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }
      res.json(alerte);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'alerte:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async traiterAlerte(req, res) {
    try {
      const { commentaire } = req.body;
      const alerte = await Alerte.findByPk(req.params.id);
      if (!alerte) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }

      await alerte.update({
        statut: 'traitee',
        traitee_par: req.user.userId,
        date_traitement: new Date(),
        commentaire
      });

      logger.info(`Alerte traitée: ${alerte.id}`);
      res.json(alerte);
    } catch (error) {
      logger.error('Erreur lors du traitement de l\'alerte:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAlertesByPDV(req, res) {
    try {
      const alertes = await Alerte.findAll({
        where: { pdv_id: req.params.pdvId },
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAlertesByZone(req, res) {
    try {
      const alertes = await Alerte.findAll({
        where: { zone_id: req.params.zoneId },
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getStatistiquesPeriode(req, res) {
    try {
      const { debut, fin } = req.query;
      const alertes = await Alerte.findAll({
        where: {
          horodatage: {
            [require('sequelize').Op.between]: [debut, fin]
          }
        }
      });

      const stats = {
        total: alertes.length,
        traitees: alertes.filter(a => a.statut === 'traitee').length,
        non_traitees: alertes.filter(a => a.statut === 'non_traitee').length,
        par_type: alertes.reduce((acc, a) => {
          acc[a.type_alerte] = (acc[a.type_alerte] || 0) + 1;
          return acc;
        }, {})
      };

      res.json(stats);
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = alerteController;
