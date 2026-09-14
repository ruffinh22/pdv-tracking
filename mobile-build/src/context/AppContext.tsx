import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { initDatabase, clearAllData } from '@/lib/database';
import { api } from '@/lib/api';
import { CONFIG } from '@/config';
import { syncService } from '@/services/syncService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '@/tasks/locationTask';
import { getOrCreateTerminalId } from '@/lib/terminalId';
import { GPSPoint, Produit, SyncStatus, VenteLocale } from '@/types';

// Mock storage for web
const webStorage: Record<string, string> = {};

// Conditional imports for native-only modules
let SecureStore: any = {
  getItemAsync: async (key: string) => webStorage[key] || null,
  setItemAsync: async (key: string, value: string) => { webStorage[key] = value; },
  deleteItemAsync: async (key: string) => { delete webStorage[key]; },
};

let Location: any = {
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => ({
    coords: { latitude: 0, longitude: 0, accuracy: 0 },
    timestamp: Date.now(),
  }),
  Accuracy: { High: 'high', Balanced: 'balanced' },
};

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
    Location = require('expo-location');
  } catch (e) {
    console.warn('[AppContext] Native modules not available:', e);
  }
}

// Use shared secureStoreMock on web for consistent secure storage across modules
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // Note: path relative to this file -> ../lib/secureStoreMock
    SecureStore = require('../lib/secureStoreMock');
  } catch (e) {
    // fallback to local in-file mock
  }
}

const getSecureItem = async (key: string): Promise<string | null> => {
  return await SecureStore.getItemAsync(key);
};
const setSecureItem = async (key: string, value: string): Promise<void> => {
  await SecureStore.setItemAsync(key, value);
};
const deleteSecureItem = async (key: string): Promise<void> => {
  await SecureStore.deleteItemAsync(key);
};

