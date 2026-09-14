const { Vente, PDV } = require('../models');
const logger = require('../utils/logger');
const geocodingService = require('../services/geocodingService');
const { pdvScope, peutAccederAuPDV } = require('../utils/scope');

const venteController = {
  /**
   * Historique des ventes d'un PDV, pour re-remplir la base locale du mobile
   * après une déconnexion/purge (aucune auth admin requise, comme les autres
   * routes /mobile/*, identifiées uniquement par pdv_id). Limité et indexé sur
   * pdv_id + horodatage pour rester rapide même avec beaucoup d'historique.
   */
  async mobileGetHistory(req, res) {
    try {
      const pdvId = parseInt(req.params.pdvId, 10);
      if (!pdvId) {
        return res.status(400).json({ error: 'pdv_id invalide' });
      }
      const limit = Math.min(parseInt(req.query.limit, 10) || 300, 500);

      const ventes = await Vente.findAll({
        where: { pdv_id: pdvId },
        order: [['horodatage', 'DESC']],
        limit,
        attributes: [
          'id', 'produit', 'nom_concessionnaire', 'nom_vendeur', 'contact_vendeur',
          'montant', 'latitude_saisie', 'longitude_saisie', 'horodatage',
        ],
      });

      res.json({ data: ventes });
    } catch (error) {
      logger.error('Erreur récupération historique mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

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
      const pdv = await PDV.findByPk(req.body.pdv_id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const vente = await Vente.create(req.body);
      logger.info(`Nouvelle vente créée: ${vente.id}`);
      res.status(201).json(vente);
    } catch (error) {
      logger.error('Erreur lors de la création de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Périmètre de données : chaque rôle ne voit que les ventes des PDV de son espace.
  async getAllVentes(req, res) {
    try {
      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;
      const ventes = await Vente.findAll({
        include: [{ model: PDV, as: 'pdv', where: scoped ? scope : undefined, required: scoped }]
      });
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
      if (!peutAccederAuPDV(req.user, vente.pdv)) {
        return res.status(403).json({ error: 'Cette vente ne fait pas partie de votre périmètre' });
      }
      res.json(vente);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la vente:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateVente(req, res) {
    try {
      const vente = await Vente.findByPk(req.params.id, { include: ['pdv'] });
      if (!vente) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      if (!peutAccederAuPDV(req.user, vente.pdv)) {
        return res.status(403).json({ error: 'Cette vente ne fait pas partie de votre périmètre' });
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
      const vente = await Vente.findByPk(req.params.id, { include: ['pdv'] });
      if (!vente) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      if (!peutAccederAuPDV(req.user, vente.pdv)) {
        return res.status(403).json({ error: 'Cette vente ne fait pas partie de votre périmètre' });
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
      const pdvIds = [...new Set((ventes || []).map(v => v.pdv_id).filter(Boolean))];
      const pdvs = await PDV.findAll({ where: { id: pdvIds } });
      const pdvById = new Map(pdvs.map(p => [p.id, p]));

      const horsPerimetre = pdvIds.filter(id => !peutAccederAuPDV(req.user, pdvById.get(id)));
      if (horsPerimetre.length > 0) {
        return res.status(403).json({ error: 'Certains PDV ne font pas partie de votre périmètre', pdv_ids: horsPerimetre });
      }

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