require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import des configurations
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');
const socketHandler = require('./sockets/socketHandler');

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

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Limitation de taux
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pdv', pdvRoutes);
app.use('/api/ventes', venteRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/alertes', alerteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produits', produitRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO handler
socketHandler(io);

// Synchronisation de la base de données et démarrage du serveur
const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: process.env.NODE_ENV === 'development' })
  .then(() => {
    logger.info('Base de données synchronisée avec succès');
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
      logger.info(`Environnement: ${process.env.NODE_ENV}`);
    });
  })
  .catch(err => {
    logger.error('Erreur de synchronisation de la base de données:', err);
    process.exit(1);
  });

module.exports = { app, server, io };
