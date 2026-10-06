import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { relancerEtEnvoyer } from '@/tasks/watchdogTask';

/**
 * Réveil à distance : le serveur envoie une notification silencieuse aux
 * terminaux muets. Même app fermée, cette tâche relance le suivi et envoie une position.
 */
export const REVEIL_TASK_NAME = 'tracking-pdv-reveil';

if (Platform.OS === 'android' && !TaskManager.isTaskDefined(REVEIL_TASK_NAME)) {
  TaskManager.defineTask(REVEIL_TASK_NAME, async () => {
    try {
      await relancerEtEnvoyer();
    } catch (e) {
      console.warn('[reveil]', e);
    }
  });
}

export async function enregistrerReveil(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.registerTaskAsync(REVEIL_TASK_NAME);
  } catch (e) {
    console.warn('[reveil] Enregistrement impossible:', e);
  }
}
