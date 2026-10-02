'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const colonnes = await queryInterface.describeTable('pdv').catch(() => null);
    if (!colonnes || colonnes.derniere_position_precision) return;

    await queryInterface.addColumn('pdv', 'derniere_position_precision', {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Rayon estimé de précision GPS en mètres pour la dernière position'
    });
  },
};