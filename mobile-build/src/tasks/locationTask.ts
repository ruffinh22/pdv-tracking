import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { syncService } from '@/services/syncService';

export const LOCATION_TASK_NAME = 'tracking-pdv-background-location';

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('[locationTask] Erreur:', error);
      return;
    }
    const { locations } = (data as { locations: Location.LocationObject[] }) || {
      locations: [],
    };
    if (!locations || locations.length === 0) return;

    const last = locations[locations.length - 1];
    try {
      await syncService.savePositionLocally({
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
        horodatage: new Date(last.timestamp).toISOString(),
        accuracy: last.coords.accuracy,
      });
      // Tentative de synchronisation opportuniste (silencieuse si hors-ligne)
      await syncService.syncPositions();
    } catch (e) {
      console.error('[locationTask] Erreur sauvegarde position:', e);
    }
  });
}

export async function startBackgroundLocationTracking(intervalMs: number, distanceM: number) {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
    () => false
  );
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: intervalMs,
    distanceInterval: distanceM,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Tracking PDV actif',
      notificationBody: 'Votre position est enregistrée en arrière-plan.',
    },
  });
}

export async function stopBackgroundLocationTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
    () => false
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
