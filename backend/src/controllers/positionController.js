const { Position, PDV } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const geofencingService = require('../services/geofencingService');
const { pdvScope, peutAccederAuPDV } = require('../utils/scope');
const { getIo } = require('../sockets/socketHandler');

// Diffuse une position nouvellement enregistrée à tous les clients connectés
// (carte de suivi en temps réel). Sans cet appel, les positions sont bien
// stockées en base mais jamais poussées en direct au frontend : c'était la
// cause principale du "temps réel" non fonctionnel.
const broadcastPosition = async (position, pdv = null) => {
  const io = getIo();
  if (!io) return;
  const pointDeVente = pdv || await PDV.findByPk(position.pdv_id);
  if (!pointDeVente) return;
  const rooms = [
    'role-admin',
    pointDeVente.commercial_id && `user-${pointDeVente.commercial_id}`,
    pointDeVente.superviseur_id && `user-${pointDeVente.superviseur_id}`,
    pointDeVente.chef_zone_id && `user-${pointDeVente.chef_zone_id}`,
    pointDeVente.agence_id && `agence-${pointDeVente.agence_id}`,
  ].filter(Boolean);
  if (!rooms.length) return;
  io.to(rooms).emit('position_update', {
    pdv_id: position.pdv_id,
    latitude: position.latitude,
    longitude: position.longitude,
    precision: position.precision,
    horodatage: position.horodatage,
  });
};

const precisionValide = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const precision = Number(valeur);
  return Number.isFinite(precision) && precision >= 0 ? precision : null;
};

