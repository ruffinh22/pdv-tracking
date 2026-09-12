import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: string;
}

interface LeafletMapProps {
  pdvs: PDV[];
}

const LeafletMap = ({ pdvs }: LeafletMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialiser la carte une seule fois
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);

      // Ajouter le layer OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
    }

    // Nettoyer les marqueurs existants
    markersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Créer des icônes de tablette personnalisées selon le statut
    const createIcon = (statut: string) => {
      const color = statut === 'actif' ? '#009a44' : statut === 'inactif' ? '#8f8f9c' : '#d64545';
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: ${color};
          width: 36px;
          height: 44px;
          border-radius: 6px;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 22]
      });
    };

    // Ajouter des marqueurs pour chaque PDV
    pdvs.forEach((pdv) => {
      if (pdv.latitude_creation && pdv.longitude_creation) {
        const lat = Number(pdv.latitude_creation);
        const lng = Number(pdv.longitude_creation);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], { icon: createIcon(pdv.statut) })
            .addTo(mapRef.current!);

          marker.bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; font-weight: bold;">${pdv.nom_pdv}</h3>
              <p style="margin: 5px 0;"><strong>Statut:</strong> ${pdv.statut}</p>
              <p style="margin: 5px 0;"><strong>Position:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            </div>
          `);

          markersRef.current.push(marker);
        }
      }
    });

    // Ajuster la vue pour inclure tous les marqueurs
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      // Nettoyage des marqueurs
      markersRef.current.forEach(marker => {
        mapRef.current?.removeLayer(marker);
      });
      markersRef.current = [];
    };
  }, [pdvs]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        height: '100%', 
        width: '100%',
        borderRadius: '0.5rem'
      }} 
    />
  );
};

export default LeafletMap;