const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vente = sequelize.define('Vente', {
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
  produit: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  nom_concessionnaire: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  nom_vendeur: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  contact_vendeur: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  latitude_saisie: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude_saisie: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  horodatage: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  statut_sync: {
    type: DataTypes.ENUM('synchronise', 'en_attente', 'erreur'),
    allowNull: false,
    defaultValue: 'synchronise'
  },
  montant: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ville: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  commune: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  localite: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  quartier: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  pays: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  code_postal: {
    type: DataTypes.STRING(20),
    allowNull: true
  }
}, {
  tableName: 'ventes',
  indexes: [
    { fields: ['pdv_id'] },
    { fields: ['horodatage'] },
    { fields: ['statut_sync'] },
    { fields: ['produit'] },
    { fields: ['ville'] },
    { fields: ['commune'] },
    { fields: ['localite'] }
  ]
});

module.exports = Vente;
