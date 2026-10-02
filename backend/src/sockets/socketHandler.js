const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const geofencingService = require('../services/geofencingService');
const { PDV } = require('../models');

let ioInstance = null;

const socketHandler = (io) => {
  ioInstance = io;
  geofencingService.setIo(io);

  // Authentification à la connexion : sans JWT valide, le socket est refusé.
  // Le jeton est relu à chaque (re)connexion côté client (auth en fonction).
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentification requise'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (error) {
      return next(new Error('Token invalide ou expiré'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connecté: ${socket.id} (user ${socket.user?.userId})`);
    socket.join(`user-${socket.user.userId}`);
    if (socket.user.role === 'admin') socket.join('role-admin');
    if (socket.user.role === 'agence' && socket.user.agence_id) {
      socket.join(`agence-${socket.user.agence_id}`);
    }

    // Les clients ne peuvent pas injecter de points directement par socket.
    // Les positions live sont diffusées uniquement par positionController après
    // authentification, validation, enregistrement et contrôle anti-retour.

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
