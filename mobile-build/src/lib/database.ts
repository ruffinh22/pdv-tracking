import { Platform } from 'react-native';
import { CONFIG } from '@/config';

// Conditional import for expo-sqlite (native only)
let SQLite: any;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

let dbInstance: any = null;

// Mock database for web — lightweight persistence using localStorage
const VENTES_KEY = 'pdv_tracking_ventes';
const POSITIONS_KEY = 'pdv_tracking_positions';
const IDS_KEY = 'pdv_tracking_ids';

const readStore = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStore = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

// Mock database for web
const createMockDatabase = () => ({
  execAsync: async (_sql?: string) => {
    // noop for CREATE TABLE statements
    return;
  },
    runAsync: async (sql: string, params?: any[]) => {
    // Simple parser for INSERT and UPDATE used by the app
    if (sql.startsWith('INSERT INTO ventes')) {
      const ventes = readStore(VENTES_KEY);
      let idsRaw: any = readStore(IDS_KEY);
      const ids = idsRaw && !Array.isArray(idsRaw) ? idsRaw : { ventes: 0, positions: 0 };
      const insertId = (ids.ventes || 0) + 1;
      ids.ventes = insertId;

      const [produit, nom_concessionnaire, nom_vendeur, contact_vendeur, montant, latitude, longitude, horodatage, statut, pdv_id] = params || [];
      const row = {
        id: insertId,
        produit,
        nom_concessionnaire,
        nom_vendeur,
        contact_vendeur,
        montant,
        latitude,
        longitude,
        horodatage,
        statut: statut || 'en_attente',
        synchronise: 0,
        pdv_id: pdv_id || null,
        created_at: new Date().toISOString(),
      };
      ventes.push(row);
      writeStore(VENTES_KEY, ventes);
      writeStore(IDS_KEY, ids);
      return { insertId };
    }

    if (sql.startsWith('UPDATE ventes SET synchronise = 1 WHERE id =')) {
      const ventes = readStore(VENTES_KEY);
      const id = params && params[0];
      for (const v of ventes) {
        if (v.id === id) v.synchronise = 1;
      }
      writeStore(VENTES_KEY, ventes);
      return { changes: 1 };
    }

    if (sql.startsWith('INSERT INTO positions')) {
      const positions = readStore(POSITIONS_KEY);
      let idsRaw: any = readStore(IDS_KEY);
      const ids = idsRaw && !Array.isArray(idsRaw) ? idsRaw : { ventes: 0, positions: 0 };
      const insertId = (ids.positions || 0) + 1;
      ids.positions = insertId;
      const [latitude, longitude, horodatage, precision] = params || [];
      const row = { id: insertId, latitude, longitude, horodatage, precision, synchronise: 0, created_at: new Date().toISOString() };
      positions.push(row);
      writeStore(POSITIONS_KEY, positions);
      writeStore(IDS_KEY, ids);
      return { insertId };
    }

    if (sql.startsWith('UPDATE positions SET synchronise = 1 WHERE id =')) {
      const positions = readStore(POSITIONS_KEY);
      const id = params && params[0];
      for (const p of positions) {
        if (p.id === id) p.synchronise = 1;
      }
      writeStore(POSITIONS_KEY, positions);
      return { changes: 1 };
    }

    return { insertId: 0 };
  },
  getFirstAsync: async () => null,
  getAllAsync: async (sql?: string, params?: any[]) => {
    // Support select queries used by syncService
    if (!sql) return [];
    if (sql.includes('FROM ventes')) {
      const ventes = readStore(VENTES_KEY);
      if (sql.includes('WHERE synchronise = 0')) {
        return ventes.filter((v: any) => Number(v.synchronise) === 0).sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1));
      }
      if (sql.includes('ORDER BY horodatage DESC LIMIT')) {
        const limit = params && params[0] ? Number(params[0]) : ventes.length;
        return ventes.slice().sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1)).slice(0, limit);
      }
      return ventes.slice().sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1));
    }

    if (sql.includes('FROM positions')) {
      const positions = readStore(POSITIONS_KEY);
      if (sql.includes('WHERE synchronise = 0')) {
        return positions.filter((p: any) => Number(p.synchronise) === 0).sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1));
      }
      return positions.slice().sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1));
    }

    return [];
  },
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

export async function clearAllData(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(VENTES_KEY);
      localStorage.removeItem(POSITIONS_KEY);
      // reset ids
      try {
        localStorage.setItem(IDS_KEY, JSON.stringify({ ventes: 0, positions: 0 }));
      } catch {
        // ignore
      }
      // Remove legacy secure keys and any prefixed secure_store_mock_ keys
      try {
        const legacyKeys = ['pdvId', 'msisdn', 'isOnboarded', 'initialLat', 'initialLng'];
        for (const k of legacyKeys) {
          localStorage.removeItem(k);
        }
        // also remove any keys created by secureStoreMock (prefix safe)
        const prefix = 'secure_store_mock_';
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith(prefix)) toRemove.push(key);
        }
        for (const k of toRemove) localStorage.removeItem(k);
      } catch {
        // ignore
      }
    } catch (e) {
      console.warn('[database] clearAllData web failed:', e);
    }
    return;
  }

  try {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM ventes;');
    await db.execAsync('DELETE FROM positions;');
    await db.execAsync('DELETE FROM metadata;');
  } catch (e) {
    console.warn('[database] clearAllData failed:', e);
  }
}

export default initDatabase;
