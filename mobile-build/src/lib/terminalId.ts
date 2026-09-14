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
 * protéger un secret — Math.random suffit et évite d'ajouter une dépendance
 * native (expo-crypto) pour ce seul besoin.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retourne l'ID terminal déjà associé à cet appareil, ou en génère un nouveau
 * et le persiste au premier lancement. Cet identifiant remplace l'ancienne
 * saisie manuelle du numéro MSISDN : l'utilisateur n'a plus rien à taper,
 * l'app identifie l'appareil elle-même, de façon stable tant qu'elle n'est
 * pas désinstallée.
 */
export async function getOrCreateTerminalId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(TERMINAL_ID_KEY);
  if (existing) return existing;

  const id = generateUUID();
  await SecureStore.setItemAsync(TERMINAL_ID_KEY, id);
  return id;
}

/**
 * Version courte et lisible d'un ID terminal pour l'affichage dans les
 * en-têtes d'écran (ex: "Terminal · 9F3A2C1D"), où l'UUID complet prendrait
 * trop de place. L'ID complet reste visible sur l'écran Profil.
 */
export function formatTerminalIdShort(terminalId: string | null | undefined): string {
  if (!terminalId) return '';
  const cleaned = terminalId.replace(/-/g, '').toUpperCase();
  return `Terminal · ${cleaned.slice(0, 8)}`;
}
