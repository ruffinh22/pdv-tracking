import { Platform } from 'react-native';
import { syncService } from '@/services/syncService';

// Mock modules for web
const mockLocation = {
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: async () => {},
  stopLocationUpdatesAsync: async () => {},
  Accuracy: { Balanced: 'balanced' },
};

const mockTaskManager = {
  isTaskDefined: () => false,
  defineTask: () => {},
};

// Conditional imports for native-only modules
let Location: any = mockLocation;
let TaskManager: any = mockTaskManager;

if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
    TaskManager = require('expo-task-manager');
  } catch (e) {
    console.warn('[locationTask] Native modules not available:', e);
  }
}

export const LOCATION_TASK_NAME = 'tracking-pdv-background-location';

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('[locationTask] Erreur:', error);
      return;
    }
    const { locations } = (data as { locations: any[] }) || {
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
      // Synchronisation opportuniste en arrière-plan, SANS l'attendre : cette
      // tâche tourne à chaque tick GPS (potentiellement toutes les 30s), et le
      // système d'exploitation peut throttle/tuer une tâche background trop
      // lente. L'écriture locale (rapide) suffit pour que le tick soit "fait" ;
      // syncPositions() gère elle-même les tentatives suivantes de toute façon.
      syncService.syncPositions().catch((e) => {
        console.warn('[locationTask] Sync positions différée (non-bloquant):', e);
      });
    } catch (e) {
      console.error('[locationTask] Erreur sauvegarde position:', e);
    }
  });
}

export async function startBackgroundLocationTracking(intervalMs: number, distanceM: number) {
  if (Platform.OS === 'web') {
    console.log('[locationTask] Background tracking not supported on web');
    return;
  }
  
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
  if (Platform.OS === 'web') {
    console.log('[locationTask] Background tracking not supported on web');
    return;
  }
  
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
    () => false
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
