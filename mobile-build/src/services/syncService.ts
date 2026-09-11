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

  async saveVenteLocally(vente: VenteInput): Promise<boolean> {
    try {
      const db = await this.ensureDb();
      const pdvId = await getSecureItem('pdvId');

      // Always insert locally first to keep a record for history/UX.
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

      // Try immediate server persistence when online and when we have a pdvId.
      const online = await this.checkConnection();
      if (online && pdvId) {
        try {
          await api.post('/ventes/mobile/create', {
            pdv_id: pdvId ? Number(pdvId) : undefined,
            produit: vente.produit,
            nom_concessionnaire: vente.nom_concessionnaire || '',
            nom_vendeur: vente.nom_vendeur || '',
            contact_vendeur: vente.contact_vendeur || '',
            latitude_saisie: vente.latitude,
            longitude_saisie: vente.longitude,
            horodatage: vente.horodatage,
            montant: vente.montant || 0,
          });

          // Mark local row as synchronized so it won't be re-sent.
          if (insertId) {
            await db.runAsync('UPDATE ventes SET synchronise = 1 WHERE id = ?', [insertId]);
          }
        } catch (error) {
          // If server call fails, keep the local row as unsynchronized for retry later.
          console.warn('[sync] Envoi immédiat vente échoué, conservation locale pour resynchronisation', error);
        }
      } else if (!pdvId) {
        console.info('[sync] Pas d\'identifiant PDV (pdvId) trouvé — enregistrement local uniquement.');
      }

      return true;
    } catch (error) {
      console.error('[sync] Erreur enregistrement vente locale:', error);
      return false;
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

  async syncVentes(): Promise<{ success: boolean; synced: number }> {
    try {
      const db = await this.ensureDb();
      const ventes = await db.getAllAsync(
        'SELECT * FROM ventes WHERE synchronise = 0'
      );
      if (ventes.length === 0) return { success: true, synced: 0 };

      const pdvId = await getSecureItem('pdvId');
      let synced = 0;

      for (const vente of ventes) {
        try {
          // determine pdv id to send: prefer the row's pdv_id, fallback to stored pdvId
          const sendPdvId = vente.pdv_id || (pdvId ? Number(pdvId) : undefined);
          if (!sendPdvId) {
            console.warn(`[sync] Ignorer vente ${vente.id} sans pdv_id (attente d'onboarding)`);
            continue;
          }

          await api.post('/ventes/mobile/create', {
            pdv_id: sendPdvId,
            produit: vente.produit,
            nom_concessionnaire: vente.nom_concessionnaire,
            nom_vendeur: vente.nom_vendeur,
            contact_vendeur: vente.contact_vendeur,
            latitude_saisie: vente.latitude,
            longitude_saisie: vente.longitude,
            horodatage: vente.horodatage,
            montant: vente.montant || 0,
          });
          await db.runAsync('UPDATE ventes SET synchronise = 1 WHERE id = ?', [vente.id]);
          synced++;
        } catch (error) {
          console.error(`[sync] Échec sync vente ${vente.id}:`, error);
        }
      }
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
      let synced = 0;

      for (const position of positions) {
        try {
          await api.post('/positions/mobile/create', {
            pdv_id: pdvId ? Number(pdvId) : undefined,
            latitude: position.latitude,
            longitude: position.longitude,
            horodatage: position.horodatage,
          });
          await db.runAsync('UPDATE positions SET synchronise = 1 WHERE id = ?', [position.id]);
          synced++;
        } catch (error) {
          console.error(`[sync] Échec sync position ${position.id}:`, error);
        }
      }
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

  async checkConnection(): Promise<boolean> {
    try {
      await api.get('/health', { timeout: 5000 });
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
