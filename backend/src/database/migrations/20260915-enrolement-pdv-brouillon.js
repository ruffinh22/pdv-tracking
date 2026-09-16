'use strict';

/**
 * Enrôlement mobile d'un PDV en brouillon + attributs de PDV administrables.
 *
 * Chaque étape est idempotente (vérification de l'existence avant ajout) :
 * runMigrations rejoue tous les fichiers à chaque démarrage, cette migration
 * doit donc pouvoir s'exécuter plusieurs fois sans erreur.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- users.matricule -------------------------------------------------
    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users && !('matricule' in users)) {
      await queryInterface.addColumn('users', 'matricule', {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      });
      await queryInterface.addIndex('users', ['matricule'], { name: 'users_matricule' }).catch(() => {});
    }

    // --- Colonnes de cycle de vie du dossier PDV -------------------------
    const pdv = await queryInterface.describeTable('pdv').catch(() => null);
    if (pdv) {
      if (!('statut_dossier' in pdv)) {
        await queryInterface.addColumn('pdv', 'statut_dossier', {
          type: Sequelize.ENUM('brouillon', 'complet'),
          allowNull: false,
          defaultValue: 'brouillon'
        });
        // Les PDV déjà en base ont été saisis depuis le back-office : ce sont
        // des dossiers complets, ils ne doivent pas atterrir dans la file des
        // brouillons à traiter au premier démarrage après migration.
        await queryInterface.sequelize.query("UPDATE pdv SET statut_dossier = 'complet'");
      }

      if (!('matricule_agent' in pdv)) {
        await queryInterface.addColumn('pdv', 'matricule_agent', {
          type: Sequelize.STRING(50),
          allowNull: true
        });
      }

      if (!('date_completion' in pdv)) {
        await queryInterface.addColumn('pdv', 'date_completion', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }

      if (!('complete_par' in pdv)) {
        await queryInterface.addColumn('pdv', 'complete_par', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        });
      }

      // id_terminal passe de 50 à 100 caractères (UUID + préfixe plateforme)
      if (pdv.id_terminal) {
        await queryInterface
          .changeColumn('pdv', 'id_terminal', {
            type: Sequelize.STRING(100),
            allowNull: true,
            unique: true
          })
          .catch(() => {});
      }

      // msisdn_responsable devient facultatif : il n'est plus saisi à
      // l'enrôlement, c'est l'id_terminal qui identifie l'appareil.
      if (pdv.msisdn_responsable && pdv.msisdn_responsable.allowNull === false) {
        await queryInterface
          .changeColumn('pdv', 'msisdn_responsable', {
            type: Sequelize.STRING(20),
            allowNull: true,
            unique: true
          })
          .catch(() => {});
      }
    }

    // --- Attributs de PDV administrables ---------------------------------
    const attributs = await queryInterface.describeTable('pdv_attributs').catch(() => null);
    if (!attributs) {
      await queryInterface.createTable('pdv_attributs', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
        libelle: { type: Sequelize.STRING(150), allowNull: false },
        type: {
          type: Sequelize.ENUM(
            'texte', 'texte_long', 'nombre', 'booleen', 'date',
            'liste', 'liste_multiple', 'telephone', 'email'
          ),
          allowNull: false,
          defaultValue: 'texte'
        },
        options: { type: Sequelize.JSON, allowNull: true },
        obligatoire: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        groupe: {
          type: Sequelize.STRING(60),
          allowNull: false,
          defaultValue: 'Informations complémentaires'
        },
        aide: { type: Sequelize.STRING(255), allowNull: true },
        ordre: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        // Convention du projet : colonnes de dates en français, comme sur
        // toutes les autres tables — pas les noms par défaut de Sequelize.
        date_creation: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        date_modification: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
      });
      await queryInterface.addIndex('pdv_attributs', ['actif'], { name: 'pdv_attributs_actif' });
      await queryInterface.addIndex('pdv_attributs', ['ordre'], { name: 'pdv_attributs_ordre' });
    }

    const valeurs = await queryInterface.describeTable('pdv_attribut_valeurs').catch(() => null);
    if (!valeurs) {
      await queryInterface.createTable('pdv_attribut_valeurs', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        pdv_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'pdv', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        attribut_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'pdv_attributs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        valeur: { type: Sequelize.TEXT, allowNull: true },
        date_creation: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        date_modification: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
      });
      await queryInterface.addIndex('pdv_attribut_valeurs', ['pdv_id', 'attribut_id'], {
        name: 'pdv_attribut_valeurs_unique',
        unique: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pdv_attribut_valeurs').catch(() => {});
    await queryInterface.dropTable('pdv_attributs').catch(() => {});

    const pdv = await queryInterface.describeTable('pdv').catch(() => null);
    if (pdv) {
      for (const colonne of ['statut_dossier', 'matricule_agent', 'date_completion', 'complete_par']) {
        if (colonne in pdv) {
          await queryInterface.removeColumn('pdv', colonne).catch(() => {});
        }
      }
    }

    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users && 'matricule' in users) {
      await queryInterface.removeIndex('users', 'users_matricule').catch(() => {});
      await queryInterface.removeColumn('users', 'matricule').catch(() => {});
    }
  }
};