interface AppContextValue {
  bootstrapping: boolean;
  isOnboarded: boolean;
  terminalId: string;
  pdvId: string | null;
  initialLocation: GPSPoint | null;
  currentLocation: GPSPoint | null;
  isTracking: boolean;
  produits: Produit[];
  pendingVentes: VenteLocale[];
  history: VenteLocale[];
  syncStatus: SyncStatus;
  lastSyncedCount: number | null;
  register: () => Promise<{ ok: boolean; message?: string }>;
  refreshLocation: () => Promise<GPSPoint | null>;
  refreshHistory: () => Promise<void>;
  loadProducts: () => Promise<void>;
  syncNow: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

/**
 * Récupère une position GPS rapidement plutôt que d'attendre une précision
 * maximale. `Accuracy.High` peut mettre 10-30s (voire plus) à converger en
 * intérieur ou avec un signal faible — largement suffisant pour un tracking
 * au mètre près, mais inutile ici : la géofence a un rayon de 500m. On utilise
 * `Balanced` (assisté réseau, beaucoup plus rapide) avec un timeout court, et
 * si même ça traîne, on retombe sur la dernière position connue (quasi
 * instantanée) plutôt que de bloquer l'utilisateur indéfiniment.
 */
async function getFastLocation(LocationModule: any) {
  const freshFix = LocationModule.getCurrentPositionAsync({
    accuracy: LocationModule.Accuracy.Balanced,
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));

  const loc = await Promise.race([freshFix, timeout]);
  if (loc) return loc;

  try {
    const lastKnown = await LocationModule.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (lastKnown) return lastKnown;
  } catch {
    // pas de position en cache non plus, on retente la position fraîche ci-dessous
  }

  // Dernier recours : on attend la position fraîche jusqu'au bout, tant pis pour le délai.
  return freshFix;
}

/**
 * Un message d'erreur diagnostique plutôt que le générique "vérifiez votre
 * connexion" : quand axios ne reçoit AUCUNE réponse (error.request existe mais
 * pas error.response), c'est très souvent que l'app n'arrive pas à joindre
 * l'adresse configurée (mauvais réseau Wi‑Fi, IP du serveur qui a changé) —
 * on le dit explicitement avec l'URL utilisée pour que ce soit diagnosticable
 * sur le terrain, au lieu de faire deviner à l'utilisateur.
 */
function networkErrorMessage(error: any): string {
  if (error?.code === 'ECONNABORTED') {
    return `Le serveur (${CONFIG.API_BASE_URL}) met trop de temps à répondre. Réessayez, ou vérifiez que le serveur est bien démarré.`;
  }
  if (error?.request && !error?.response) {
    return `Serveur injoignable à l'adresse ${CONFIG.API_BASE_URL}. Vérifiez que votre téléphone est sur le même réseau Wi‑Fi que le serveur, et que l'adresse configurée est correcte.`;
  }
  return 'Impossible de créer votre compte. Vérifiez votre connexion réseau.';
}

/**
 * Re-remplit la base locale avec l'historique serveur d'un PDV existant —
 * utile après une reconnexion suivant un "purge" (déconnexion), qui vide la
 * base locale. Ne fait rien si la base locale a déjà des ventes (cas normal
 * de reconnexion sans purge) : ni appel réseau superflu, ni doublon, et ça
 * reste quasi instantané dans le cas courant.
 */
async function pullHistoryFromServer(pdvId: string): Promise<void> {
  try {
    const alreadyHasData = await syncService.hasLocalHistory();
    if (alreadyHasData) return;

    const { data } = await api.get(`/ventes/mobile/history/${pdvId}`, { timeout: 8000 });
    const ventes = Array.isArray(data) ? data : data?.data || [];
    if (ventes.length > 0) {
      await syncService.importVentesFromServer(Number(pdvId), ventes);
    }
  } catch (error) {
    // Best-effort : on ne bloque jamais la connexion pour ça, l'utilisateur
    // pourra retenter plus tard (le prochain login réessaiera automatiquement
    // puisque la base locale sera toujours vide).
    console.warn('[app] Récupération historique serveur échouée (non-bloquant):', error);
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [terminalId, setTerminalId] = useState('');
  const [pdvId, setPdvId] = useState<string | null>(null);
  const [initialLocation, setInitialLocation] = useState<GPSPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [pendingVentes, setPendingVentes] = useState<VenteLocale[]>([]);
  const [history, setHistory] = useState<VenteLocale[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null);

  const refreshHistory = useCallback(async () => {
    const [all, pending] = await Promise.all([
      syncService.getVentesHistory(),
      syncService.getPendingVentes(),
    ]);
    setHistory(all);
    setPendingVentes(pending);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/produits/list', { params: { all: 'true' }, timeout: 8000 });
      const list = Array.isArray(data) ? data : data?.data || [];
      setProduits(list);
    } catch (error) {
      console.warn('[app] Erreur chargement produits (non bloquante):', error);
      setProduits([]);
    }
  }, []);

  const beginTracking = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsTracking(true);
      return;
    }
    
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') return;

