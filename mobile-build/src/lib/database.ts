import { Platform } from 'react-native';
import { CONFIG } from '@/config';

// Conditional import for expo-sqlite (native only)
let SQLite: any;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

let dbInstance: any = null;

// Mock database for web
const createMockDatabase = () => ({
  execAsync: async () => {},
  runAsync: async () => ({ insertId: 1 }),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  closeAsync: async () => {},
});

export async function getDatabase(): Promise<any> {
  if (Platform.OS === 'web') {
    return createMockDatabase();
  }
  
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(CONFIG.DB.NAME);
  return dbInstance;
}

export async function initDatabase(): Promise<any> {
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
