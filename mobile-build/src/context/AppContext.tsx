import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { initDatabase } from '@/lib/database';
import { api } from '@/lib/api';
import { CONFIG } from '@/config';
import { syncService } from '@/services/syncService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '@/tasks/locationTask';
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
  msisdn: string;
  pdvId: string | null;
  initialLocation: GPSPoint | null;
  currentLocation: GPSPoint | null;
  isTracking: boolean;
  produits: Produit[];
  pendingVentes: VenteLocale[];
  history: VenteLocale[];
  syncStatus: SyncStatus;
  lastSyncedCount: number | null;
  register: (msisdn: string) => Promise<{ ok: boolean; message?: string }>;
  refreshLocation: () => Promise<GPSPoint | null>;
  refreshHistory: () => Promise<void>;
  loadProducts: () => Promise<void>;
  syncNow: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [msisdn, setMsisdn] = useState('');
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
      const { data } = await api.get('/produits/list', { params: { all: 'true' } });
      const list = Array.isArray(data) ? data : data?.data || [];
      setProduits(list);
    } catch (error) {
      console.error('[app] Erreur chargement produits:', error);
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
          const savedMsisdn = await getSecureItem('msisdn');
          const savedPdvId = await getSecureItem('pdvId');
          const savedLat = await getSecureItem('initialLat');
          const savedLng = await getSecureItem('initialLng');
          setMsisdn(savedMsisdn || '');
          setPdvId(savedPdvId);
          if (savedLat && savedLng) {
            setInitialLocation({ latitude: Number(savedLat), longitude: Number(savedLng) });
          }
          setIsOnboarded(true);
          await refreshHistory();
          await loadProducts();
          await beginTracking();
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
      const point: GPSPoint = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: Date.now(),
      };
      setCurrentLocation(point);
      return point;
    }
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
    async (msisdnInput: string): Promise<{ ok: boolean; message?: string }> => {
      let point: GPSPoint;
      
      if (Platform.OS === 'web') {
        point = {
          latitude: 0,
          longitude: 0,
          accuracy: 0,
        };
        setCurrentLocation(point);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return { ok: false, message: "La permission de localisation est requise pour continuer." };
        }

        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
        // Compte déjà existant → connexion
        try {
          const { data: existing } = await api.post('/pdv/mobile/login', { msisdn: msisdnInput });
          if (existing?.id) {
            await setSecureItem('pdvId', String(existing.id));
            await setSecureItem('msisdn', msisdnInput);
            await setSecureItem('isOnboarded', 'true');
            await setSecureItem('initialLat', String(existing.latitude_creation ?? point.latitude));
            await setSecureItem('initialLng', String(existing.longitude_creation ?? point.longitude));
            setPdvId(String(existing.id));
            setMsisdn(msisdnInput);
            setInitialLocation({
              latitude: Number(existing.latitude_creation ?? point.latitude),
              longitude: Number(existing.longitude_creation ?? point.longitude),
            });
            setIsOnboarded(true);
            await refreshHistory();
            await loadProducts();
            await beginTracking();
            return { ok: true };
          }
        } catch {
          // pas de compte existant, on continue vers la création
        }

        const { data: created } = await api.post('/pdv/mobile/register', {
          nom_pdv: `PDV ${msisdnInput}`,
          msisdn_responsable: msisdnInput,
          latitude_creation: point.latitude,
          longitude_creation: point.longitude,
          statut: 'actif',
          device_info: { platform: 'mobile', version: '1.1.0', timestamp: new Date().toISOString() },
        });

        if (!created?.id) {
          return { ok: false, message: 'Réponse invalide du serveur.' };
        }

        await setSecureItem('pdvId', String(created.id));
        await setSecureItem('msisdn', msisdnInput);
        await setSecureItem('isOnboarded', 'true');
        await setSecureItem('initialLat', String(point.latitude));
        await setSecureItem('initialLng', String(point.longitude));

        setPdvId(String(created.id));
        setMsisdn(msisdnInput);
        setInitialLocation(point);
        setIsOnboarded(true);
        await refreshHistory();
        await loadProducts();
        await beginTracking();
        return { ok: true };
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          "Impossible de créer votre compte. Vérifiez votre connexion réseau.";
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
    await stopBackgroundLocationTracking();
    setIsTracking(false);
    await deleteSecureItem('pdvId');
    await deleteSecureItem('msisdn');
    await deleteSecureItem('isOnboarded');
    await deleteSecureItem('initialLat');
    await deleteSecureItem('initialLng');
    setIsOnboarded(false);
    setMsisdn('');
    setPdvId(null);
    setInitialLocation(null);
    setCurrentLocation(null);
    setHistory([]);
    setPendingVentes([]);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      bootstrapping,
      isOnboarded,
      msisdn,
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
      msisdn,
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
