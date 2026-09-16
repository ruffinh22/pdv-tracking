'use strict';

/**
 * Table de réglage des champs FIXES de la fiche PDV (les vraies colonnes du
 * modèle PDV, plus la relation "produits") : l'admin peut les masquer ou les
 * rendre facultatifs, au même titre que les attributs personnalisés — mais il
 * ne peut ni en créer, ni en supprimer, ni changer leur `code` : chaque ligne
 * correspond à une colonne réelle ou une relation, câblée dans le code.
 *
 * Attention, décision explicitement demandée : masquer ou rendre facultatif
 * un champ du mapping standard (Vendeur, Agence, Sous-zone, ID Distributeur,
 * Pays, Ville…) peut faire partir des lignes incomplètes dans l'export CSV
 * partenaire. C'est un choix assumé, pas un bug — voir le README.
 *
 * Idempotente : ne recrée pas la table si elle existe, et n'insère que les
 * codes qui manquent (utile si de nouveaux champs fixes sont ajoutés plus
 * tard par une migration suivante).
 */
const CHAMPS_PAR_DEFAUT = [
  { code: 'nom_pdv', libelle: 'Nom / enseigne du PDV', obligatoire: true },
  { code: 'vendeur_nom', libelle: 'Vendeur', obligatoire: true },
  { code: 'contact_vendeur', libelle: 'Contact du vendeur', obligatoire: true },
  { code: 'msisdn_responsable', libelle: 'MSISDN responsable', obligatoire: false },
  { code: 'concessionnaire_nom', libelle: 'Concessionnaire', obligatoire: false },
  { code: 'statut', libelle: 'Statut', obligatoire: false },
  { code: 'agence_id', libelle: 'Agence', obligatoire: true },
  { code: 'superviseur_id', libelle: 'Superviseur', obligatoire: true },
  { code: 'chef_zone_id', libelle: 'Chef de zone', obligatoire: true },
  { code: 'sous_zone', libelle: 'Sous-zone', obligatoire: true },
  { code: 'id_distributeur', libelle: 'ID Distributeur', obligatoire: true },
  { code: 'type_terminal', libelle: 'Type de terminal', obligatoire: false },
  { code: 'pays', libelle: 'Pays', obligatoire: true },
  { code: 'ville', libelle: 'Ville', obligatoire: true },
  { code: 'commune', libelle: 'Commune', obligatoire: false },
  { code: 'quartier', libelle: 'Quartier', obligatoire: false },
  { code: 'produits', libelle: 'Produits vendus', obligatoire: true }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const existe = await queryInterface.describeTable('pdv_champs_fixes').catch(() => null);
    if (!existe) {
      // Colonnes de dates nommées comme sur le reste du projet (leçon de la
      // migration précédente, qui avait utilisé createdAt/updatedAt par erreur).
      await queryInterface.createTable('pdv_champs_fixes', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
        libelle: { type: Sequelize.STRING(150), allowNull: false },
        obligatoire: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        visible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        date_creation: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        date_modification: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
      });
    }

    const lignesActuelles = await queryInterface.sequelize.query('SELECT code FROM pdv_champs_fixes', {
      type: Sequelize.QueryTypes.SELECT
    });
    const codesExistants = new Set(lignesActuelles.map((l) => l.code));
    const aInserer = CHAMPS_PAR_DEFAUT.filter((c) => !codesExistants.has(c.code));

    if (aInserer.length > 0) {
      const maintenant = new Date();
      await queryInterface.bulkInsert(
        'pdv_champs_fixes',
        aInserer.map((c) => ({
          code: c.code,
          libelle: c.libelle,
          obligatoire: c.obligatoire,
          visible: true,
          date_creation: maintenant,
          date_modification: maintenant
        }))
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pdv_champs_fixes').catch(() => {});
  }
};
