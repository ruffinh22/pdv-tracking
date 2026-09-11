const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PDV = sequelize.define('PDV', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_terminal: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Identifiant physique du terminal (si différent du MSISDN)'
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
  },

  // Informations de tagging (concessionnaire / vendeur)
  concessionnaire_nom: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  vendeur_nom: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  contact_vendeur: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  // Localisation administrative (renseignée manuellement ou via géocodage inverse)
  pays: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  ville: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  commune: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  quartier: {
    type: DataTypes.STRING(150),
    allowNull: true
  },

  // Hiérarchie commerciale (référentiels, plus de saisie libre)
  agence_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'agences',
      key: 'id'
    }
  },
  commercial_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  superviseur_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  chef_zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  cree_par: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'pdv',
  indexes: [
    { fields: ['msisdn_responsable'] },
    { fields: ['statut'] },
    { fields: ['zone_geofence_id'] },
    { fields: ['agence_id'] },
    { fields: ['commercial_id'] },
    { fields: ['superviseur_id'] },
    { fields: ['chef_zone_id'] },
    { fields: ['ville'] },
    { fields: ['commune'] },
    { fields: ['quartier'] }
  ]
});

module.exports = PDV;

