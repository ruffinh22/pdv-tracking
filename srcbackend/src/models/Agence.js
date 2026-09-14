const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Agence = sequelize.define('Agence', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_agence: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true
  },
  ville: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif'),
    allowNull: false,
    defaultValue: 'actif'
  }
}, {
  tableName: 'agences',
  indexes: [
    { fields: ['nom_agence'] },
    { fields: ['statut'] }
  ]
});

module.exports = Agence;
