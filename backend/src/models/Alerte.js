const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alerte = sequelize.define('Alerte', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pdv_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'pdv',
      key: 'id'
    }
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  type_alerte: {
    type: DataTypes.ENUM('sortie_zone', 'entree_zone', 'deplacement_anormal'),
    allowNull: false
  },
  distance_metres: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Distance en mètres par rapport à la position de référence (position initiale ou zone)'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  horodatage: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  statut: {
    type: DataTypes.ENUM('traitee', 'non_traitee', 'en_cours'),
    allowNull: false,
    defaultValue: 'non_traitee'
  },
  traitee_par: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date_traitement: {
    type: DataTypes.DATE,
    allowNull: true
  },
  commentaire: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notification_envoyee: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'alertes',
  indexes: [
    { fields: ['pdv_id'] },
    { fields: ['zone_id'] },
    { fields: ['statut'] },
    { fields: ['horodatage'] },
    { fields: ['type_alerte'] }
  ]
});

module.exports = Alerte;
