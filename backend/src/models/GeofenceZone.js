const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GeofenceZone = sequelize.define('GeofenceZone', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_zone: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('cercle', 'polygone'),
    allowNull: false
  },
  coordonnees: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Coordonnées géographiques en format GeoJSON'
  },
  rayon: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Rayon en mètres pour les zones de type cercle'
  },
  date_creation: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  cree_par: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif'),
    allowNull: false,
    defaultValue: 'actif'
  },
  couleur: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: '#FF0000',
    comment: 'Code couleur hexadécimal pour l\'affichage sur la carte'
  }
}, {
  tableName: 'geofence_zones',
  indexes: [
    { fields: ['statut'] },
    { fields: ['type'] }
  ]
});

module.exports = GeofenceZone;
