'use strict';

const TABLE = 'positions';
const INDEX = 'positions_pdv_horodatage';

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE).catch(() => null);
    if (!columns?.pdv_id || !columns?.horodatage) return;

    const indexes = await queryInterface.showIndex(TABLE).catch(() => []);
    if (!indexes.some((index) => index.name === INDEX)) {
      await queryInterface.addIndex(TABLE, ['pdv_id', 'horodatage'], { name: INDEX });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex(TABLE).catch(() => []);
    if (indexes.some((index) => index.name === INDEX)) {
      await queryInterface.removeIndex(TABLE, INDEX);
    }
  },
};