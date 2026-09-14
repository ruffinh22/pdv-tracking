const { Position, PDV } = require('../models');
const logger = require('../utils/logger');
const geofencingService = require('../services/geofencingService');
const { pdvScope, peutAccederAuPDV } = require('../utils/scope');
const { getIo } = require('../sockets/socketHandler');

// Diffuse une position nouvellement enregistrée à tous les clients connectés
// (carte de suivi en temps réel). Sans cet appel, les positions sont bien
// stockées en base mais jamais poussées en direct au frontend : c'était la
// cause principale du "temps réel" non fonctionnel.
const broadcastPosition = (position) => {
  const io = getIo();
  if (!io) return;
  io.emit('position_update', {
    pdv_id: position.pdv_id,
    latitude: position.latitude,
    longitude: position.longitude,
    horodatage: position.horodatage,
  });
};

const positionController = {
  // Route mobile sans auth
  async mobileCreatePosition(req, res) {
    try {
      const { pdv_id, latitude, longitude, horodatage } = req.body;
      
      const position = await Position.create({
        pdv_id,
        latitude,
        longitude,
        horodatage: horodatage || new Date()
      });

      // Mettre à jour la dernière position du PDV
      await PDV.update(
        {
          derniere_position_latitude: position.latitude,
          derniere_position_longitude: position.longitude,
          derniere_position_date: position.horodatage
        },
        { where: { id: position.pdv_id } }
      );

      // Vérifier le geofencing et l'activité suspecte (>500m de la position initiale)
      await geofencingService.checkAll(position.pdv_id, position.latitude, position.longitude);

      broadcastPosition(position);

      logger.info(`Nouvelle position mobile créée: ${position.id}`);
      res.status(201).json(position);
    } catch (error) {
      logger.error('Erreur lors de la création de la position mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createPosition(req, res) {
    try {
      const position = await Position.create(req.body);

      // Mettre à jour la dernière position du PDV
      await PDV.update(
        {
          derniere_position_latitude: position.latitude,
          derniere_position_longitude: position.longitude,
          derniere_position_date: position.horodatage
        },
        { where: { id: position.pdv_id } }
      );

      // Vérifier le geofencing et l'activité suspecte (>500m de la position initiale)
      await geofencingService.checkAll(position.pdv_id, position.latitude, position.longitude);

      broadcastPosition(position);

      logger.info(`Nouvelle position créée: ${position.id}`);
      res.status(201).json(position);
    } catch (error) {
      logger.error('Erreur lors de la création de la position:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Périmètre de données : chaque rôle ne voit que les positions des PDV de son espace.
  async getAllPositions(req, res) {
    try {
      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;
      const positions = await Position.findAll({
        include: [{ model: PDV, as: 'pdv', where: scoped ? scope : undefined, required: scoped }]
      });
      res.json(positions);
    } catch (error) {
      logger.error('Erreur lors de la récupération des positions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPositionById(req, res) {
    try {
      const position = await Position.findByPk(req.params.id, { include: ['pdv'] });
      if (!position) {
        return res.status(404).json({ error: 'Position non trouvée' });
      }
      if (!peutAccederAuPDV(req.user, position.pdv)) {
        return res.status(403).json({ error: 'Cette position ne fait pas partie de votre périmètre' });
      }
      res.json(position);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la position:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPositionsByPDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.pdvId);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const positions = await Position.findAll({
        where: { pdv_id: req.params.pdvId },
        order: [['horodatage', 'DESC']]
      });
      res.json(positions);
    } catch (error) {
      logger.error('Erreur lors de la récupération des positions du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createBatchPositions(req, res) {
    try {
      const { positions } = req.body;
      const createdPositions = await Position.bulkCreate(positions);

      // Mettre à jour la dernière position connue de chaque PDV + vérifications
      for (const position of createdPositions) {
        await PDV.update(
          {
            derniere_position_latitude: position.latitude,
            derniere_position_longitude: position.longitude,
            derniere_position_date: position.horodatage
          },
          { where: { id: position.pdv_id } }
        );
        await geofencingService.checkAll(position.pdv_id, position.latitude, position.longitude);
        broadcastPosition(position);
      }

      logger.info(`${createdPositions.length} positions créées en batch`);
      res.status(201).json(createdPositions);
    } catch (error) {
      logger.error('Erreur lors de la création en batch des positions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = positionController;