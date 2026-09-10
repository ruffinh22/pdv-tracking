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

    // Handle position updates from mobile
    socket.on('position-update', async (data) => {
      try {
        const { pdv_id, latitude, longitude, precision } = data;

        // Broadcast to all clients in the PDV room
        io.to(`pdv-${pdv_id}`).emit('position-update', {
          pdv_id,
          latitude,
          longitude,
          precision,
          timestamp: new Date()
        });

        logger.debug(`Position reçue pour PDV ${pdv_id}: ${latitude}, ${longitude}`);
      } catch (error) {
        logger.error('Erreur lors du traitement de la position:', error);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client déconnecté: ${socket.id}`);
    });
  });
};

const getIo = () => ioInstance;

module.exports = socketHandler;
module.exports.getIo = getIo;
