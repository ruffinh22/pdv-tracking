'use strict';
const { DataTypes } = require('sequelize');

/** Jeton de notification du terminal (réveil silencieux) + date du dernier réveil envoyé. */
module.exports = {
  async up(queryInterface) {
    const colonnes = await queryInterface.describeTable('pdv').catch(() => null);
    if (!colonnes) return;
    if (!colonnes.push_token) {
      await queryInterface.addColumn('pdv', 'push_token', { type: DataTypes.STRING(255), allowNull: true });
    }
    if (!colonnes.dernier_reveil_at) {
      await queryInterface.addColumn('pdv', 'dernier_reveil_at', { type: DataTypes.DATE, allowNull: true });
    }
  },
};
