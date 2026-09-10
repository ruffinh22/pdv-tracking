const { Vente } = require('../models');
const logger = require('../utils/logger');
const geocodingService = require('../services/geocodingService');

const venteController = {
  // Route mobile sans auth
  async mobileCreateVente(req, res) {
    try {
      const { pdv_id, produit, nom_concessionnaire, nom_vendeur, contact_vendeur, latitude_saisie, longitude_saisie, horodatage, montant } = req.body;
      
      logger.info('Données reçues:', req.body);
      
      // Obtenir les informations de localisation via géocodage
      let locationInfo = {
        ville: '',
        commune: '',
        localite: '',
        quartier: '',
        pays: '',
        code_postal: ''
      };
      
      if (latitude_saisie && longitude_saisie) {
        try {
          locationInfo = await geocodingService.reverseGeocode(latitude_saisie, longitude_saisie);
          logger.info('Géocodage réussi:', locationInfo);
        } catch (error) {
          logger.error('Erreur lors du géocodage:', error);
        }
      }
      
      const vente = await Vente.create({
        pdv_id,
        produit,
        nom_concessionnaire,
        nom_vendeur,
        contact_vendeur,
        latitude_saisie: latitude_saisie || req.body.latitude,
        longitude_saisie: longitude_saisie || req.body.longitude,
        horodatage: horodatage || new Date(),
        montant: montant || 0,
        ville: locationInfo.ville,
        commune: locationInfo.commune,
        localite: locationInfo.localite,
        quartier: locationInfo.quartier,
        pays: locationInfo.pays,
        code_postal: locationInfo.code_postal
      });
      
      logger.info(`Nouvelle vente mobile créée: ${vente.id}`);
      res.status(201).json(vente);
    } catch (error) {
      logger.error('Erreur lors de la création de la vente mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createVente(req, res) {
    try {
      const vente = await Vente.create(req.body);
      logger.info(`Nouvelle vente créée: ${vente.id}`);
      res.status(201).json(vente);
    } catch (error) {
      logger.error('Erreur lors de la création de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllVentes(req, res) {
    try {
      const ventes = await Vente.findAll({ include: ['pdv'] });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getVenteById(req, res) {
    try {
      const vente = await Vente.findByPk(req.params.id, { include: ['pdv'] });
      if (!vente) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      res.json(vente);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateVente(req, res) {
    try {
      const vente = await Vente.findByPk(req.params.id);
      if (!vente) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      await vente.update(req.body);
      res.json(vente);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deleteVente(req, res) {
    try {
      const vente = await Vente.findByPk(req.params.id);
      if (!vente) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      await vente.destroy();
      res.json({ message: 'Vente supprimée avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createBatchVentes(req, res) {
    try {
      const { ventes } = req.body;
      const createdVentes = await Vente.bulkCreate(ventes);
      logger.info(`${createdVentes.length} ventes créées en batch`);
      res.status(201).json(createdVentes);
    } catch (error) {
      logger.error('Erreur lors de la création en batch des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = venteController;