    await startBackgroundLocationTracking(
      CONFIG.LOCATION.TRACKING_INTERVAL,
      CONFIG.LOCATION.TRACKING_DISTANCE
    );
    setIsTracking(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const onboarded = await getSecureItem('isOnboarded');
        if (onboarded === 'true') {
          // Lectures indépendantes du stockage sécurisé : en parallèle plutôt qu'en
          // chaîne, pour ne pas cumuler leurs latences une par une au démarrage.
          // On relit aussi l'ancienne clé "msisdn" en repli, pour les terminaux déjà
          // associés avant ce changement — leur session reste valide sans qu'ils
          // aient à se réassocier.
          const [savedTerminalId, savedLegacyMsisdn, savedPdvId, savedLat, savedLng] = await Promise.all([
            getSecureItem('terminalId'),
            getSecureItem('msisdn'),
            getSecureItem('pdvId'),
            getSecureItem('initialLat'),
            getSecureItem('initialLng'),
          ]);
          setTerminalId(savedTerminalId || savedLegacyMsisdn || '');
          setPdvId(savedPdvId);
          if (savedLat && savedLng) {
            setInitialLocation({ latitude: Number(savedLat), longitude: Number(savedLng) });
          }
          setIsOnboarded(true);
          // Historique local (rapide, SQLite) et catalogue produit (réseau) n'ont pas
          // de dépendance entre eux : on les lance en parallèle. Le tracking démarre
          // en même temps plutôt que d'attendre la fin des deux précédents.
          await Promise.all([refreshHistory(), loadProducts(), beginTracking()]);
        }
      } catch (error) {
        console.error('[app] Erreur bootstrap:', error);
      } finally {
        setBootstrapping(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshLocation = useCallback(async () => {
    if (Platform.OS === 'web') {
      const point: GPSPoint | null = await new Promise<GPSPoint | null>((resolve) => {
        if (!navigator || !navigator.geolocation) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            resolve({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? 0,
              timestamp: Date.now(),
            });
          },
          () => {
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
        );
      });

      setCurrentLocation(point);
      return point;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await getFastLocation(Location);
      const point: GPSPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        timestamp: loc.timestamp,
      };
      setCurrentLocation(point);
      return point;
    } catch (error) {
      console.error('[app] Erreur GPS:', error);
      return null;
    }
  }, []);

  const register = useCallback(
    async (): Promise<{ ok: boolean; message?: string }> => {
      // L'ID terminal n'est plus saisi par l'utilisateur : il est généré une
      // seule fois par l'app puis persisté sur l'appareil (voir lib/terminalId).
      const deviceTerminalId = await getOrCreateTerminalId();
      let point: GPSPoint | null = null;

      if (Platform.OS === 'web') {
        point = await new Promise<GPSPoint | null>((resolve) => {
            if (!navigator || !navigator.geolocation) {
              resolve(null);
              return;
            }

            navigator.geolocation.getCurrentPosition(
              ({ coords }) => {
                resolve({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy ?? 0,
                  timestamp: Date.now(),
                });
              },
              () => {
                resolve(null);
              },
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
            );
          });

          if (!point) {
            return { ok: false, message: 'Impossible d\'obtenir la position GPS. Autorisez la géolocalisation dans votre navigateur.' };
          }
          setCurrentLocation(point);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return { ok: false, message: "La permission de localisation est requise pour continuer." };
        }

        let loc;
        try {
          loc = await getFastLocation(Location);
        } catch {
          return { ok: false, message: "Impossible d'obtenir votre position GPS. Vérifiez que le GPS est activé." };
        }

        point = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        };
        setCurrentLocation(point);
      }

