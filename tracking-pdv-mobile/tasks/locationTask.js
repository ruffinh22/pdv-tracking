import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import syncService from '../services/syncService';
import { CONFIG } from '../config';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  try {
    if (error) {
      console.error('Erreur dans la tâche de location:', error);
      return;
    }

    if (data) {
      const { pdvId } = data;
      
      // Démarrer le tracking de position
      await Location.startLocationUpdatesAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // Toutes les 60 secondes
        distanceInterval: 10, // Ou tous les 10 mètres
      });

      // Sauvegarder les positions localement
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 10,
      }, async (newLocation) => {
        try {
          // Sauvegarder localement
          await syncService.savePositionLocally({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            horodatage: new Date().toISOString(),
            accuracy: newLocation.coords.accuracy
          });

          // Tenter de synchroniser avec le serveur
          await syncService.syncPositions();
        } catch (error) {
          console.error('Erreur lors de la sauvegarde de la position:', error);
        }
      });

      console.log('Tâche de tracking en arrière-plan démarrée');
    }
  } catch (error) {
    console.error('Erreur dans la tâche de location:', error);
  }
});