import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '@/config';
import { syncService } from '@/services/syncService';
import { lirePositionFraiche } from '@/lib/location';
import { LOCATION_TASK_NAME, startBackgroundLocationTracking } from '@/tasks/locationTask';

/**
 * Chien de garde système (WorkManager) : tourne même app fermée et après un
 * redémarrage du téléphone, environ toutes les 15 min (minimum imposé par Android).
 *  1. relance la tâche de localisation si elle n'est plus démarrée ;
 *  2. envoie une position de secours, pour que le PDV reste visible même si le
 *     service au premier plan n'a pas pu être relancé.
 * Il ne fait rien tant que le terminal n'est pas enrôlé.
 */
export const WATCHDOG_TASK_NAME = 'tracking-pdv-watchdog';

/** Relance le suivi s'il est arrêté puis envoie une position. Partagé avec le réveil push. */
export async function relancerEtEnvoyer(): Promise<void> {
  const enrole = await SecureStore.getItemAsync('mobilePositionToken');
  if (!enrole) return;

  const demarree = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (!demarree) {
    const perm = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (perm?.status === 'granted') {
      await startBackgroundLocationTracking(CONFIG.LOCATION.TRACKING_INTERVAL, CONFIG.LOCATION.TRACKING_DISTANCE).catch(() => {});
    }
  }

  const point = await lirePositionFraiche();
  if (point) {
    await syncService.enregistrerEtEnvoyer({ ...point, timestamp: point.timestamp ?? Date.now() }, 0);
  } else {
    await syncService.syncPositions().catch(() => {});
  }
}

if (Platform.OS === 'android' && !TaskManager.isTaskDefined(WATCHDOG_TASK_NAME)) {
  TaskManager.defineTask(WATCHDOG_TASK_NAME, async () => {
    try {
      await relancerEtEnvoyer();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      console.warn('[watchdog]', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function enregistrerWatchdog(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(WATCHDOG_TASK_NAME)) return;
    await BackgroundTask.registerTaskAsync(WATCHDOG_TASK_NAME, { minimumInterval: 15 });
  } catch (e) {
    console.warn('[watchdog] Enregistrement impossible:', e);
  }
}
