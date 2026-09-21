'use strict';

/**
 * Le modèle Sequelize User (src/models/User.js) définit la colonne `role`
 * avec la valeur 'agence' dans son ENUM, mais la table `users` en base
 * a été créée avec un ENUM plus restreint qui ne la contient pas.
 * Résultat : toute insertion avec role = 'agence' échoue
 * (WARN_DATA_TRUNCATED / Data truncated for column 'role').
 *
 * Cette migration aligne l'ENUM MySQL sur celui du modèle.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` " +
        "ENUM('admin','superviseur','commercial','chef_zone','agence') " +
        "NOT NULL DEFAULT 'commercial'"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` " +
        "ENUM('admin','superviseur','commercial','chef_zone') " +
        "NOT NULL DEFAULT 'commercial'"
    );
  },
};
