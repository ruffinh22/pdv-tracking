const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PDV = sequelize.define('PDV', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Identité principale du PDV depuis l'enrôlement mobile : identifiant unique
  // et stable du terminal, généré par l'app à la première installation. C'est
  // la clé d'idempotence de /pdv/mobile/enroll — un même terminal qui se
  // reconnecte retombe toujours sur le même dossier PDV.
  id_terminal: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: 'Identifiant unique du terminal (installation app), clé d\'enrôlement mobile'
  },
  nom_pdv: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  // Devenu optionnel : le MSISDN n'est plus saisi à l'enrôlement (c'est
  // l'id_terminal qui identifie l'appareil). Il reste renseignable par
  // l'agent commercial lors de la complétion du dossier sur le web.
  msisdn_responsable: {
    type: DataTypes.STRING(20),
    allowNull: true,
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

  // --- Cycle de vie du dossier -------------------------------------------
  // 'brouillon' : créé par l'app mobile (terminal + GPS uniquement)
  // 'complet'   : l'agent commercial a renseigné la fiche depuis le web
  statut_dossier: {
    type: DataTypes.ENUM('brouillon', 'complet'),
    allowNull: false,
    defaultValue: 'brouillon'
  },
  // Matricule saisi sur le mobile au moment de l'enrôlement. Conservé tel quel
  // (en plus de commercial_id) pour garder la trace de qui a posé le terminal,
  // même si le compte utilisateur est plus tard renommé ou supprimé.
  matricule_agent: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  date_completion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  complete_par: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
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
    { fields: ['statut'] },
    { fields: ['statut_dossier'] },
    { fields: ['matricule_agent'] },
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

