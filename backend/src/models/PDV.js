const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PDV = sequelize.define('PDV', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_pdv: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  msisdn_responsable: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  latitude_creation: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude_creation: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  date_installation_app: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif', 'suspendu'),
    allowNull: false,
    defaultValue: 'actif'
  },
  zone_geofence_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'geofence_zones',
      key: 'id'
    }
  },
  device_info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  derniere_position_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  derniere_position_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  derniere_position_date: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'pdv',
  indexes: [
    { fields: ['msisdn_responsable'] },
    { fields: ['statut'] },
    { fields: ['zone_geofence_id'] }
  ]
});

module.exports = PDV;
