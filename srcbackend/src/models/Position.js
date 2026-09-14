const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Position = sequelize.define('Position', {
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
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  precision: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  horodatage: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  source: {
    type: DataTypes.ENUM('gps', 'network', 'passive'),
    allowNull: false,
    defaultValue: 'gps'
  }
}, {
  tableName: 'positions',
  indexes: [
    { fields: ['pdv_id'] },
    { fields: ['horodatage'] }
  ]
});

module.exports = Position;
