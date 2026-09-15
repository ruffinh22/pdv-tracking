const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Valeur d'un attribut personnalisé pour un PDV donné.
 *
 * La valeur est stockée en TEXT sérialisé plutôt qu'en colonnes typées : le
 * schéma des attributs est piloté par l'admin à l'exécution, on ne peut donc
 * pas connaître les types à l'avance. Le contrôleur se charge de la
 * (dé)sérialisation en s'appuyant sur `PdvAttribut.type`.
 */
const PdvAttributValeur = sequelize.define('PdvAttributValeur', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pdv_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pdv', key: 'id' }
  },
  attribut_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pdv_attributs', key: 'id' }
  },
  valeur: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'pdv_attribut_valeurs',
  indexes: [
    { unique: true, fields: ['pdv_id', 'attribut_id'], name: 'pdv_attribut_valeurs_unique' },
    { fields: ['attribut_id'] }
  ]
});

module.exports = PdvAttributValeur;
