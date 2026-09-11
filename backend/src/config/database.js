const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = process.env.DB_DIALECT === 'sqlite'
  ? new Sequelize({
      dialect: 'sqlite',
      storage: process.env.DB_STORAGE || ':memory:',
      logging: false,
      define: {
        timestamps: true,
        underscored: true,
        createdAt: 'date_creation',
        updatedAt: 'date_modification'
      }
    })
  : new Sequelize(
  process.env.DB_NAME || 'tracking_pdv',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'date_creation',
      updatedAt: 'date_modification'
    }
  }
);

// Test de connexion
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connexion à la base de données MySQL établie avec succès');
    return true;
  } catch (error) {
    logger.error('Impossible de se connecter à la base de données:', error);
    return false;
  }
};

module.exports = { sequelize, testConnection };
