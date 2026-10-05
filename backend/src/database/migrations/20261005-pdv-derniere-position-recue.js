'use strict';

const { DataTypes } = require('sequelize');

/**
 * Date de RÉCEPTION (horloge serveur) de la dernière position du terminal.
 *
 * `derniere_position_date` vient de l'horloge du téléphone : un téléphone en
 * avance ou en retard de quelques minutes faisait passer un PDV pour muet.
 * Cette colonne sert de référence fiable pour savoir si le terminal est
 * vivant, indépendamment de l'horloge du téléphone.
 */
module.exports = {
  async up(queryInterface) {
    const colonnes = await queryInterface.describeTable('pdv').catch(() => null);
    if (!colonnes || colonnes.derniere_position_recue_at) return;

    await queryInterface.addColumn('pdv', 'derniere_position_recue_at', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Heure serveur de réception de la dernière position envoyée par le terminal',
    });
  },
};
