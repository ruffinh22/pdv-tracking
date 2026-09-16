import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { initDatabase, clearAllData } from '@/lib/database';
import { api } from '@/lib/api';
import { CONFIG } from '@/config';
import { syncService } from '@/services/syncService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '@/tasks/locationTask';
import { getOrCreateTerminalId } from '@/lib/terminalId';
import { EchecLocalisation, obtenirPosition, suivrePosition } from '@/lib/location';
import { GPSPoint, SyncStatus } from '@/types';

const webStorage: Record<string, string> = {};

let SecureStore: any = {
  getItemAsync: async (key: string) => webStorage[key] || null,
  setItemAsync: async (key: string, value: string) => {
    webStorage[key] = value;
  },
  deleteItemAsync: async (key: string) => {
    delete webStorage[key];
  },
};

let Location: any = null;

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
    Location = require('expo-location');
  } catch (error) {
    console.warn('[AppContext] Modules natifs indisponibles:', error);
  }
} else {
  try {
    SecureStore = require('../lib/secureStoreMock');
  } catch {
    // On garde le mock local.
  }
}

const getSecureItem = async (key: string): Promise<string | null> => SecureStore.getItemAsync(key);
const setSecureItem = async (key: string, value: string): Promise<void> => {
  await SecureStore.setItemAsync(key, value);
};
const deleteSecureItem = async (key: string): Promise<void> => {
  await SecureStore.deleteItemAsync(key);
};

export interface AgentInfo {
  id: number;
  nom: string;
  prenom: string;
  matricule: string;
}

export interface PDVInfo {
  id: number;
  nom_pdv?: string;
  msisdn_responsable?: string;
  concessionnaire_nom?: string;
  vendeur_nom?: string;
  contact_vendeur?: string;
  ville?: string;
  commune?: string;
  quartier?: string;
}

/**
 * État de l'acquisition GPS, explicite. C'est ce qui manquait : l'écran ne
 * disposait que de `currentLocation === null`, qui confond « en cours »,
 * « permission refusée » et « échec ». Résultat, un indicateur de chargement
 * tournait indéfiniment sans qu'on puisse savoir quoi corriger.
 */
export type EtatGPS =
  | { statut: 'inconnu' }
  | { statut: 'acquisition' }
  | { statut: 'ok'; source: 'fraiche' | 'cache' }
  | { statut: 'echec'; raison: EchecLocalisation; message: string };

