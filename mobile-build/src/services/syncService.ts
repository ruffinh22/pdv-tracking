import { Platform } from 'react-native';
import { getDatabase, initDatabase } from '@/lib/database';
import { api } from '@/lib/api';
import { PositionLocale } from '@/types';

/**
 * Remontée des positions GPS au serveur. Toute la partie vente (écriture
 * locale d'une vente, envoi immédiat, import de l'historique serveur) a été
 * retirée : l'app ne produit plus que des positions.
 */

const webStorage: Record<string, string> = {};

let SecureStore: any = {
  getItemAsync: async (key: string) => webStorage[key] || null,
  setItemAsync: async (key: string, value: string) => {
    webStorage[key] = value;
  },
  deleteItemAsync: async (key: string) => {
    delete webStorage[key];
  },
};

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (error) {
    console.warn('[syncService] Modules natifs indisponibles:', error);
  }
} else {
  try {
    SecureStore = require('../lib/secureStoreMock');
  } catch {
    // On garde le mock local défini ci-dessus.
  }
}

const getSecureItem = async (key: string): Promise<string | null> => SecureStore.getItemAsync(key);

class SyncService {
  private ready = false;

  private async ensureDb() {
    if (!this.ready) {
      await initDatabase();
      this.ready = true;
    }
    return getDatabase();
  }

  /** Écrit une position dans la file locale. Ne fait jamais d'appel réseau. */
  async savePositionLocally(position: {
    latitude: number;
    longitude: number;
    horodatage: string;
    accuracy?: number | null;
  }): Promise<boolean> {
    try {
      const db = await this.ensureDb();
      await db.runAsync(
        `INSERT INTO positions (latitude, longitude, horodatage, precision, synchronise) VALUES (?, ?, ?, ?, 0)`,
        [position.latitude, position.longitude, position.horodatage, position.accuracy || 0]
      );
      return true;
    } catch (error) {
      console.error('[sync] Erreur enregistrement position locale:', error);
      return false;
    }
  }

  /** Limite de requêtes simultanées pour ne pas saturer un réseau mobile. */
  private static readonly SYNC_CONCURRENCY = 5;

  private async runWithConcurrency<T>(
    items: T[],
    worker: (item: T) => Promise<boolean>
  ): Promise<number> {
    let cursor = 0;
    let synced = 0;

    const runNext = async (): Promise<void> => {
      while (cursor < items.length) {
        const item = items[cursor++];
        if (await worker(item)) synced++;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(SyncService.SYNC_CONCURRENCY, items.length) }, runNext)
    );
    return synced;
  }

  async syncPositions(): Promise<{ success: boolean; synced: number }> {
    try {
      const db = await this.ensureDb();
      const positions = await db.getAllAsync('SELECT * FROM positions WHERE synchronise = 0');
      if (positions.length === 0) return { success: true, synced: 0 };

      const pdvId = await getSecureItem('pdvId');
      if (!pdvId) {
        // Terminal pas encore enrôlé : les positions restent en file, elles
        // partiront au premier passage après l'association.
        return { success: false, synced: 0 };
      }

      const synced = await this.runWithConcurrency(positions, async (position: any) => {
        try {
          await api.post(
            '/positions/mobile/create',
            {
              pdv_id: Number(pdvId),
              latitude: position.latitude,
              longitude: position.longitude,
              horodatage: position.horodatage,
            },
            { timeout: 6000 }
          );
          await db.runAsync('UPDATE positions SET synchronise = 1 WHERE id = ?', [position.id]);
          return true;
        } catch (error) {
          console.warn(`[sync] Échec sync position ${position.id}:`, error);
          return false;
        }
      });

      return { success: true, synced };
    } catch (error) {
      console.error('[sync] Erreur syncPositions:', error);
      return { success: false, synced: 0 };
    }
  }

  /** Positions encore en attente d'envoi (affichées sur l'écran d'accueil). */
  async getPendingPositions(): Promise<PositionLocale[]> {
    const db = await this.ensureDb();
    return db.getAllAsync('SELECT * FROM positions WHERE synchronise = 0 ORDER BY horodatage DESC');
  }

  /** Dernières positions enregistrées localement, synchronisées ou non. */
  async getRecentPositions(limit = 20): Promise<PositionLocale[]> {
    const db = await this.ensureDb();
    return db.getAllAsync('SELECT * FROM positions ORDER BY horodatage DESC LIMIT ?', [limit]);
  }

  async checkConnection(): Promise<boolean> {
    try {
      await api.get('/health', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async autoSync(): Promise<{ success: boolean; synced: number }> {
    const online = await this.checkConnection();
    if (!online) return { success: false, synced: 0 };
    return this.syncPositions();
  }
}

export const syncService = new SyncService();
export default syncService;
