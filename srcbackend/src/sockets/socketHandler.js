const logger = require('../utils/logger');
const geofencingService = require('../services/geofencingService');

let ioInstance = null;

const socketHandler = (io) => {
  ioInstance = io;
  geofencingService.setIo(io);

  io.on('connection', (socket) => {
    logger.info(`Client connecté: ${socket.id}`);

    // Join a room for PDV updates
    socket.on('join-pdv-updates', (pdvId) => {
      socket.join(`pdv-${pdvId}`);
      logger.info(`Socket ${socket.id} joint pdv-${pdvId}`);
    });

    // Leave a room
    socket.on('leave-pdv-updates', (pdvId) => {
      socket.leave(`pdv-${pdvId}`);
      logger.info(`Socket ${socket.id} a quitté pdv-${pdvId}`);
    });

    // Handle position updates emitted directly via socket (ex: app mobile
    // connectée en socket plutôt qu'en REST). Nom d'événement aligné sur
    // 'position_update', celui utilisé par la carte de suivi côté frontend
    // (auparavant 'position-update' avec un tiret, jamais reçu). Diffusion
    // globale plutôt qu'à une room 'pdv-{id}' : le frontend ne rejoint aucune
    // room, donc un envoi scopé à une room n'était jamais reçu non plus.
    socket.on('position_update', async (data) => {
      try {
        const { pdv_id, latitude, longitude, precision, horodatage } = data;

        io.emit('position_update', {
          pdv_id,
          latitude,
          longitude,
          precision,
          horodatage: horodatage || new Date()
        });

        logger.debug(`Position reçue pour PDV ${pdv_id}: ${latitude}, ${longitude}`);
      } catch (error) {
        logger.error('Erreur lors du traitement de la position:', error);
      }
    });

    // Pause/reprise du suivi demandée par un client (bouton play/pause de la
    // carte). On ne fait qu'acquitter pour l'instant : le filtrage réel se
    // fait côté client, mais avoir le handler évite un événement muet côté
    // serveur et laisse la porte ouverte à une vraie pause par client plus tard.
    socket.on('tracking:pause', () => {
      logger.debug(`Suivi mis en pause par ${socket.id}`);
    });

    socket.on('tracking:resume', () => {
      logger.debug(`Suivi repris par ${socket.id}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client déconnecté: ${socket.id}`);
    });
  });
};

const getIo = () => ioInstance;

module.exports = socketHandler;
module.exports.getIo = getIo;