interface AppContextValue {
  bootstrapping: boolean;
  isOnboarded: boolean;
  terminalId: string;
  matricule: string;
  agent: AgentInfo | null;
  pdv: PDVInfo | null;
  pdvId: string | null;
  initialLocation: GPSPoint | null;
  currentLocation: GPSPoint | null;
  etatGPS: EtatGPS;
  isTracking: boolean;
  permissionArrierePlan: boolean;
  positionsEnAttente: number;
  derniereSynchro: string | null;
  syncStatus: SyncStatus;
  lastSyncedCount: number | null;
  register: (matricule: string) => Promise<{ ok: boolean; message?: string }>;
  refreshLocation: () => Promise<GPSPoint | null>;
  refreshQueue: () => Promise<void>;
  syncNow: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

/**
 * Message d'erreur diagnostique plutôt que le générique « vérifiez votre
 * connexion » : quand axios ne reçoit AUCUNE réponse, c'est presque toujours
 * que l'app n'arrive pas à joindre l'adresse configurée.
 */
function networkErrorMessage(error: any): string {
  if (error?.code === 'ECONNABORTED') {
    return `Le serveur (${CONFIG.API_BASE_URL}) met trop de temps à répondre. Réessayez, ou vérifiez qu'il est bien démarré.`;
  }
  if (error?.request && !error?.response) {
    return `Serveur injoignable à l'adresse ${CONFIG.API_BASE_URL}. Vérifiez que votre téléphone est sur le même réseau que le serveur.`;
  }
  return "Impossible de finaliser l'association. Vérifiez votre connexion réseau.";
}

/** Décrit le terminal (marque + modèle) pour la colonne « Type_Terminal ». */
function decrireAppareil(): { marque?: string; modele?: string; os_version?: string } {
  if (Platform.OS === 'web') return {};
  try {
    const Device = require('expo-device');
    return {
      marque: Device.brand || Device.manufacturer || undefined,
      modele: Device.modelName || undefined,
      os_version: Device.osVersion || undefined,
    };
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [terminalId, setTerminalId] = useState('');
  const [matricule, setMatricule] = useState('');
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [pdv, setPdv] = useState<PDVInfo | null>(null);
  const [pdvId, setPdvId] = useState<string | null>(null);
  const [initialLocation, setInitialLocation] = useState<GPSPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [etatGPS, setEtatGPS] = useState<EtatGPS>({ statut: 'inconnu' });
  const [isTracking, setIsTracking] = useState(false);
  const [permissionArrierePlan, setPermissionArrierePlan] = useState(false);
  const [positionsEnAttente, setPositionsEnAttente] = useState(0);
  const [derniereSynchro, setDerniereSynchro] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null);

  // Évite les avertissements « setState sur composant démonté » et, surtout,
  // empêche une réponse GPS tardive d'écraser un état déjà réinitialisé.
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const enAttente = await syncService.getPendingPositions();
      if (monte.current) setPositionsEnAttente(enAttente.length);
    } catch (error) {
      console.warn('[app] Lecture de la file de positions impossible:', error);
    }
  }, []);

  /**
   * Acquisition de position. Se termine toujours : succès, ou état d'échec
   * lisible par l'écran. Aucun chemin ne peut laisser `etatGPS` sur
   * « acquisition » indéfiniment — c'était la cause du blocage.
   */
  const refreshLocation = useCallback(async (): Promise<GPSPoint | null> => {
    setEtatGPS({ statut: 'acquisition' });
    const resultat = await obtenirPosition();

    if (!monte.current) return null;

    if (resultat.ok) {
      setCurrentLocation(resultat.point);
      setEtatGPS({ statut: 'ok', source: resultat.source });
      return resultat.point;
    }

    setEtatGPS({ statut: 'echec', raison: resultat.raison, message: resultat.message });
    return null;
  }, []);

  const beginTracking = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsTracking(true);
      return;
    }
    if (!Location) return;

    try {
      const { status: premierPlan } = await Location.requestForegroundPermissionsAsync();
      if (premierPlan !== 'granted') {
        setIsTracking(false);
        return;
      }

      const { status: arrierePlan } = await Location.requestBackgroundPermissionsAsync();
      setPermissionArrierePlan(arrierePlan === 'granted');

      if (arrierePlan !== 'granted') {
        // Sans permission d'arrière-plan on ne peut pas démarrer la tâche
        // système, mais l'app reste utilisable au premier plan : on ne sort
        // plus en silence en laissant croire que le suivi tourne.
        setIsTracking(false);
        return;
      }

      await startBackgroundLocationTracking(
        CONFIG.LOCATION.TRACKING_INTERVAL,
        CONFIG.LOCATION.TRACKING_DISTANCE
      );
      setIsTracking(true);
    } catch (error) {
      console.warn('[app] Démarrage du suivi impossible:', error);
      setIsTracking(false);
    }
  }, []);

  // --- Démarrage de l'application ---------------------------------------
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const onboarded = await getSecureItem('isOnboarded');

        if (onboarded === 'true') {
          const [
            savedTerminalId,
            savedLegacyMsisdn,
            savedPdvId,
            savedPdvRaw,
            savedLat,
            savedLng,
            savedMatricule,
            savedAgent,
          ] = await Promise.all([
            getSecureItem('terminalId'),
            getSecureItem('msisdn'),
            getSecureItem('pdvId'),
            getSecureItem('pdv'),
            getSecureItem('initialLat'),
            getSecureItem('initialLng'),
            getSecureItem('matricule'),
            getSecureItem('agent'),
          ]);

          setTerminalId(savedTerminalId || savedLegacyMsisdn || '');
          setMatricule(savedMatricule || '');
          if (savedAgent) {
            try {
              setAgent(JSON.parse(savedAgent));
            } catch {
              // Entrée corrompue : cosmétique, le PDV reste rattaché côté serveur.
            }
          }
          setPdvId(savedPdvId);
          if (savedPdvRaw) {
            try {
              setPdv(JSON.parse(savedPdvRaw));
            } catch {
              // ignore
            }
          }
          if (savedLat && savedLng) {
            setInitialLocation({ latitude: Number(savedLat), longitude: Number(savedLng) });
          }
          setIsOnboarded(true);

          // Le démarrage n'ATTEND plus l'acquisition GPS : elle se poursuit en
          // arrière-plan et l'accueil affiche son propre état. Auparavant, une
          // acquisition qui ne revenait jamais bloquait tout le démarrage.
          await refreshQueue();
          beginTracking().catch(() => {});
          refreshLocation().catch(() => {});
        }
      } catch (error) {
        console.error('[app] Erreur bootstrap:', error);
      } finally {
        if (monte.current) setBootstrapping(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Suivi continu au premier plan -------------------------------------
  // C'est ce qui fait vivre les coordonnées à l'écran sans intervention.
  useEffect(() => {
    if (!isOnboarded) return;
    let arreter: (() => void) | null = null;
    let annule = false;

    suivrePosition((point) => {
      if (!annule && monte.current) {
        setCurrentLocation(point);
        setEtatGPS({ statut: 'ok', source: 'fraiche' });
      }
    }).then((stop) => {
      if (annule) stop();
      else arreter = stop;
    });

    return () => {
      annule = true;
      if (arreter) arreter();
    };
  }, [isOnboarded]);

  const register = useCallback(
    async (matriculeSaisi: string): Promise<{ ok: boolean; message?: string }> => {
      const matriculeNormalise = String(matriculeSaisi || '').trim().toUpperCase();
      if (!matriculeNormalise) {
        return { ok: false, message: 'Saisissez votre numéro matricule.' };
      }

      const deviceTerminalId = await getOrCreateTerminalId();

      // Acquisition bornée : en cas d'échec on remonte le message précis
      // (permission, GPS coupé, signal absent) plutôt qu'un texte générique.
      setEtatGPS({ statut: 'acquisition' });
      const resultat = await obtenirPosition();
      if (!resultat.ok) {
        setEtatGPS({ statut: 'echec', raison: resultat.raison, message: resultat.message });
        return { ok: false, message: resultat.message };
      }

      const point = resultat.point;
      setCurrentLocation(point);
      setEtatGPS({ statut: 'ok', source: resultat.source });

      try {
        const { data: pdv } = await api.post(
          '/pdv/mobile/enroll',
          {
            matricule: matriculeNormalise,
            terminal_id: deviceTerminalId,
            latitude: point.latitude,
            longitude: point.longitude,
            device_info: {
              platform: Platform.OS,
              version: '2.0.0',
              ...decrireAppareil(),
              accuracy: point.accuracy ?? null,
              timestamp: new Date().toISOString(),
            },
          },
          { timeout: 10000 }
        );

        if (!pdv?.id) {
          return { ok: false, message: 'Réponse invalide du serveur.' };
        }

        const lat = Number(pdv.latitude_creation ?? point.latitude);
        const lng = Number(pdv.longitude_creation ?? point.longitude);

        await Promise.all([
          setSecureItem('pdvId', String(pdv.id)),
          setSecureItem('terminalId', deviceTerminalId),
          setSecureItem('matricule', matriculeNormalise),
          setSecureItem('isOnboarded', 'true'),
          setSecureItem('initialLat', String(lat)),
          setSecureItem('initialLng', String(lng)),
          pdv.agent ? setSecureItem('agent', JSON.stringify(pdv.agent)) : Promise.resolve(),
          setSecureItem('pdv', JSON.stringify(pdv)),
        ]);

        setPdvId(String(pdv.id));
        setTerminalId(deviceTerminalId);
        setMatricule(matriculeNormalise);
        if (pdv.agent) setAgent(pdv.agent);
        setPdv(pdv);
        setInitialLocation({ latitude: lat, longitude: lng });
        setIsOnboarded(true);

        await refreshQueue();
        beginTracking().catch(() => {});
        return { ok: true };
      } catch (error: any) {
        const message = error?.response?.data?.error || networkErrorMessage(error);
        return { ok: false, message };
      }
    },
    [beginTracking, refreshQueue]
  );

  const syncNow = useCallback(async () => {
    setSyncStatus('syncing');
    const result = await syncService.autoSync();
    if (!monte.current) return;
    setSyncStatus(result.success ? 'success' : 'error');
    setLastSyncedCount(result.synced);
    if (result.success) setDerniereSynchro(new Date().toISOString());
    await refreshQueue();
    setTimeout(() => {
      if (monte.current) setSyncStatus('idle');
    }, 2500);
  }, [refreshQueue]);

  const logout = useCallback(async () => {
    setIsTracking(false);
    setSyncStatus('idle');
    setLastSyncedCount(null);
    setIsOnboarded(false);
    setTerminalId('');
    setMatricule('');
    setAgent(null);
    setPdvId(null);
    setInitialLocation(null);
    setCurrentLocation(null);
    setEtatGPS({ statut: 'inconnu' });
    setPositionsEnAttente(0);
    setDerniereSynchro(null);

    // Note : on garde volontairement `terminalId` — c'est l'identité stable de
    // cet appareil. Se déconnecter ramène l'écran d'association, mais tant que
    // l'app n'est pas désinstallée, elle retrouve le même PDV côté backend.
    try {
      await Promise.all([
        deleteSecureItem('pdvId'),
        deleteSecureItem('msisdn'),
            deleteSecureItem('pdv'),
        deleteSecureItem('matricule'),
        deleteSecureItem('agent'),
        deleteSecureItem('isOnboarded'),
        deleteSecureItem('initialLat'),
        deleteSecureItem('initialLng'),
      ]);
    } catch (error) {
      console.warn('[app] Suppression des identifiants locaux:', error);
    }

    try {
      await clearAllData();
    } catch (error) {
      console.warn('[app] Nettoyage de la base locale:', error);
    }

    stopBackgroundLocationTracking().catch((error) => {
      console.warn('[app] Arrêt du suivi en arrière-plan (non bloquant):', error);
    });
  }, []);

  useEffect(() => {
    if (!bootstrapping && !isOnboarded) {
      try {
        router.replace('/onboarding');
      } catch {
        // Erreur de routage ignorée : l'écran suivant re-tentera.
      }
    }
  }, [bootstrapping, isOnboarded]);

  const value = useMemo<AppContextValue>(
    () => ({
      bootstrapping,
      isOnboarded,
      terminalId,
      matricule,
      agent,
      pdv,
      pdvId,
      initialLocation,
      currentLocation,
      etatGPS,
      isTracking,
      permissionArrierePlan,
      positionsEnAttente,
      derniereSynchro,
      syncStatus,
      lastSyncedCount,
      register,
      refreshLocation,
      refreshQueue,
      syncNow,
      logout,
    }),
    [
      bootstrapping,
      isOnboarded,
      terminalId,
      matricule,
      agent,
      pdv,
      pdvId,
      initialLocation,
      currentLocation,
      etatGPS,
      isTracking,
      permissionArrierePlan,
      positionsEnAttente,
      derniereSynchro,
      syncStatus,
      lastSyncedCount,
      register,
      refreshLocation,
      refreshQueue,
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
