const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Table de liaison many-to-many : un PDV (terminal) peut vendre plusieurs types de produits.
const PDVProduit = sequelize.define('PDVProduit', {
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
  produit_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'produits',
      key: 'id'
    }
  }
}, {
  tableName: 'pdv_produits',
  indexes: [
    { fields: ['pdv_id'] },
    { fields: ['produit_id'] },
    { unique: true, fields: ['pdv_id', 'produit_id'] }
  ]
});

module.exports = PDVProduit;
