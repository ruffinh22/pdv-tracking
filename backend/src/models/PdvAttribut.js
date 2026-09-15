const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Définition d'un attribut personnalisé de PDV.
 *
 * L'admin peut CRUD ces définitions depuis le back-office : chaque ligne
 * ajoutée ici fait apparaître automatiquement un champ supplémentaire dans le
 * formulaire de complétion du dossier PDV (côté web), sans redéploiement.
 * Les valeurs saisies sont stockées dans `pdv_attribut_valeurs`.
 */
const PdvAttribut = sequelize.define('PdvAttribut', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Clé technique stable (slug) utilisée par l'API et le front : ne devrait
  // plus changer une fois des valeurs saisies, contrairement au libellé.
  code: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    validate: {
      is: {
        args: /^[a-z0-9_]+$/,
        msg: 'Le code ne peut contenir que des minuscules, chiffres et underscores'
      }
    }
  },
  libelle: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(
      'texte',
      'texte_long',
      'nombre',
      'booleen',
      'date',
      'liste',
      'liste_multiple',
      'telephone',
      'email'
    ),
    allowNull: false,
    defaultValue: 'texte'
  },
  // Valeurs possibles pour les types `liste` / `liste_multiple`.
  options: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Un attribut obligatoire bloque le passage du dossier de "brouillon" à "complet".
  obligatoire: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Regroupement d'affichage dans le formulaire de complétion.
  groupe: {
    type: DataTypes.STRING(60),
    allowNull: false,
    defaultValue: 'Informations complémentaires'
  },
  aide: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ordre: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Désactiver plutôt que supprimer permet de retirer un champ du formulaire
  // sans perdre l'historique des valeurs déjà saisies sur les PDV existants.
  actif: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'pdv_attributs',
  indexes: [
    { fields: ['actif'] },
    { fields: ['ordre'] }
  ]
});

module.exports = PdvAttribut;
