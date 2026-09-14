'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users').catch(() => null);
    if (!table) {
      return;
    }

    if (!('agence_id' in table)) {
      await queryInterface.addColumn('users', 'agence_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'agences',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    const indexes = await queryInterface.showIndex('users');
    const indexExists = indexes.some((index) => index.name === 'users_agence_id');

    if (!indexExists) {
      await queryInterface.addIndex('users', ['agence_id'], {
        name: 'users_agence_id',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users').catch(() => null);
    if (!table) {
      return;
    }

    if ('agence_id' in table) {
      const indexes = await queryInterface.showIndex('users');
      const indexExists = indexes.some((index) => index.name === 'users_agence_id');

      if (indexExists) {
        await queryInterface.removeIndex('users', 'users_agence_id');
      }

      await queryInterface.removeColumn('users', 'agence_id');
    }
  },
};
