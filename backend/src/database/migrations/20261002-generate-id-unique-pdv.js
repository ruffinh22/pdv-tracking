'use strict';

/**
 * Attribue un ID métier à tout PDV, y compris aux brouillons créés depuis
 * l'application mobile. La migration est idempotente et rattrape les dossiers
 * déjà présents en base.
 */
module.exports = {
  async up(queryInterface) {
    const colonnes = await queryInterface.describeTable('pdv').catch(() => null);
    if (!colonnes?.id_unique || !colonnes?.statut_dossier || !colonnes?.id) return;

    await queryInterface.sequelize.query(
      "UPDATE pdv SET id_unique = CONCAT('CI-PDV-', LPAD(id, 4, '0')) " +
        "WHERE id_unique IS NULL OR TRIM(id_unique) = ''"
    );
  },
};