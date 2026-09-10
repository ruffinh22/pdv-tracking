const { GeofenceZone, PDV } = require('../models');
const logger = require('../utils/logger');

const geofenceController = {
  async createZone(req, res) {
    try {
      const zone = await GeofenceZone.create({
        ...req.body,
        cree_par: req.user.userId
      });
      logger.info(`Nouvelle zone géofence créée: ${zone.nom_zone}`);
      res.status(201).json(zone);
    } catch (error) {
      logger.error('Erreur lors de la création de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllZones(req, res) {
    try {
      const zones = await GeofenceZone.findAll({ include: ['pdvs'] });
      res.json(zones);
    } catch (error) {
      logger.error('Erreur lors de la récupération des zones:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getZoneById(req, res) {
    try {
      const zone = await GeofenceZone.findByPk(req.params.id, { include: ['pdvs'] });
      if (!zone) {
        return res.status(404).json({ error: 'Zone non trouvée' });
      }
      res.json(zone);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateZone(req, res) {
    try {
      const zone = await GeofenceZone.findByPk(req.params.id);
      if (!zone) {
        return res.status(404).json({ error: 'Zone non trouvée' });
      }
      await zone.update(req.body);
      res.json(zone);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deleteZone(req, res) {
    try {
      const zone = await GeofenceZone.findByPk(req.params.id);
      if (!zone) {
        return res.status(404).json({ error: 'Zone non trouvée' });
      }
      await zone.destroy();
      res.json({ message: 'Zone supprimée avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async assignPDVToZone(req, res) {
    try {
      const { pdvId } = req.body;
      const pdv = await PDV.findByPk(pdvId);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      await pdv.update({ zone_geofence_id: req.params.id });
      res.json({ message: 'PDV assigné à la zone avec succès' });
    } catch (error) {
      logger.error('Erreur lors de l\'assignation du PDV à la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async removePDVFromZone(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.pdvId);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      await pdv.update({ zone_geofence_id: null });
      res.json({ message: 'PDV retiré de la zone avec succès' });
    } catch (error) {
      logger.error('Erreur lors du retrait du PDV de la zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async checkPositionInZone(req, res) {
    try {
      const { latitude, longitude, zoneId } = req.body;
      const zone = await GeofenceZone.findByPk(zoneId);
      if (!zone) {
        return res.status(404).json({ error: 'Zone non trouvée' });
      }

      // Utiliser turf.js pour vérifier si le point est dans la zone
      const turf = require('@turf/turf');
      const point = turf.point([longitude, latitude]);
      const zoneGeoJSON = zone.coordonnees;

      const isInside = turf.booleanPointInPolygon(point, zoneGeoJSON);
      res.json({ isInside, zoneId });
    } catch (error) {
      logger.error('Erreur lors de la vérification de position:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = geofenceController;
