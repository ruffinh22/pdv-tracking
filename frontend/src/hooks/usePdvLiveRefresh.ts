import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

type PositionUpdate = {
  pdv_id: number;
  latitude: number;
  longitude: number;
  precision?: number | null;
  horodatage?: string;
};

const mettreAJourListe = (ancienne: any, position: PositionUpdate) => {
  if (!ancienne?.data) return ancienne;
  return {
    ...ancienne,
    data: ancienne.data.map((pdv: any) =>
      pdv.id === position.pdv_id
        ? {
            ...pdv,
            derniere_position_latitude: position.latitude,
            derniere_position_longitude: position.longitude,
            derniere_position_precision: position.precision ?? null,
            derniere_position_date: position.horodatage || new Date().toISOString(),
            etat_suivi: 'en_ligne',
          }
        : pdv
    ),
  };
};

/** Apply persisted socket points to visible caches; coalesce the small KPI refresh. */
export function usePdvLiveRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(undefined, {
      auth: (callback) => callback({ token: localStorage.getItem('token') }),
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshKpis = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void queryClient.invalidateQueries({ queryKey: ['kpis'] });
      }, 10_000);
    };

    const resynchroniser = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['pdvsAllForMap'] }),
        queryClient.invalidateQueries({ queryKey: ['pdvsAll'] }),
        queryClient.invalidateQueries({ queryKey: ['pdvs'] }),
        queryClient.invalidateQueries({ queryKey: ['geofenceZones'] }),
      ]);
    };

    const fallbackTimer = setInterval(() => {
      if (!socket.connected) resynchroniser();
    }, 60_000);

    const appliquerPosition = (position: PositionUpdate) => {
      if (!Number.isFinite(Number(position?.pdv_id))) return;
      queryClient.setQueryData(['pdvsAllForMap'], (ancienne: any) => mettreAJourListe(ancienne, position));
      queryClient.setQueryData(['pdvsAll'], (ancienne: any) => mettreAJourListe(ancienne, position));
      queryClient.setQueriesData({ queryKey: ['pdvs'] }, (ancienne: any) => mettreAJourListe(ancienne, position));
      queryClient.setQueryData(['geofenceZones'], (anciennes: any[] | undefined) =>
        anciennes?.map((zone) => ({
          ...zone,
          pdvs: zone.pdvs?.map((pdv: any) =>
            pdv.id === position.pdv_id
              ? {
                  ...pdv,
                  derniere_position_latitude: position.latitude,
                  derniere_position_longitude: position.longitude,
                  derniere_position_precision: position.precision ?? null,
                  derniere_position_date: position.horodatage || new Date().toISOString(),
                  etat_suivi: 'en_ligne',
                }
              : pdv
          ),
        }))
      );
      refreshKpis();
    };

    socket.on('connect', resynchroniser);
    socket.on('position_update', appliquerPosition);
    return () => {
      clearInterval(fallbackTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [queryClient]);
}