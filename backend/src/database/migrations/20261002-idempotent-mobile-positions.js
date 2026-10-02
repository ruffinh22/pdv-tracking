'use strict';

const { DataTypes } = require('sequelize');
const TABLE = 'positions';
const COLUMN = 'client_event_id';
const INDEX = 'positions_client_event_id_unique';

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE).catch(() => null);
    if (!columns) return;

    if (!columns[COLUMN]) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: DataTypes.STRING(180),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex(TABLE).catch(() => []);
    const hasUniqueEventIndex = indexes.some(
      (index) => index.unique && index.fields.some((field) => field.attribute === COLUMN || field.name === COLUMN)
    );
    if (!hasUniqueEventIndex) {
      await queryInterface.addIndex(TABLE, [COLUMN], { name: INDEX, unique: true });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex(TABLE).catch(() => []);
    if (indexes.some((index) => index.name === INDEX)) {
      await queryInterface.removeIndex(TABLE, INDEX);
    }
    const columns = await queryInterface.describeTable(TABLE).catch(() => null);
    if (columns?.[COLUMN]) await queryInterface.removeColumn(TABLE, COLUMN);
  },
};