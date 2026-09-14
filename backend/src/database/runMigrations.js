const { sequelize } = require('../config/database');

async function runMigrations() {
  const fs = require('fs');
  const path = require('path');

  const migrationDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith('.js'))
    .sort();

  for (const file of files) {
    const migration = require(path.join(migrationDir, file));
    if (typeof migration.up === 'function') {
      await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
    }
  }
}

module.exports = { runMigrations };
