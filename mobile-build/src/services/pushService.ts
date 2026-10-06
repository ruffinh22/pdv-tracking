import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';

/** Envoie au serveur le jeton de notification du terminal (une fois par changement). */
export async function enregistrerPushToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const pdvId = await SecureStore.getItemAsync('pdvId');
    if (!pdvId) return;

    await Notifications.requestPermissionsAsync().catch(() => {});
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    if ((await SecureStore.getItemAsync('pushTokenEnvoye')) === token) return;
    await api.post('/positions/mobile/push-token', { pdv_id: Number(pdvId), push_token: token }, { timeout: 15000 });
    await SecureStore.setItemAsync('pushTokenEnvoye', token);
  } catch (e) {
    console.warn('[push] Enregistrement du jeton impossible:', e);
  }
}
