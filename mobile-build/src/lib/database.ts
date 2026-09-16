import { Platform } from 'react-native';
import { CONFIG } from '@/config';

/**
 * Base locale du terminal. Elle ne contient plus qu'une seule table :
 * `positions`, la file d'attente des points GPS à remonter au serveur quand le
 * réseau revient. La table `ventes` (produit, montant, vendeur…) a été
 * supprimée avec le reste de la partie vente ; `nettoyerAncienSchema` la
 * supprime aussi sur les terminaux déjà installés, pour ne pas laisser traîner
 * indéfiniment des données commerciales dans la base d'un appareil de terrain.
 */

let SQLite: any;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

let dbInstance: any = null;

const POSITIONS_KEY = 'pdv_tracking_positions';
const IDS_KEY = 'pdv_tracking_ids';
// Clés de l'ancienne version, purgées au démarrage.
const CLES_OBSOLETES = ['pdv_tracking_ventes'];

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
    // Quota plein ou stockage indisponible : la perte d'une position locale
    // n'est pas bloquante, la suivante repartira.
  }
};

/** Implémentation minimale compatible expo-sqlite, pour la cible web. */
const createMockDatabase = () => ({
  execAsync: async (_sql?: string) => {},

  runAsync: async (sql: string, params?: any[]) => {
    if (sql.startsWith('INSERT INTO positions')) {
      const positions = readStore(POSITIONS_KEY);
      const idsRaw: any = readStore(IDS_KEY);
      const ids = idsRaw && !Array.isArray(idsRaw) ? idsRaw : { positions: 0 };
      const insertId = (ids.positions || 0) + 1;
      ids.positions = insertId;
      const [latitude, longitude, horodatage, precision] = params || [];
      positions.push({
        id: insertId,
        latitude,
        longitude,
        horodatage,
        precision,
        synchronise: 0,
        created_at: new Date().toISOString(),
      });
      writeStore(POSITIONS_KEY, positions);
      writeStore(IDS_KEY, ids);
      return { insertId };
    }

    if (sql.startsWith('UPDATE positions SET synchronise = 1 WHERE id =')) {
      const positions = readStore(POSITIONS_KEY);
      const id = params && params[0];
      for (const p of positions) if (p.id === id) p.synchronise = 1;
      writeStore(POSITIONS_KEY, positions);
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM positions')) {
      writeStore(POSITIONS_KEY, []);
      return { changes: 0 };
    }

    return { insertId: 0 };
  },

  getFirstAsync: async (sql?: string) => {
    if (sql && sql.includes('FROM positions')) {
      const positions = readStore(POSITIONS_KEY);
      return positions.length > 0 ? { total: positions.length } : { total: 0 };
    }
    return null;
  },

  getAllAsync: async (sql?: string, params?: any[]) => {
    if (!sql || !sql.includes('FROM positions')) return [];
    let positions = readStore(POSITIONS_KEY);
    if (sql.includes('WHERE synchronise = 0')) {
      positions = positions.filter((p: any) => Number(p.synchronise) === 0);
    }
    positions = positions
      .slice()
      .sort((a: any, b: any) => (a.horodatage < b.horodatage ? 1 : -1));
    if (sql.includes('LIMIT') && params && params.length > 0) {
      positions = positions.slice(0, Number(params[params.length - 1]));
    }
    return positions;
  },

  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  closeAsync: async () => {},
});

export async function getDatabase(): Promise<any> {
  if (Platform.OS === 'web') return createMockDatabase();
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(CONFIG.DB.NAME);
  return dbInstance;
}

/**
 * Supprime les vestiges de la version « ventes » sur les terminaux déjà
 * déployés. Best-effort : un échec ici ne doit jamais empêcher l'app de
 * démarrer.
 */
async function nettoyerAncienSchema(db: any): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      for (const cle of CLES_OBSOLETES) localStorage.removeItem(cle);
      return;
    }
    await db.execAsync('DROP TABLE IF EXISTS ventes;');
  } catch (error) {
    console.warn('[database] Nettoyage de l\'ancien schéma ignoré:', error);
  }
}

export async function initDatabase(): Promise<any> {
  const db = await getDatabase();

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

  await nettoyerAncienSchema(db);
  return db;
}

export async function clearAllData(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(POSITIONS_KEY);
      for (const cle of CLES_OBSOLETES) localStorage.removeItem(cle);
      localStorage.setItem(IDS_KEY, JSON.stringify({ positions: 0 }));

      const prefixe = 'secure_store_mock_';
      const aSupprimer: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const cle = localStorage.key(i);
        if (cle && cle.startsWith(prefixe)) aSupprimer.push(cle);
      }
      for (const cle of aSupprimer) localStorage.removeItem(cle);
    } catch (error) {
      console.warn('[database] clearAllData web a échoué:', error);
    }
    return;
  }

  try {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM positions;');
    await db.execAsync('DELETE FROM metadata;');
  } catch (error) {
    console.warn('[database] clearAllData a échoué:', error);
  }
}

export default initDatabase;
