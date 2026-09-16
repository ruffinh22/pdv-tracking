const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Réglage d'affichage d'un champ FIXE de la fiche PDV — une vraie colonne du
 * modèle PDV (ou la relation "produits"), pas un attribut personnalisé ajouté
 * par l'admin (voir PdvAttribut pour ceux-là).
 *
 * Différence clé avec PdvAttribut : ici, l'admin ne peut ni créer, ni
 * supprimer une ligne, ni changer le `code`. La liste des champs fixes est
 * câblée dans le code (voir la migration de seed) parce que chacun est lié à
 * une colonne réelle, une contrainte métier (export mapping partenaire) ou une
 * relation (produits). Seuls `libelle`, `obligatoire` et `visible` sont
 * éditables — voir pdvChampFixeService pour la règle qui les articule.
 */
const PdvChampFixe = sequelize.define(
  'PdvChampFixe',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true
    },
    libelle: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    obligatoire: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    visible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: 'pdv_champs_fixes'
  }
);

module.exports = PdvChampFixe;
