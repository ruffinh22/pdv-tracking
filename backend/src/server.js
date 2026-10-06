require('dotenv').config();

// Les secrets JWT sont indispensables : on échoue tôt avec un message clair plutôt
// que de lever « secretOrPrivateKey must have a value » à la première connexion.
['JWT_SECRET', 'JWT_REFRESH_SECRET'].forEach((cle) => {
  if (!process.env[cle]) {
    console.error(`[config] Variable d'environnement manquante : ${cle}. Vérifiez backend/.env`);
    process.exit(1);
  }
});
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import des configurations
const { sequelize } = require('./config/database');
const { runMigrations } = require('./database/runMigrations');
const logger = require('./utils/logger');
const socketHandler = require('./sockets/socketHandler');
const { demarrerPurgePeriodique } = require('./services/positionRetentionService');
const { demarrerReveilPeriodique } = require('./services/reveilService');

// Import des routes
const authRoutes = require('./routes/auth');
const pdvRoutes = require('./routes/pdv');
const venteRoutes = require('./routes/vente');
const positionRoutes = require('./routes/position');
const geofenceRoutes = require('./routes/geofence');
const alerteRoutes = require('./routes/alerte');
const userRoutes = require('./routes/user');
const dashboardRoutes = require('./routes/dashboard');
const produitRoutes = require('./routes/produit');
const agenceRoutes = require('./routes/agence');
const pdvAttributRoutes = require('./routes/pdvAttribut');
const pdvChampFixeRoutes = require('./routes/pdvChampFixe');

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082'];

const app = express();
const server = http.createServer(app);

// Derrière un reverse proxy / load balancer (Nginx, Render, Heroku, etc.) : nécessaire
// pour que express-rate-limit et req.ip reflètent la vraie IP du client, et pour que
// les cookies "secure" fonctionnent correctement derrière un TLS terminé en amont.
app.set('trust proxy', 1);

// Configuration Socket.IO
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- Sécurité ---------------------------------------------------------
// CSP explicite plutôt que désactivée : on autorise précisément les domaines
// nécessaires à la carte (tuiles OpenStreetMap + Nominatim) et au websocket Socket.IO
// (polices et CSS Leaflet sont auto-hébergés dans le bundle), sans ouvrir la politique en grand.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://*.arcgisonline.com',
        ],
        connectSrc: [
          "'self'",
          'https://nominatim.openstreetmap.org',
          'ws:',
          'wss:',
          ...FRONTEND_ORIGINS,
        ],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  })
);

// Limitation de taux (API uniquement)
// - Plafond généreux sur l'API : un tableau de bord enchaîne plusieurs appels par page
//   et un réseau partagé (Wi-Fi d'une salle) expose une seule IP.
// - Plafond strict sur /auth/login (anti brute-force) ; seules les tentatives échouées comptent.
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000,
  skip: (req) => req.originalUrl.split('?')[0] === '/api/positions/mobile/create',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);

// Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Routes API ---------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/pdv', pdvRoutes);
app.use('/api/ventes', venteRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/alertes', alerteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/agences', agenceRoutes);
app.use('/api/pdv-attributs', pdvAttributRoutes);
app.use('/api/pdv-champs-fixes', pdvChampFixeRoutes);

// Routes de santé (déclarées avant le fallback statique pour ne jamais être masquées par lui)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, timestamp: new Date().toISOString() });
});

// --- Frontend statique ---------------------------------------------------------
// Chemin configurable (utile si l'arborescence de déploiement diffère du monorepo local),
// avec repli sur les emplacements usuels pour rester tolérant aux différentes structures.
const candidateDistPaths = [
  process.env.FRONTEND_DIST_PATH && path.resolve(process.env.FRONTEND_DIST_PATH),
  path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'public'),
].filter(Boolean);

const frontendDist = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (frontendDist) {
  logger.info(`Frontend servi depuis : ${frontendDist}`);

  // Assets hashés (JS/CSS/images) générés par Vite : cache long terme, immuable.
  app.use(
    express.static(frontendDist, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // Fallback SPA : toute route non-API renvoie index.html (React Router gère la navigation côté client).
  app.get('/*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  logger.warn(
    `Frontend introuvable dans : ${candidateDistPaths.join(', ')} — as-tu lancé "yarn build" côté frontend ? ` +
      'Le serveur ne servira que l\'API. Tu peux aussi fixer FRONTEND_DIST_PATH dans le .env.'
  );
}

// Gestion des erreurs 404 (API uniquement à ce stade, le frontend a déjà son propre fallback ci-dessus)
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error(err.stack);
  const status = err.status || 500;
  // Les erreurs 5xx (SQL, bibliothèques…) ne doivent jamais fuiter vers le client en production.
  const message = status >= 500 && NODE_ENV === 'production'
    ? 'Erreur serveur interne'
    : err.message || 'Erreur serveur interne';
  res.status(status).json({
    error: message,
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Socket.IO handler
socketHandler(io);

// --- Démarrage ---------------------------------------------------------
async function startServer() {
  try {
    await runMigrations();
    await sequelize.sync();
    logger.info('Base de données synchronisée avec succès');

    // Fenêtre glissante sur l'historique de positions : sans elle, la table
    // `positions` croît indéfiniment (un point toutes les 30 s par terminal).
    demarrerPurgePeriodique();
    demarrerReveilPeriodique();
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
      logger.info(`Environnement: ${NODE_ENV}`);
    });
  } catch (err) {
    logger.error('Erreur de synchronisation de la base de données:', err);
    process.exit(1);
  }
}

startServer();

// Arrêt propre (containers, PM2, systemd, Ctrl+C…) : on laisse les requêtes en cours
// se terminer et on ferme proprement la connexion à la base avant de quitter.
const shutdown = (signal) => {
  logger.info(`Signal ${signal} reçu, arrêt en cours...`);
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Connexions fermées proprement. Bye.');
      process.exit(0);
    } catch (err) {
      logger.error('Erreur lors de la fermeture:', err);
      process.exit(1);
    }
  });
  // Filet de sécurité si une connexion refuse de se fermer
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = { app, server, io };
