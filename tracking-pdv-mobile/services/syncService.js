import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { CONFIG } from '../config';

const DB_NAME = CONFIG.DB_CONFIG.NAME;

class SyncService {
  constructor() {
    this.db = null;
    this.isConnected = true;
  }

  async initDB() {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      console.log('Base de données ouverte');

      // Migration: ajouter la colonne montant si elle n'existe pas
      try {
        await this.db.execAsync('ALTER TABLE ventes ADD COLUMN montant REAL DEFAULT 0');
        console.log('Colonne montant ajoutée avec succès');
      } catch (error) {
        // La colonne existe déjà, ignorer l'erreur
        console.log('Colonne montant existe déjà ou erreur ignorée');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la base de données:', error);
    }
  }

  // Enregistrer une vente localement
  async saveVenteLocally(venteData) {
    try {
      if (!this.db) await this.initDB();

      const pdvId = await SecureStore.getItemAsync('pdvId');
      console.log('PDV ID pour sauvegarde:', pdvId);
      console.log('Données de vente à sauvegarder:', JSON.stringify(venteData, null, 2));
      
      await this.db.runAsync(
        `INSERT INTO ventes (produit, nom_concessionnaire, nom_vendeur, contact_vendeur, montant, latitude, longitude, horodatage, statut, pdv_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          venteData.produit,
          venteData.nom_concessionnaire || '',
          venteData.nom_vendeur || '',
          venteData.contact_vendeur || '',
          venteData.montant || 0,
          venteData.latitude,
          venteData.longitude,
          venteData.horodatage,
          'en_attente',
          pdvId
        ]
      );

      console.log('Vente enregistrée localement avec succès');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement local de la vente:', error);
      return false;
    }
  }

  // Enregistrer une position localement
  async savePositionLocally(positionData) {
    try {
      if (!this.db) await this.initDB();

      await this.db.runAsync(
        `INSERT INTO positions (latitude, longitude, horodatage, precision, synchronise) VALUES (?, ?, ?, ?, ?)`,
        [
          positionData.latitude,
          positionData.longitude,
          positionData.horodatage,
          positionData.accuracy || 0,
          0
        ]
      );

      console.log('Position enregistrée localement');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement local de la position:', error);
      return false;
    }
  }

  // Synchroniser les ventes en attente
  async syncVentes() {
    try {
      if (!this.db) await this.initDB();

      const ventes = await this.db.getAllAsync('SELECT * FROM ventes WHERE synchronise = 0');
      
      if (ventes.length === 0) {
        console.log('Aucune vente à synchroniser');
        return { success: true, synced: 0 };
      }

      const pdvId = await SecureStore.getItemAsync('pdvId');
      console.log('PDV ID pour sync:', pdvId);
      console.log('Ventes à synchroniser:', JSON.stringify(ventes, null, 2));
      
      let syncedCount = 0;

      for (const vente of ventes) {
        try {
          const venteData = {
            pdv_id: parseInt(pdvId),
            produit: vente.produit,
            nom_concessionnaire: vente.nom_concessionnaire,
            nom_vendeur: vente.nom_vendeur,
            contact_vendeur: vente.contact_vendeur,
            latitude_saisie: vente.latitude,
            longitude_saisie: vente.longitude,
            horodatage: vente.horodatage,
            montant: vente.montant || 0
          };
          
          console.log('Envoi de la vente:', JSON.stringify(venteData, null, 2));

          await axios.post(`${CONFIG.API_BASE_URL}/ventes/mobile/create`, venteData);
          
          // Marquer comme synchronisé
          await this.db.runAsync('UPDATE ventes SET synchronise = 1 WHERE id = ?', [vente.id]);
          syncedCount++;
          
          console.log(`Vente ${vente.id} synchronisée`);
        } catch (error) {
          console.error(`Erreur lors de la synchronisation de la vente ${vente.id}:`, error);
        }
      }

      return { success: true, synced: syncedCount };
    } catch (error) {
      console.error('Erreur lors de la synchronisation des ventes:', error);
      return { success: false, synced: 0 };
    }
  }

  // Synchroniser les positions en attente
  async syncPositions() {
    try {
      if (!this.db) await this.initDB();

      const positions = await this.db.getAllAsync('SELECT * FROM positions WHERE synchronise = 0');
      
      if (positions.length === 0) {
        console.log('Aucune position à synchroniser');
        return { success: true, synced: 0 };
      }

      const pdvId = await SecureStore.getItemAsync('pdvId');
      let syncedCount = 0;

      for (const position of positions) {
        try {
          const positionData = {
            pdv_id: parseInt(pdvId),
            latitude: position.latitude,
            longitude: position.longitude,
            horodatage: position.horodatage
          };

          await axios.post(`${CONFIG.API_BASE_URL}/positions/mobile/create`, positionData);
          
          // Marquer comme synchronisé
          await this.db.runAsync('UPDATE positions SET synchronise = 1 WHERE id = ?', [position.id]);
          syncedCount++;
          
          console.log(`Position ${position.id} synchronisée`);
        } catch (error) {
          console.error(`Erreur lors de la synchronisation de la position ${position.id}:`, error);
        }
      }

      return { success: true, synced: syncedCount };
    } catch (error) {
      console.error('Erreur lors de la synchronisation des positions:', error);
      return { success: false, synced: 0 };
    }
  }

  // Obtenir les ventes en attente
  async getPendingVentes() {
    try {
      if (!this.db) await this.initDB();
      const ventes = await this.db.getAllAsync('SELECT * FROM ventes WHERE synchronise = 0 ORDER BY horodatage DESC');
      return ventes;
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes en attente:', error);
      return [];
    }
  }

  // Obtenir l'historique des ventes
  async getVentesHistory() {
    try {
      if (!this.db) await this.initDB();
      const ventes = await this.db.getAllAsync('SELECT * FROM ventes ORDER BY horodatage DESC LIMIT 50');
      console.log('Historique des ventes récupéré:', ventes);
      return ventes;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des ventes:', error);
      return [];
    }
  }

  // Vérifier la connexion
  async checkConnection() {
    try {
      await axios.get(`${CONFIG.API_BASE_URL}/health`, { timeout: 5000 });
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  // Synchronisation automatique
  async autoSync() {
    try {
      const hasConnection = await this.checkConnection();
      
      if (hasConnection) {
        const ventesResult = await this.syncVentes();
        const positionsResult = await this.syncPositions();
        
        return {
          success: true,
          synced: (ventesResult.synced || 0) + (positionsResult.synced || 0)
        };
      }
      
      return { success: false, synced: 0 };
    } catch (error) {
      console.error('Erreur lors de la synchronisation automatique:', error);
      return { success: false, synced: 0 };
    }
  }
}

const syncService = new SyncService();
export default syncService;