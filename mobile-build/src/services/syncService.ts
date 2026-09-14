import { Platform } from 'react-native';
import { getDatabase, initDatabase } from '@/lib/database';
import { api } from '@/lib/api';
import { VenteInput, VenteLocale } from '@/types';

// Mock storage for web
const webStorage: Record<string, string> = {};

// Conditional import for expo-secure-store (native only)
let SecureStore: any = {
  getItemAsync: async (key: string) => webStorage[key] || null,
  setItemAsync: async (key: string, value: string) => { webStorage[key] = value; },
  deleteItemAsync: async (key: string) => { delete webStorage[key]; },
};

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('[syncService] Native modules not available:', e);
  }
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SecureStore = require('../lib/secureStoreMock');
  } catch (e) {
    // ignore
  }
}

const getSecureItem = async (key: string): Promise<string | null> => {
  return await SecureStore.getItemAsync(key);
};

class SyncService {
  private ready = false;

  private async ensureDb() {
    if (!this.ready) {
      await initDatabase();
      this.ready = true;
    }
    return getDatabase();
  }

  /**
   * Enregistre une vente en local et retourne IMMÉDIATEMENT après l'écriture SQLite,
   * sans attendre le réseau : l'app est offline-first, l'utilisateur ne doit jamais
   * patienter sur un aller-retour serveur pour valider une saisie. La tentative
   * d'envoi immédiat au serveur part en arrière-plan (best-effort, non bloquante) ;
   * en cas d'échec ou d'absence de réseau, la ligne reste "en_attente" et sera
   * reprise par autoSync()/syncVentes() au prochain passage.
   */
  async saveVenteLocally(vente: VenteInput): Promise<boolean> {
    try {
      const db = await this.ensureDb();
      const pdvId = await getSecureItem('pdvId');

      const res = await db.runAsync(
        `INSERT INTO ventes (produit, nom_concessionnaire, nom_vendeur, contact_vendeur, montant, latitude, longitude, horodatage, statut, pdv_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vente.produit,
          vente.nom_concessionnaire || '',
          vente.nom_vendeur || '',
          vente.contact_vendeur || '',
          vente.montant || 0,
          vente.latitude,
          vente.longitude,
          vente.horodatage,
          'en_attente',
          pdvId ? Number(pdvId) : null,
        ]
      );

      const insertId = res && (res.insertId || res.lastID || 0);

      if (pdvId && insertId) {
        // Fire-and-forget : ne bloque jamais l'écran d'appel. On ne fait plus de
        // ping /health préalable (qui doublait chaque écriture d'un aller-retour
        // réseau supplémentaire, jusqu'à 5s de latence par produit) — on tente
        // directement l'envoi avec un timeout court et on retombe sur la file
        // d'attente locale en cas d'échec.
        this.attemptImmediateSync(insertId, {
          pdv_id: Number(pdvId),
          produit: vente.produit,
          nom_concessionnaire: vente.nom_concessionnaire || '',
          nom_vendeur: vente.nom_vendeur || '',
          contact_vendeur: vente.contact_vendeur || '',
          latitude_saisie: vente.latitude,
          longitude_saisie: vente.longitude,
          horodatage: vente.horodatage,
          montant: vente.montant || 0,
        }).catch(() => {
          /* déjà loggé plus bas, la ligne reste en attente pour retry */
        });
      } else if (!pdvId) {
        console.info('[sync] Pas d\'identifiant PDV (pdvId) trouvé — enregistrement local uniquement.');
      }

      return true;
    } catch (error) {
      console.error('[sync] Erreur enregistrement vente locale:', error);
      return false;
    }
  }

  /** Tentative d'envoi immédiat en arrière-plan, sans bloquer l'appelant. */
  private async attemptImmediateSync(insertId: number, payload: Record<string, unknown>): Promise<void> {
    try {
      const db = await this.ensureDb();
      await api.post('/ventes/mobile/create', payload, { timeout: 6000 });
      await db.runAsync('UPDATE ventes SET synchronise = 1 WHERE id = ?', [insertId]);
    } catch (error) {
      console.warn('[sync] Envoi immédiat vente échoué, conservation locale pour resynchronisation', error);
    }
  }

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

  /** Limite de requêtes simultanées pour ne pas saturer le serveur/réseau mobile. */
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

    // Quelques "workers" tournent en parallèle plutôt qu'un for..await strictement
    // séquentiel : sur une commande de plusieurs produits, ça divise le temps total
    // de synchronisation par ~SYNC_CONCURRENCY au lieu de le multiplier par le nombre d'items.
    await Promise.all(
      Array.from({ length: Math.min(SyncService.SYNC_CONCURRENCY, items.length) }, runNext)
    );
    return synced;
  }

  async syncVentes(): Promise<{ success: boolean; synced: number }> {
    try {
      const db = await this.ensureDb();
      const ventes = await db.getAllAsync(
        'SELECT * FROM ventes WHERE synchronise = 0'
      );
      if (ventes.length === 0) return { success: true, synced: 0 };

      const pdvId = await getSecureItem('pdvId');

      const synced = await this.runWithConcurrency(ventes, async (vente: any) => {
        const sendPdvId = vente.pdv_id || (pdvId ? Number(pdvId) : undefined);
        if (!sendPdvId) {
          console.warn(`[sync] Ignorer vente ${vente.id} sans pdv_id (attente d'onboarding)`);
          return false;
        }
        try {
          await api.post(
            '/ventes/mobile/create',
            {
              pdv_id: sendPdvId,
              produit: vente.produit,
              nom_concessionnaire: vente.nom_concessionnaire,
              nom_vendeur: vente.nom_vendeur,
              contact_vendeur: vente.contact_vendeur,
              latitude_saisie: vente.latitude,
              longitude_saisie: vente.longitude,
              horodatage: vente.horodatage,
              montant: vente.montant || 0,
            },
            { timeout: 6000 }
          );
          await db.runAsync('UPDATE ventes SET synchronise = 1 WHERE id = ?', [vente.id]);
          return true;
        } catch (error) {
          console.error(`[sync] Échec sync vente ${vente.id}:`, error);
          return false;
        }
      });

      return { success: true, synced };
    } catch (error) {
      console.error('[sync] Erreur syncVentes:', error);
      return { success: false, synced: 0 };
    }
  }

  async syncPositions(): Promise<{ success: boolean; synced: number }> {
    try {
      const db = await this.ensureDb();
      const positions = await db.getAllAsync(
        'SELECT * FROM positions WHERE synchronise = 0'
      );
      if (positions.length === 0) return { success: true, synced: 0 };

      const pdvId = await getSecureItem('pdvId');

      const synced = await this.runWithConcurrency(positions, async (position: any) => {
        try {
          await api.post(
            '/positions/mobile/create',
            {
              pdv_id: pdvId ? Number(pdvId) : undefined,
              latitude: position.latitude,
              longitude: position.longitude,
              horodatage: position.horodatage,
            },
            { timeout: 6000 }
          );
          await db.runAsync('UPDATE positions SET synchronise = 1 WHERE id = ?', [position.id]);
          return true;
        } catch (error) {
          console.error(`[sync] Échec sync position ${position.id}:`, error);
          return false;
        }
      });

      return { success: true, synced };
    } catch (error) {
      console.error('[sync] Erreur syncPositions:', error);
      return { success: false, synced: 0 };
    }
  }

  async getPendingVentes(): Promise<VenteLocale[]> {
    const db = await this.ensureDb();
    return db.getAllAsync(
      'SELECT * FROM ventes WHERE synchronise = 0 ORDER BY horodatage DESC'
    );
  }

  async getVentesHistory(limit = 100): Promise<VenteLocale[]> {
    const db = await this.ensureDb();
    return db.getAllAsync(
      'SELECT * FROM ventes ORDER BY horodatage DESC LIMIT ?',
      [limit]
    );
  }

  async hasLocalHistory(): Promise<boolean> {
    const db = await this.ensureDb();
    const row: any = await db.getFirstAsync('SELECT id FROM ventes LIMIT 1');
    return !!row;
  }

  /**
   * Réimporte l'historique d'un PDV depuis le serveur (utilisé après une
   * reconnexion post-purge, quand la base locale a été vidée mais que le
   * serveur a gardé les ventes). Import en une seule transaction pour rester
   * rapide même avec plusieurs centaines de lignes, et marqué "synchronise = 1"
   * puisque ces ventes existent déjà côté serveur (pas de re-envoi inutile).
   */
  async importVentesFromServer(pdvId: number, ventes: any[]): Promise<number> {
    if (!ventes || ventes.length === 0) return 0;
    const db = await this.ensureDb();
    let imported = 0;
    await db.withTransactionAsync(async () => {
      for (const v of ventes) {
        await db.runAsync(
          `INSERT INTO ventes (produit, nom_concessionnaire, nom_vendeur, contact_vendeur, montant, latitude, longitude, horodatage, statut, synchronise, pdv_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'traitee', 1, ?)`,
          [
            v.produit,
            v.nom_concessionnaire || '',
            v.nom_vendeur || '',
            v.contact_vendeur || '',
            v.montant || 0,
            v.latitude_saisie,
            v.longitude_saisie,
            v.horodatage,
            pdvId,
          ]
        );
        imported++;
      }
    });
    return imported;
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

    const ventesResult = await this.syncVentes();
    const positionsResult = await this.syncPositions();
    return {
      success: true,
      synced: (ventesResult.synced || 0) + (positionsResult.synced || 0),
    };
  }
}

export const syncService = new SyncService();
export default syncService;
