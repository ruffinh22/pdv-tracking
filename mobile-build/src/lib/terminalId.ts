import { Platform } from 'react-native';

// Mock storage for web — mirrors the fallback used elsewhere in the app so
// behaviour stays consistent across a web session.
const webStorage: Record<string, string> = {};

let SecureStore: any = {
  getItemAsync: async (key: string) => webStorage[key] || null,
  setItemAsync: async (key: string, value: string) => {
    webStorage[key] = value;
  },
};

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('[terminalId] expo-secure-store indisponible:', e);
  }
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SecureStore = require('./secureStoreMock');
  } catch (e) {
    // repli sur le mock local ci-dessus
  }
}

export const TERMINAL_ID_KEY = 'terminalId';

/**
 * Génère un UUID v4. Un générateur cryptographique n'est pas nécessaire ici :
 * l'ID terminal sert uniquement à distinguer les appareils entre eux, pas à
 * protéger un secret.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Tente de récupérer un identifiant fourni par le système d'exploitation
 * (ANDROID_ID sur Android, identifierForVendor sur iOS).
 *
 * C'est préférable à un UUID tiré au sort : ces valeurs survivent à une
 * réinstallation de l'app sur Android, donc un terminal réinstallé retrouve
 * son PDV au lieu d'en créer un doublon côté serveur. `expo-application` peut
 * ne pas être installé (ou indisponible sur le web) : dans ce cas on retombe
 * silencieusement sur l'UUID, qui reste parfaitement fonctionnel tant que
 * l'app n'est pas désinstallée.
 */
async function getDeviceIdentifier(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Application = require('expo-application');

    if (Platform.OS === 'android' && Application.getAndroidId) {
      const androidId = Application.getAndroidId();
      if (androidId) return `and-${androidId}`;
    }
    if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
      const vendorId = await Application.getIosIdForVendorAsync();
      if (vendorId) return `ios-${vendorId}`;
    }
  } catch {
    // expo-application absent du build : repli sur l'UUID
  }
  return null;
}

/**
 * Retourne l'identifiant unique de ce terminal, en le générant et en le
 * persistant au premier lancement.
 *
 * C'est cette valeur qui est envoyée au serveur comme `terminal_id` lors de
 * l'enrôlement : elle identifie le PDV de façon stable, sans que l'utilisateur
 * ait quoi que ce soit à saisir. Le serveur s'en sert comme clé d'idempotence,
 * donc un même terminal qui se reconnecte retombe toujours sur son dossier.
 */
export async function getOrCreateTerminalId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(TERMINAL_ID_KEY);
  if (existing) return existing;

  const id = (await getDeviceIdentifier()) || generateUUID();
  await SecureStore.setItemAsync(TERMINAL_ID_KEY, id);
  return id;
}

/**
 * Version courte et lisible d'un ID terminal pour l'affichage dans les
 * en-têtes d'écran (ex: "Terminal · 9F3A2C1D"), où l'ID complet prendrait trop
 * de place. L'ID complet reste visible sur l'écran Profil.
 */
export function formatTerminalIdShort(terminalId: string | null | undefined): string {
  if (!terminalId) return '';
  const cleaned = terminalId.replace(/-/g, '').toUpperCase();
  return `Terminal · ${cleaned.slice(0, 8)}`;
}
