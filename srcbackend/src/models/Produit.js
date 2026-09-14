const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Produit = sequelize.define('Produit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_produit: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prix_unitaire: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  categorie: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif'),
    allowNull: false,
    defaultValue: 'actif'
  },
  date_creation: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  date_modification: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'produits',
  indexes: [
    { fields: ['nom_produit'] },
    { fields: ['categorie'] },
    { fields: ['statut'] }
  ]
});

module.exports = Produit;