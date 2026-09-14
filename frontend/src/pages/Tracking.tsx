import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { pdvService } from '../services/pdvService';
import { Maximize2, Minimize2, RefreshCw, Filter, Play, Pause } from 'lucide-react';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  derniere_position_latitude?: number;
  derniere_position_longitude?: number;
  derniere_position_date?: string;
  statut: string;
  zone_geofence_id?: number | null;
}

interface Position {
  pdv_id: number;
  latitude: number;
  longitude: number;
  horodatage: string;
}

// Le backend peut renvoyer l'historique de positions avec des noms de champs
// légèrement différents selon l'endpoint ; on normalise ici plutôt que de
// supposer un seul format.
const normalizePosition = (raw: any): Position | null => {
  const lat = Number(raw?.latitude ?? raw?.lat);
  const lng = Number(raw?.longitude ?? raw?.lng ?? raw?.lon);
  if (isNaN(lat) || isNaN(lng)) return null;
  return {
    pdv_id: raw?.pdv_id ?? raw?.pdvId,
    latitude: lat,
    longitude: lng,
    horodatage: raw?.horodatage ?? raw?.date ?? raw?.timestamp ?? raw?.created_at ?? '',
  };
};

const Tracking = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<number, L.Polyline>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [selectedPDV, setSelectedPDV] = useState<number | null>(null);
  const [livePositions, setLivePositions] = useState<Map<number, Position>>(new Map());
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(false);

  const { data: pdvsResponse } = useQuery({
    queryKey: ['pdvsForTracking'],
    queryFn: () => pdvService.getAllPDVsNoPagination(),
    // On revalide périodiquement au cas où le socket serait momentanément
    // coupé, pour ne pas rester bloqué sur des positions figées.
    refetchInterval: 60_000,
  });

  // Historique réel des positions du PDV suivi (pour tracer la trajectoire),
  // au lieu de points générés aléatoirement.
  const { data: selectedPdvPositions } = useQuery({
    queryKey: ['pdvPositions', selectedPDV],
    queryFn: () => (selectedPDV ? pdvService.getPDVPositions(selectedPDV) : Promise.resolve([])),
    enabled: !!selectedPDV,
    staleTime: 15_000,
  });

  const allPdvs: PDV[] = pdvsResponse?.data || [];

  // Filtres statut / zone réellement appliqués à la carte (auparavant ces deux
  // sélecteurs ne faisaient qu'un console.log, sans le moindre effet visible).
  const pdvs: PDV[] = allPdvs.filter((pdv) => {
    if (statutFilter !== 'all' && pdv.statut !== statutFilter) return false;
    if (zoneFilter === 'none' && pdv.zone_geofence_id) return false;
    return true;
  });

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: true
      });

      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, \u00a9 OpenStreetMap contributors, GIS User Community',
        maxZoom: 16
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Initialiser Socket.IO une seule fois au montage. Dépendances volontairement
  // vides : le tableau de dépendances précédent incluait `livePositions`, qui
  // change à chaque position reçue, ce qui fermait et recréait la connexion
  // en boucle toutes les quelques secondes. La connexion doit rester stable
  // pour un vrai suivi en temps réel.
  useEffect(() => {
    const socket = io(undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  // Le bouton pause/lecture n'interrompt plus une simulation : il indique au
  // serveur de suspendre/reprendre l'envoi des positions pour cette session,
  // et ignore localement les événements entrants pendant la pause.
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.emit(isTracking ? 'tracking:resume' : 'tracking:pause');
  }, [isTracking]);

  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;
    const handler = (data: any) => {
      if (!isTracking) return;
      const pos = normalizePosition(data);
      if (!pos || !pos.pdv_id) return;
      setLivePositions((prev) => {
        const next = new Map(prev);
        next.set(pos.pdv_id, pos);
        return next;
      });
    };
    socket.off('position_update');
    socket.on('position_update', handler);
    return () => {
      socket.off('position_update', handler);
    };
  }, [isTracking]);

  // Mettre à jour les marqueurs et trajectoires
  useEffect(() => {
    if (!mapRef.current || !pdvs) return;

    // Nettoyer les marqueurs existants
    markersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    polylinesRef.current.forEach(polyline => mapRef.current?.removeLayer(polyline));
    markersRef.current.clear();
    polylinesRef.current.clear();

    const createIcon = (statut: string, isSelected: boolean) => {
      const color = statut === 'actif' ? '#009a44' : statut === 'inactif' ? '#8f8f9c' : '#d64545';
      const size = isSelected ? 40 : 32;
      const borderSize = isSelected ? 4 : 3;
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 8px;
          border: ${borderSize}px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          ${isSelected ? 'animation: pulse 2s infinite;' : ''}
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    };

    // Créer les marqueurs et trajectoires
    pdvs.forEach((pdv) => {
      const livePos = livePositions.get(pdv.id);
      const lat = livePos?.latitude || pdv.derniere_position_latitude || pdv.latitude_creation;
      const lng = livePos?.longitude || pdv.derniere_position_longitude || pdv.longitude_creation;

      if (lat && lng) {
        const latNum = Number(lat);
        const lngNum = Number(lng);

        if (!isNaN(latNum) && !isNaN(lngNum)) {
          // Créer le marqueur
          const marker = L.marker([latNum, lngNum], {
            icon: createIcon(pdv.statut, selectedPDV === pdv.id)
          }).addTo(mapRef.current!);

          marker.bindPopup(`
            <div style="min-width: 250px;">
              <h3 style="margin: 0 0 10px 0; font-weight: bold;">${pdv.nom_pdv}</h3>
              <p style="margin: 5px 0;"><strong>Statut:</strong> ${pdv.statut}</p>
              <p style="margin: 5px 0;"><strong>Position actuelle:</strong> ${latNum.toFixed(6)}, ${lngNum.toFixed(6)}</p>
              <p style="margin: 5px 0;"><strong>Dernière mise à jour:</strong> ${livePos?.horodatage || pdv.derniere_position_date || 'Inconnue'}</p>
              <button onclick="window.selectPDV(${pdv.id})" style="margin-top: 10px; padding: 5px 10px; background: #e06e00; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: Inter, sans-serif;">
                Suivre ce PDV
              </button>
            </div>
          `);

          marker.on('click', () => {
            setSelectedPDV(pdv.id);
          });

          markersRef.current.set(pdv.id, marker);

          // Tracer la trajectoire réelle du PDV suivi, à partir de son
          // historique de positions renvoyé par le backend (plus de points
          // aléatoires). On termine sur la position live/actuelle.
          if (selectedPDV === pdv.id) {
            const history = (selectedPdvPositions || [])
              .map(normalizePosition)
              .filter((p): p is Position => !!p)
              .sort((a, b) => new Date(a.horodatage).getTime() - new Date(b.horodatage).getTime());

            const trajectoryPoints: [number, number][] = history.map((p) => [p.latitude, p.longitude]);
            const last = trajectoryPoints[trajectoryPoints.length - 1];
            if (!last || last[0] !== latNum || last[1] !== lngNum) {
              trajectoryPoints.push([latNum, lngNum]);
            }

            if (trajectoryPoints.length > 1) {
              const polyline = L.polyline(trajectoryPoints, {
                color: '#e06e00',
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 10'
              }).addTo(mapRef.current!);

              polylinesRef.current.set(pdv.id, polyline);
            }
          }
        }
      }
    });

    // Ajuster la vue
    if (selectedPDV) {
      const selectedMarker = markersRef.current.get(selectedPDV);
      if (selectedMarker) {
        mapRef.current.setView(selectedMarker.getLatLng(), 15);
      }
    } else if (markersRef.current.size > 0) {
      const group = L.featureGroup(Array.from(markersRef.current.values()));
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    // Exposer la fonction de sélection globalement
    (window as any).selectPDV = (id: number) => {
      setSelectedPDV(id);
    };

  }, [pdvs, livePositions, selectedPDV]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const refreshMap = () => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-ink-950 flex flex-col">
      {/* Barre de contrôle principale */}
      <div className="bg-ink-900 text-white px-6 py-4 flex items-center justify-between shadow-lg border-b border-ink-800" style={{ position: 'relative', zIndex: 100 }}>
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-bold tracking-tight">Suivi en temps réel</h1>
          <div className="h-6 w-px bg-ink-700"></div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-ink-400">PDV actifs:</span>
              <span className="text-success-400 font-bold">{allPdvs.filter(p => p.statut === 'actif').length || 0}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-ink-400">En mouvement:</span>
              <span className="text-primary-300 font-bold">{livePositions.size}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsTracking(!isTracking)}
            className={`p-2 rounded-lg transition-all ${isTracking ? 'bg-success-600 hover:bg-success-700' : 'bg-ink-700 hover:bg-ink-600'}`}
            title={isTracking ? 'Pause' : 'Reprendre'}
          >
            {isTracking ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={refreshMap}
            className="p-2 bg-ink-700 rounded-lg hover:bg-ink-600 transition-all"
            title="Rafraîchir"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-ink-700 rounded-lg hover:bg-ink-600 transition-all"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          
          {selectedPDV && (
            <button
              onClick={() => setSelectedPDV(null)}
              className="px-4 py-2 bg-danger-600 rounded-lg hover:bg-danger-700 transition-all font-medium text-sm"
            >
              Arrêter le suivi
            </button>
          )}
        </div>
      </div>

      {/* Barre de filtres incorporée */}
      <div className="bg-ink-900/60 px-6 py-3 flex items-center space-x-6 border-b border-ink-800" style={{ position: 'relative', zIndex: 90 }}>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Filtres:</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-400">Statut:</label>
            <select 
              value={statutFilter}
              className="bg-ink-800 text-white text-sm px-3 py-1.5 rounded border border-ink-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onChange={(e) => setStatutFilter(e.target.value)}
            >
              <option value="all">Tous</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
              <option value="suspendu">Suspendus</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-400">Zone:</label>
            <select 
              value={zoneFilter}
              className="bg-ink-800 text-white text-sm px-3 py-1.5 rounded border border-ink-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <option value="all">Toutes les zones</option>
              <option value="none">Sans zone</option>
            </select>
          </div>
        </div>

        {(statutFilter !== 'all' || zoneFilter !== 'all') && (
          <span className="text-xs text-primary-300 bg-primary-500/10 px-2.5 py-1 rounded-md">
            {pdvs.length} / {allPdvs.length} PDV affiché(s)
          </span>
        )}

        <div className="flex items-center space-x-4 text-xs text-gray-400">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            <span>Actif</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-gray-500 rounded-full mr-1"></div>
            <span>Inactif</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
            <span>Suspendu</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 bg-primary-500 rounded mr-1"></div>
            <span>Trajectoire</span>
          </div>
        </div>
      </div>

      {/* Carte en plein écran */}
      <div 
        ref={mapContainerRef} 
        className="flex-1 bg-ink-100 relative z-0"
      />
      
      {/* Indicateur de connexion */}
      <div className="absolute bottom-6 right-6 z-40 bg-white rounded-xl shadow-popover px-4 py-3 flex items-center border border-ink-100">
        <div className={`w-2.5 h-2.5 rounded-full mr-3 ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
        <span className="text-sm font-medium text-ink-700">
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </span>
      </div>
    </div>
  );
};

export default Tracking;