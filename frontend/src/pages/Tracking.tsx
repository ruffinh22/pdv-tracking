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
}

interface Position {
  pdv_id: number;
  latitude: number;
  longitude: number;
  horodatage: string;
}

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

  const { data: pdvsResponse } = useQuery({
    queryKey: ['pdvs'],
    queryFn: pdvService.getAllPDVs,
  });

  const pdvs = pdvsResponse?.data || [];

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Initialiser Socket.IO
  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connecté au serveur Socket.IO');
    });

    socketRef.current.on('position_update', (data: Position) => {
      setLivePositions(prev => new Map(prev.set(data.pdv_id, data)));
    });

    socketRef.current.on('disconnect', () => {
      console.log('Déconnecté du serveur Socket.IO');
    });

    // Simuler des mises à jour de position pour démonstration
    const simulateMovement = () => {
      if (!isTracking || !pdvs) return;
      
      pdvs.forEach((pdv) => {
        if (pdv.statut === 'actif') {
          const currentPos = livePositions.get(pdv.id);
          const baseLat = currentPos?.latitude || pdv.derniere_position_latitude || pdv.latitude_creation;
          const baseLng = currentPos?.longitude || pdv.derniere_position_longitude || pdv.longitude_creation;
          
          // Simuler un petit mouvement aléatoire
          const latOffset = (Math.random() - 0.5) * 0.001;
          const lngOffset = (Math.random() - 0.5) * 0.001;
          
          const newPosition: Position = {
            pdv_id: pdv.id,
            latitude: parseFloat(baseLat) + latOffset,
            longitude: parseFloat(baseLng) + lngOffset,
            horodatage: new Date().toISOString()
          };
          
          setLivePositions(prev => new Map(prev.set(pdv.id, newPosition)));
        }
      });
    };

    // Simuler des mises à jour toutes les 3 secondes
    const movementInterval = setInterval(simulateMovement, 3000);

    return () => {
      clearInterval(movementInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [pdvs, isTracking, livePositions]);

  // Mettre à jour les marqueurs et trajectoires
  useEffect(() => {
    if (!mapRef.current || !pdvs) return;

    // Nettoyer les marqueurs existants
    markersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    polylinesRef.current.forEach(polyline => mapRef.current?.removeLayer(polyline));
    markersRef.current.clear();
    polylinesRef.current.clear();

    const createIcon = (statut: string, isSelected: boolean) => {
      const color = statut === 'actif' ? '#22c55e' : statut === 'inactif' ? '#6b7280' : '#ef4444';
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
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);

        if (!isNaN(latNum) && !isNaN(lngNum)) {
          // Créer le marqueur
          const marker = L.marker([latNum, lngNum], {
            icon: createIcon(pdv.statut, selectedPDV === pdv.id)
          }).addTo(mapRef.current);

          marker.bindPopup(`
            <div style="min-width: 250px;">
              <h3 style="margin: 0 0 10px 0; font-weight: bold;">${pdv.nom_pdv}</h3>
              <p style="margin: 5px 0;"><strong>Statut:</strong> ${pdv.statut}</p>
              <p style="margin: 5px 0;"><strong>Position actuelle:</strong> ${latNum.toFixed(6)}, ${lngNum.toFixed(6)}</p>
              <p style="margin: 5px 0;"><strong>Dernière mise à jour:</strong> ${livePos?.horodatage || pdv.derniere_position_date || 'Inconnue'}</p>
              <button onclick="window.selectPDV(${pdv.id})" style="margin-top: 10px; padding: 5px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Suivre ce PDV
              </button>
            </div>
          `);

          marker.on('click', () => {
            setSelectedPDV(pdv.id);
          });

          markersRef.current.set(pdv.id, marker);

          // Créer une trajectoire simulée pour le PDV sélectionné
          if (selectedPDV === pdv.id) {
            // Utiliser les positions historiques ou créer une trajectoire simulée
            const trajectoryPoints = [
              [latNum, lngNum],
              [latNum + (Math.random() - 0.5) * 0.01, lngNum + (Math.random() - 0.5) * 0.01],
              [latNum + (Math.random() - 0.5) * 0.015, lngNum + (Math.random() - 0.5) * 0.015]
            ];
            
            const polyline = L.polyline(trajectoryPoints, {
              color: '#3b82f6',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(mapRef.current);

            polylinesRef.current.set(pdv.id, polyline);
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
    <div className="h-screen w-screen bg-gray-900 flex flex-col">
      {/* Barre de contrôle principale */}
      <div className="bg-black text-white px-6 py-4 flex items-center justify-between shadow-lg border-b border-gray-800" style={{ position: 'relative', zIndex: 100 }}>
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold tracking-tight">Suivi en temps réel</h1>
          <div className="h-6 w-px bg-gray-600"></div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">PDV actifs:</span>
              <span className="text-green-400 font-bold">{pdvs.filter(p => p.statut === 'actif').length || 0}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">En mouvement:</span>
              <span className="text-blue-400 font-bold">{livePositions.size}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsTracking(!isTracking)}
            className={`p-2 rounded-lg transition-all ${isTracking ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
            title={isTracking ? 'Pause' : 'Reprendre'}
          >
            {isTracking ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={refreshMap}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
            title="Rafraîchir"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          
          {selectedPDV && (
            <button
              onClick={() => setSelectedPDV(null)}
              className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all font-medium"
            >
              Arrêter le suivi
            </button>
          )}
        </div>
      </div>

      {/* Barre de filtres incorporée */}
      <div className="bg-gray-800 px-6 py-3 flex items-center space-x-6 border-b border-gray-700" style={{ position: 'relative', zIndex: 90 }}>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Filtres:</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-400">Statut:</label>
            <select 
              className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => {
                console.log('Filtre statut:', e.target.value);
              }}
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
              className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => {
                console.log('Filtre zone:', e.target.value);
              }}
            >
              <option value="all">Toutes les zones</option>
              <option value="none">Sans zone</option>
            </select>
          </div>
        </div>

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
            <div className="w-4 h-0.5 bg-blue-500 rounded mr-1"></div>
            <span>Trajectoire</span>
          </div>
        </div>
      </div>

      {/* Carte en plein écran */}
      <div 
        ref={mapContainerRef} 
        className="flex-1 bg-gray-100 relative z-0"
      />
      
      {/* Indicateur de connexion */}
      <div className="absolute bottom-6 right-6 z-40 bg-white rounded-xl shadow-lg px-4 py-3 flex items-center border border-gray-200">
        <div className={`w-2.5 h-2.5 rounded-full mr-3 ${socketRef.current?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-sm font-medium text-gray-700">
          {socketRef.current?.connected ? 'Connecté' : 'Déconnecté'}
        </span>
      </div>
    </div>
  );
};

export default Tracking;