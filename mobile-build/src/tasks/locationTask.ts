import { Platform } from 'react-native';
import { syncService } from '@/services/syncService';
import { CONFIG } from '@/config';

// Mock modules for web
const mockLocation = {
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: async () => {},
  stopLocationUpdatesAsync: async () => {},
  Accuracy: { High: 'high' },
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

    // Tous les points reçus sont conservés (le système peut les livrer par
    // paquet) ; la synchro part en tâche de fond sans être attendue, car l'OS
    // peut limiter ou tuer une tâche d'arrière-plan trop lente.
    // Un paquet de plusieurs points est un rattrapage : on ne le filtre pas.
    const ecartMin = locations.length > 1 ? 0 : CONFIG.LOCATION.MIN_SAVE_GAP_MS;
    for (const location of locations) {
      try {
        await syncService.enregistrerEtEnvoyer(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          },
          ecartMin
        );
      } catch (e) {
        console.error('[locationTask] Erreur sauvegarde position:', e);
      }
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
    accuracy: Location.Accuracy.High,
    timeInterval: intervalMs,
    distanceInterval: distanceM,
    showsBackgroundLocationIndicator: true,
    // iOS suspend sinon les mises à jour dès que l'appareil est immobile : le
    // PDV deviendrait muet alors que l'agent est simplement posé.
    pausesUpdatesAutomatically: false,
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

/**
 * Redémarrage forcé : certains téléphones laissent la tâche « démarrée » mais
 * silencieuse après une coupure/réactivation du GPS. Un stop+start la relance.
 */
export async function restartBackgroundLocationTracking(intervalMs: number, distanceM: number) {
  if (Platform.OS === 'web') return;
  await stopBackgroundLocationTracking().catch(() => {});
  await startBackgroundLocationTracking(intervalMs, distanceM);
}
