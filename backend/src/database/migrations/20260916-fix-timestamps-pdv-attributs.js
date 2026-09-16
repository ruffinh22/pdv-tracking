'use strict';

/**
 * Corrige un oubli de la migration précédente (20260915-enrolement-pdv-brouillon) :
 * les tables `pdv_attributs` et `pdv_attribut_valeurs` ont été créées avec des
 * colonnes `createdAt` / `updatedAt`, alors que le reste du projet nomme ses
 * colonnes de dates `date_creation` / `date_modification`. Les modèles
 * Sequelize suivent la convention globale du projet et cherchaient donc des
 * colonnes qui n'existaient pas.
 *
 * Idempotente comme les précédentes : ne fait rien si les colonnes existent déjà.
 *
 * Deux cas selon quand cette migration s'exécute :
 *  - la table a déjà `createdAt`/`updatedAt` (la migration du 15 a tourné) :
 *    on renomme, les données existantes sont conservées ;
 *  - la table n'a ni l'un ni l'autre (nouvelle installation, ou migration du
 *    15 déjà corrigée) : on ajoute directement les bonnes colonnes.
 */
async function corrigerTable(queryInterface, Sequelize, nomTable) {
  const colonnes = await queryInterface.describeTable(nomTable).catch(() => null);
  if (!colonnes) return; // Table pas encore créée, rien à corriger ici.

  if ('date_creation' in colonnes && 'date_modification' in colonnes) {
    return; // Déjà dans le bon état.
  }

  if ('createdAt' in colonnes) {
    await queryInterface.renameColumn(nomTable, 'createdAt', 'date_creation');
  } else if (!('date_creation' in colonnes)) {
    await queryInterface.addColumn(nomTable, 'date_creation', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    });
  }

  if ('updatedAt' in colonnes) {
    await queryInterface.renameColumn(nomTable, 'updatedAt', 'date_modification');
  } else if (!('date_modification' in colonnes)) {
    await queryInterface.addColumn(nomTable, 'date_modification', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await corrigerTable(queryInterface, Sequelize, 'pdv_attributs');
    await corrigerTable(queryInterface, Sequelize, 'pdv_attribut_valeurs');
  },

  async down(queryInterface, Sequelize) {
    for (const nomTable of ['pdv_attributs', 'pdv_attribut_valeurs']) {
      const colonnes = await queryInterface.describeTable(nomTable).catch(() => null);
      if (!colonnes) continue;
      if ('date_creation' in colonnes) {
        await queryInterface.renameColumn(nomTable, 'date_creation', 'createdAt');
      }
      if ('date_modification' in colonnes) {
        await queryInterface.renameColumn(nomTable, 'date_modification', 'updatedAt');
      }
    }
  }
};
