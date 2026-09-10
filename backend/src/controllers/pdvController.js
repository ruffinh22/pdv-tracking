const { PDV, Position, Vente, Alerte } = require('../models');
const logger = require('../utils/logger');

const pdvController = {
  // Routes mobiles sans auth
  async mobileRegister(req, res) {
    try {
      const { nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, device_info } = req.body;
      
      // Vérifier si le MSISDN existe déjà
      const existingPDV = await PDV.findOne({ where: { msisdn_responsable } });
      if (existingPDV) {
        return res.status(400).json({ error: 'Ce MSISDN est déjà enregistré' });
      }

      const pdv = await PDV.create({
        nom_pdv: nom_pdv || `PDV ${msisdn_responsable}`,
        msisdn_responsable,
        latitude_creation,
        longitude_creation,
        statut: 'actif',
        device_info,
        derniere_position_latitude: latitude_creation,
        derniere_position_longitude: longitude_creation,
        derniere_position_date: new Date()
      });

      logger.info(`Nouveau PDV mobile enregistré: ${pdv.nom_pdv} (${msisdn_responsable})`);
      res.status(201).json(pdv);
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement mobile du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileLogin(req, res) {
    try {
      const { msisdn } = req.body;
      
      const pdv = await PDV.findOne({ where: { msisdn_responsable: msisdn } });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }

      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la connexion mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createPDV(req, res) {
    try {
      const pdv = await PDV.create(req.body);
      logger.info(`Nouveau PDV créé: ${pdv.nom_pdv}`);
      res.status(201).json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la création du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllPDVs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: pdvs } = await PDV.findAndCountAll({
        include: ['zone', 'positions'],
        limit,
        offset
      });

      res.json({
        data: pdvs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVById(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id, {
        include: ['zone', 'positions', 'ventes', 'alertes']
      });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la récupération du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updatePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      await pdv.update(req.body);
      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deletePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      await pdv.destroy();
      res.json({ message: 'PDV supprimé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVPositions(req, res) {
    try {
      const positions = await Position.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(positions);
    } catch (error) {
      logger.error('Erreur lors de la récupération des positions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVVentes(req, res) {
    try {
      const ventes = await Vente.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVAlertes(req, res) {
    try {
      const alertes = await Alerte.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = pdvController;
