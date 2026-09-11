import * as SecureStore from '@/lib/secureStore';
import { getDatabase, initDatabase } from '@/lib/database';
import { api } from '@/lib/api';
import { VenteInput, VenteLocale } from '@/types';

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
      const pdvId = await SecureStore.getItemAsync('pdvId');

      await db.runAsync(
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
      const ventes = await db.getAllAsync<VenteLocale>(
        'SELECT * FROM ventes WHERE synchronise = 0'
      );
      if (ventes.length === 0) return { success: true, synced: 0 };

      const pdvId = await SecureStore.getItemAsync('pdvId');
      let synced = 0;

      for (const vente of ventes) {
        try {
          await api.post('/ventes/mobile/create', {
            pdv_id: pdvId ? Number(pdvId) : undefined,
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
      const positions = await db.getAllAsync<any>(
        'SELECT * FROM positions WHERE synchronise = 0'
      );
      if (positions.length === 0) return { success: true, synced: 0 };

      const pdvId = await SecureStore.getItemAsync('pdvId');
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
    return db.getAllAsync<VenteLocale>(
      'SELECT * FROM ventes WHERE synchronise = 0 ORDER BY horodatage DESC'
    );
  }

  async getVentesHistory(limit = 100): Promise<VenteLocale[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<VenteLocale>(
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
