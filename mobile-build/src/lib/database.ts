import * as SQLite from 'expo-sqlite';
import { CONFIG } from '@/config';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(CONFIG.DB.NAME);
  return dbInstance;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();

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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export default initDatabase;
