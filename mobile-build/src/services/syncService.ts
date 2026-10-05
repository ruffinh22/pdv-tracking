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
  private static readonly SYNC_BATCH_SIZE = 25;
  private ready = false;
  /** Instant (horloge locale) du dernier enregistrement de position, tous canaux confondus. */
  private derniereEcritureMs = 0;

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
      const terminalId = await getSecureItem('terminalId');
      const clientEventId = `${terminalId || 'terminal'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await db.runAsync(
        `INSERT INTO positions (latitude, longitude, horodatage, precision, client_event_id, synchronise) VALUES (?, ?, ?, ?, ?, 0)`,
        [position.latitude, position.longitude, position.horodatage, position.accuracy ?? null, clientEventId]
      );
      this.derniereEcritureMs = Date.now();
      return true;
    } catch (error) {
      console.error('[sync] Erreur enregistrement position locale:', error);
      return false;
    }
  }

  /** Millisecondes écoulées depuis le dernier enregistrement (Infinity si aucun depuis le lancement). */
  msDepuisDerniereEcriture(): number {
    return this.derniereEcritureMs ? Date.now() - this.derniereEcritureMs : Number.POSITIVE_INFINITY;
  }

  /**
   * Point d'entrée UNIQUE des positions (arrière-plan, premier plan, battement
   * de cœur) : enregistre localement puis lance la synchro sans l'attendre.
   * `ecartMinMs` évite d'empiler des doublons quand plusieurs canaux tournent
   * en même temps.
   */
  async enregistrerEtEnvoyer(
    point: { latitude: number; longitude: number; accuracy?: number | null; timestamp?: number },
    ecartMinMs = 0
  ): Promise<boolean> {
    if (ecartMinMs > 0 && this.msDepuisDerniereEcriture() < ecartMinMs) return false;
    const sauvegardee = await this.savePositionLocally({
      latitude: point.latitude,
      longitude: point.longitude,
      horodatage: new Date(point.timestamp || Date.now()).toISOString(),
      accuracy: point.accuracy ?? null,
    });
    if (!sauvegardee) return false;
    this.syncPositions().catch((error) => {
      console.warn('[sync] Envoi différé (non bloquant):', error);
    });
    return true;
  }

  private syncPromise: Promise<{ success: boolean; synced: number }> | null = null;

  syncPositions(): Promise<{ success: boolean; synced: number }> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.syncPendingPositions().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async syncPendingPositions(): Promise<{ success: boolean; synced: number }> {
    try {
      const db = await this.ensureDb();
      const positions = await db.getAllAsync(
        'SELECT * FROM positions WHERE synchronise = 0 ORDER BY horodatage ASC, id ASC LIMIT 100'
      );
      if (positions.length === 0) return { success: true, synced: 0 };

      const pdvId = await getSecureItem('pdvId');
      if (!pdvId) {
        // Terminal pas encore enrôlé : les positions restent en file, elles
        // partiront au premier passage après l'association.
        return { success: false, synced: 0 };
      }

      let synced = 0;
      const enAttente = positions as any[];
      for (let offset = 0; offset < enAttente.length; offset += SyncService.SYNC_BATCH_SIZE) {
        const lot = enAttente.slice(offset, offset + SyncService.SYNC_BATCH_SIZE);
        const payload = lot.map((position) => ({
          client_event_id:
            position.client_event_id ||
            `${pdvId}-legacy-${position.id}-${new Date(position.horodatage).getTime()}`,
          latitude: position.latitude,
          longitude: position.longitude,
          precision: position.precision,
          horodatage: position.horodatage,
        }));
        try {
          const { data } = await api.post(
            '/positions/mobile/batch',
            { pdv_id: Number(pdvId), positions: payload },
            { timeout: 15000 }
          );
          const accepted = new Set(data?.accepted || []);
          if (!payload.every((position) => accepted.has(position.client_event_id))) {
            throw new Error('Accusé de réception incomplet pour le lot de positions');
          }

          const ids = lot.map((position) => position.id);
          const placeholders = ids.map(() => '?').join(', ');
          await db.runAsync(
            `UPDATE positions SET synchronise = 1 WHERE id IN (${placeholders})`,
            ids
          );
          synced += lot.length;
        } catch (error) {
          console.warn(`[sync] Échec sync du lot à partir de la position ${lot[0]?.id}:`, error);
          // Keep FIFO order; retries are idempotent if the server committed before a timeout.
          return { success: false, synced };
        }
      }

      await db.runAsync(
        "DELETE FROM positions WHERE synchronise = 1 AND julianday(horodatage) < julianday('now', '-7 days')"
      );

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
    return this.syncPositions();
  }
}

export const syncService = new SyncService();
export default syncService;
