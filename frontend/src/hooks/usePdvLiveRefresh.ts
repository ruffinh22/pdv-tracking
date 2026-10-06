import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

/** Keep page queries aligned with persisted GPS points, coalescing busy bursts. */
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
    const fallbackTimer = setInterval(() => {
      if (!socket.connected) refreshQueries();
    }, 60_000);

    const refreshQueries = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['kpis'] }),
          queryClient.invalidateQueries({ queryKey: ['pdvsAllForMap'] }),
          queryClient.invalidateQueries({ queryKey: ['pdvsAll'] }),
          queryClient.invalidateQueries({ queryKey: ['geofenceZones'] }),
        ]);
      }, 1500);
    };

    socket.on('connect', refreshQueries);
    socket.on('position_update', refreshQueries);
    return () => {
      clearInterval(fallbackTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [queryClient]);
}