const positionController = {
  // Route mobile sans auth
  async mobileCreatePosition(req, res) {
    try {
      const { client_event_id, pdv_id, latitude, longitude, precision, horodatage } = req.body || {};
      const pdvId = Number(req.mobilePdvId || pdv_id);
      const lat = Number(latitude);
      const lng = Number(longitude);
      const date = horodatage ? new Date(horodatage) : new Date();

      if (!Number.isInteger(pdvId) || pdvId <= 0) {
        return res.status(400).json({ error: 'Identifiant PDV invalide' });
      }
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Coordonnées GPS invalides' });
      }
      if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 5 * 60_000) {
        return res.status(400).json({ error: 'Horodatage GPS invalide' });
      }
      if (client_event_id !== undefined &&
          (typeof client_event_id !== 'string' || client_event_id.length < 1 || client_event_id.length > 180)) {
        return res.status(400).json({ error: 'Identifiant de position invalide' });
      }

      const pdv = await PDV.findByPk(pdvId);
      if (!pdv) return res.status(404).json({ error: 'PDV non trouvé' });

      let position;
      try {
        position = await Position.create({
          client_event_id: client_event_id || null,
          pdv_id: pdvId,
          latitude: lat,
          longitude: lng,
          precision: precisionValide(precision),
          horodatage: date
        });
      } catch (error) {
        if (client_event_id && error?.name === 'SequelizeUniqueConstraintError') {
          const duplicate = await Position.findOne({ where: { client_event_id } });
          if (duplicate && Number(duplicate.pdv_id) === pdvId) {
            return res.status(200).json(duplicate);
          }
          if (duplicate) return res.status(409).json({ error: 'Identifiant de position déjà utilisé' });
        }
        throw error;
      }

      // Only advance the live marker for chronologically newer points. Old
      // offline backlog remains in history but cannot move the live map back.
      const [pdvMisAJour] = await PDV.update(
        {
          derniere_position_latitude: position.latitude,
          derniere_position_longitude: position.longitude,
          derniere_position_date: position.horodatage,
          derniere_position_precision: position.precision
        },
        {
          where: {
            id: pdvId,
            [Op.or]: [
              { derniere_position_date: null },
              { derniere_position_date: { [Op.lte]: position.horodatage } }
            ]
          }
        }
      );

      if (pdvMisAJour) {
        await geofencingService.checkAll(pdvId, position.latitude, position.longitude);
        await broadcastPosition(position, pdv);
      }

      logger.info(`Nouvelle position mobile créée: ${position.id}`);
      res.status(201).json(position);
    } catch (error) {
      logger.error('Erreur lors de la création de la position mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileCreatePositionsBatch(req, res) {
    try {
      const { pdv_id, positions } = req.body || {};
      const pdvId = Number(req.mobilePdvId || pdv_id);
      if (!Array.isArray(positions) || positions.length === 0 || positions.length > 25) {
        return res.status(400).json({ error: 'Le lot doit contenir entre 1 et 25 positions' });
      }

      const now = Date.now();
      const seen = new Set();
      const records = [];
      for (const point of positions) {
        const clientEventId = point?.client_event_id;
        const latitude = Number(point?.latitude);
        const longitude = Number(point?.longitude);
        const date = point?.horodatage ? new Date(point.horodatage) : null;
        if (typeof clientEventId !== 'string' || clientEventId.length < 1 || clientEventId.length > 180 || seen.has(clientEventId)) {
          return res.status(400).json({ error: 'Identifiant de position invalide ou dupliqué' });
        }
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          return res.status(400).json({ error: 'Coordonnées GPS invalides' });
        }
        if (!date || !Number.isFinite(date.getTime()) || date.getTime() > now + 5 * 60_000) {
          return res.status(400).json({ error: 'Horodatage GPS invalide' });
        }
        seen.add(clientEventId);
        records.push({
          client_event_id: clientEventId,
          pdv_id: pdvId,
          latitude,
          longitude,
          precision: precisionValide(point.precision),
          horodatage: date,
        });
      }

      const ids = records.map((position) => position.client_event_id);
      const existantes = await Position.findAll({
        where: { client_event_id: { [Op.in]: ids } },
        attributes: ['client_event_id', 'pdv_id'],
      });
      if (existantes.some((position) => Number(position.pdv_id) !== pdvId)) {
        return res.status(409).json({ error: 'Identifiant de position déjà utilisé' });
      }

      const dejaEnregistres = new Set(existantes.map((position) => position.client_event_id));
      const nouveaux = records.filter((position) => !dejaEnregistres.has(position.client_event_id));
      if (nouveaux.length === 0) {
        return res.json({ accepted: ids, inserted: 0 });
      }

      await Position.bulkCreate(nouveaux, { ignoreDuplicates: true });
      const enregistres = await Position.findAll({
        where: { client_event_id: { [Op.in]: nouveaux.map((position) => position.client_event_id) } },
        order: [['horodatage', 'ASC']],
      });
      if (enregistres.some((position) => Number(position.pdv_id) !== pdvId)) {
        return res.status(409).json({ error: 'Identifiant de position déjà utilisé' });
      }

      for (const position of enregistres) {
        if (!dejaEnregistres.has(position.client_event_id)) {
          await geofencingService.checkAll(pdvId, position.latitude, position.longitude);
        }
      }

      const dernierePosition = enregistres.reduce((latest, position) =>
        new Date(position.horodatage).getTime() > new Date(latest.horodatage).getTime() ? position : latest
      );
      const [pdvMisAJour] = await PDV.update(
        {
          derniere_position_latitude: dernierePosition.latitude,
          derniere_position_longitude: dernierePosition.longitude,
          derniere_position_date: dernierePosition.horodatage,
          derniere_position_precision: dernierePosition.precision,
        },
        {
          where: {
            id: pdvId,
            [Op.or]: [
              { derniere_position_date: null },
              { derniere_position_date: { [Op.lte]: dernierePosition.horodatage } },
            ],
          },
        }
      );
      if (pdvMisAJour) await broadcastPosition(dernierePosition);

      logger.info(`Lot de ${enregistres.length} positions mobiles traité pour PDV ${pdvId}`);
      return res.status(201).json({ accepted: ids, inserted: enregistres.length });
    } catch (error) {
      logger.error('Erreur lors de la synchronisation en lot des positions mobiles:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
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
          derniere_position_date: position.horodatage,
          derniere_position_precision: position.precision
        },
        { where: { id: position.pdv_id } }
      );

      // Vérifier le geofencing et l'activité suspecte (>500m de la position initiale)
      await geofencingService.checkAll(position.pdv_id, position.latitude, position.longitude);

      await broadcastPosition(position);

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
      const limitDemande = Number.parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitDemande) && limitDemande > 0
        ? Math.min(limitDemande, 2000)
        : 500;
      const positions = await Position.findAll({
        where: { pdv_id: req.params.pdvId },
        order: [['horodatage', 'DESC']],
        limit,
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
            derniere_position_date: position.horodatage,
            derniere_position_precision: position.precision
          },
          { where: { id: position.pdv_id } }
        );
        await geofencingService.checkAll(position.pdv_id, position.latitude, position.longitude);
        await broadcastPosition(position);
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