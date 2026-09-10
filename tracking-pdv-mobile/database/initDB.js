import * as SQLite from 'expo-sqlite';

const DB_NAME = 'trackingpdv.db';

export const initDatabase = async () => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // Table des ventes locales
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ventes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produit TEXT NOT NULL,
        nom_concessionnaire TEXT,
        nom_vendeur TEXT,
        contact_vendeur TEXT,
        montant REAL DEFAULT 0,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        horodatage TEXT NOT NULL,
        statut TEXT DEFAULT 'en_attente',
        synchronise INTEGER DEFAULT 0,
        pdv_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table des positions locales
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        horodatage TEXT NOT NULL,
        precision REAL,
        synchronise INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table des métadonnées
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    console.log('Base de données initialisée avec succès');
    return db;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
};

export default initDatabase;