import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from '@/lib/secureStore';
import * as Location from 'expo-location';
import { initDatabase } from '@/lib/database';
import { api } from '@/lib/api';
import { CONFIG } from '@/config';
import { syncService } from '@/services/syncService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '@/tasks/locationTask';
import { GPSPoint, Produit, SyncStatus, VenteLocale } from '@/types';

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
        const onboarded = await SecureStore.getItemAsync('isOnboarded');
        if (onboarded === 'true') {
          const savedMsisdn = await SecureStore.getItemAsync('msisdn');
          const savedPdvId = await SecureStore.getItemAsync('pdvId');
          const savedLat = await SecureStore.getItemAsync('initialLat');
          const savedLng = await SecureStore.getItemAsync('initialLng');
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

      const point: GPSPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      };
      setCurrentLocation(point);

      try {
        // Compte déjà existant → connexion
        try {
          const { data: existing } = await api.post('/pdv/mobile/login', { msisdn: msisdnInput });
          if (existing?.id) {
            await SecureStore.setItemAsync('pdvId', String(existing.id));
            await SecureStore.setItemAsync('msisdn', msisdnInput);
            await SecureStore.setItemAsync('isOnboarded', 'true');
            await SecureStore.setItemAsync('initialLat', String(existing.latitude_creation ?? point.latitude));
            await SecureStore.setItemAsync('initialLng', String(existing.longitude_creation ?? point.longitude));
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

        await SecureStore.setItemAsync('pdvId', String(created.id));
        await SecureStore.setItemAsync('msisdn', msisdnInput);
        await SecureStore.setItemAsync('isOnboarded', 'true');
        await SecureStore.setItemAsync('initialLat', String(point.latitude));
        await SecureStore.setItemAsync('initialLng', String(point.longitude));

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
    await SecureStore.deleteItemAsync('pdvId');
    await SecureStore.deleteItemAsync('msisdn');
    await SecureStore.deleteItemAsync('isOnboarded');
    await SecureStore.deleteItemAsync('initialLat');
    await SecureStore.deleteItemAsync('initialLng');
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
