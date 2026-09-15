const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  prenom: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  mot_de_passe: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'superviseur', 'commercial', 'chef_zone', 'agence'),
    allowNull: false,
    defaultValue: 'commercial'
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif'),
    allowNull: false,
    defaultValue: 'actif'
  },
  // Numéro matricule de l'agent. C'est l'identifiant que l'agent commercial
  // saisit sur l'app mobile pour enrôler un PDV : il relie le dossier créé
  // sur le terrain au compte qui pourra le compléter depuis le back-office.
  matricule: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true
  },
  telephone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  // Renseigné uniquement pour les comptes de rôle 'agence' : détermine l'agence
  // à laquelle l'utilisateur est rattaché, et donc le périmètre de ses données.
  agence_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'agences',
      key: 'id'
    }
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['email'] },
    { fields: ['matricule'] },
    { fields: ['role'] },
    { fields: ['statut'] },
    { fields: ['agence_id'] }
  ]
});

module.exports = User;