      try {
        // Un seul aller-retour réseau : le backend renvoie le PDV existant s'il
        // y en a un pour cet ID terminal, sinon en crée un nouveau — au lieu de
        // l'ancien pattern "login qui échoue puis register" qui coûtait
        // systématiquement 2 requêtes séquentielles à la création d'un compte.
        //
        // Note : le champ réseau reste `msisdn_responsable` pour ne pas casser
        // le backend / la base existante — seule sa valeur change de sens,
        // elle transporte désormais l'ID terminal généré par l'app plutôt
        // qu'un numéro de téléphone saisi à la main.
        const { data: pdv } = await api.post(
          '/pdv/mobile/upsert',
          {
            nom_pdv: `PDV ${deviceTerminalId.slice(0, 8).toUpperCase()}`,
            msisdn_responsable: deviceTerminalId,
            latitude_creation: point.latitude,
            longitude_creation: point.longitude,
            device_info: { platform: 'mobile', version: '1.1.0', timestamp: new Date().toISOString() },
          },
          { timeout: 8000 }
        );

        if (!pdv?.id) {
          return { ok: false, message: 'Réponse invalide du serveur.' };
        }

        const lat = Number(pdv.latitude_creation ?? point.latitude);
        const lng = Number(pdv.longitude_creation ?? point.longitude);

        await setSecureItem('pdvId', String(pdv.id));
        await setSecureItem('terminalId', deviceTerminalId);
        await setSecureItem('isOnboarded', 'true');
        await setSecureItem('initialLat', String(lat));
        await setSecureItem('initialLng', String(lng));

        setPdvId(String(pdv.id));
        setTerminalId(deviceTerminalId);
        setInitialLocation({ latitude: lat, longitude: lng });
        setIsOnboarded(true);

        // pullHistoryFromServer ne fait rien (et n'appelle pas le réseau) si la
        // base locale a déjà des données — donc pas de coût pour un nouveau compte.
        await Promise.all([pullHistoryFromServer(String(pdv.id)), loadProducts(), beginTracking()]);
        await refreshHistory();
        return { ok: true };
      } catch (error: any) {
        const message = error?.response?.data?.error || networkErrorMessage(error);
        return { ok: false, message };
      }
    },
    [beginTracking, loadProducts, refreshHistory]
  );

  const syncNow = useCallback(async () => {
    setSyncStatus('syncing');
    const result = await syncService.autoSync();
    setSyncStatus(result.success ? 'success' : 'error');
    setLastSyncedCount(result.synced);
    await refreshHistory();
    setTimeout(() => setSyncStatus('idle'), 2500);
  }, [refreshHistory]);

  const logout = useCallback(async () => {
    // Clear UI state and local session immediately so the app appears logged out.
    setIsTracking(false);
    setSyncStatus('idle');
    setLastSyncedCount(null);

    setIsOnboarded(false);
    setTerminalId('');
    setPdvId(null);
    setInitialLocation(null);
    setCurrentLocation(null);
    setHistory([]);
    setPendingVentes([]);
    setProduits([]);

    // Remove secure items (best-effort). Do not let failures prevent UI logout.
    // Note : on garde volontairement `terminalId` — c'est l'identité stable de
    // cet appareil. Se déconnecter remet l'écran d'association, mais tant que
    // l'app n'est pas désinstallée, elle retrouve le même PDV côté backend
    // (upsert) sans jamais redemander de saisie à l'utilisateur.
    try {
      await Promise.all([
        deleteSecureItem('pdvId'),
        deleteSecureItem('msisdn'),
        deleteSecureItem('isOnboarded'),
        deleteSecureItem('initialLat'),
        deleteSecureItem('initialLng'),
      ]);
    } catch (error) {
      console.warn('[app] Erreur lors de la suppression des identifiants locaux:', error);
    }

    // Clear local DB/persistence (best-effort). This removes local ventes/positions so
    // history doesn't persist after logout.
    try {
      await clearAllData();
    } catch (error) {
      console.warn('[app] Erreur lors du nettoyage de la base locale:', error);
    }

    // Attempt to stop background tracking but don't block logout flow on failures or delays.
    stopBackgroundLocationTracking().catch((error) => {
      console.warn('[app] Erreur pendant l\'arrêt du tracking en arrière-plan (non-bloquant):', error);
    });
  }, []);

  // If the app is not onboarded, redirect to onboarding.
  useEffect(() => {
    if (!bootstrapping && !isOnboarded) {
      try {
        router.replace('/onboarding');
      } catch (e) {
        // ignore routing errors
      }
    }
  }, [bootstrapping, isOnboarded]);

  const value = useMemo<AppContextValue>(
    () => ({
      bootstrapping,
      isOnboarded,
      terminalId,
      pdvId,
      initialLocation,
      currentLocation,
      isTracking,
      produits,
      pendingVentes,
      history,
      syncStatus,
      lastSyncedCount,
      register,
      refreshLocation,
      refreshHistory,
      loadProducts,
      syncNow,
      logout,
    }),
    [
      bootstrapping,
      isOnboarded,
      terminalId,
      pdvId,
      initialLocation,
      currentLocation,
      isTracking,
      produits,
      pendingVentes,
      history,
      syncStatus,
      lastSyncedCount,
      register,
      refreshLocation,
      refreshHistory,
      loadProducts,
      syncNow,
      logout,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé sous <AppProvider>');
  return ctx;
}