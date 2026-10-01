const { DataTypes } = require('sequelize');

const COLONNES = {
  id_unique: { type: DataTypes.STRING(100), allowNull: true },
  sous_zone: { type: DataTypes.STRING(150), allowNull: true },
  id_distributeur: { type: DataTypes.STRING(100), allowNull: true },
  type_terminal: { type: DataTypes.STRING(100), allowNull: true },
};

module.exports = {
  async up(queryInterface) {
    let existantes;
    try {
      existantes = await queryInterface.describeTable('pdv');
    } catch (e) {
      return; // table absente : sync() la créera avec le modèle
    }
    for (const [nom, def] of Object.entries(COLONNES)) {
      if (!existantes[nom]) {
        await queryInterface.addColumn('pdv', nom, def);
      }
    }
  },
};
