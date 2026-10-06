import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  STATUTS, ageLisible, badgeStatutHtml, compterStatuts, dernierSignal, echapperHtml, iconeTabletteSvg, statutDuPdv,
} from '../lib/pdvStatus';
import PDVStatusLegend from './PDVStatusLegend';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: string;
  derniere_position_date?: string | null;
  derniere_position_recue_at?: string | null;
}

interface LeafletMapProps {
  pdvs: PDV[];
}

/** Carte d'ensemble : chaque PDV est coloré selon son statut réel (fiche + dernier signal). */
const LeafletMap = ({ pdvs }: LeafletMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const compteurs = useMemo(() => compterStatuts(pdvs.map((p) => statutDuPdv(p))), [pdvs]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);
      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, \u00a9 OpenStreetMap contributors, GIS User Community',
        maxZoom: 16,
      }).addTo(mapRef.current);
    }

    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    const maintenant = Date.now();

    pdvs.forEach((pdv) => {
      if (!pdv.latitude_creation || !pdv.longitude_creation) return;
      const lat = Number(pdv.latitude_creation);
      const lng = Number(pdv.longitude_creation);
      if (isNaN(lat) || isNaN(lng)) return;

      const etat = statutDuPdv(pdv, maintenant);
      const signal = dernierSignal(maintenant, pdv.derniere_position_recue_at, pdv.derniere_position_date);
      const icon = L.divIcon({
        className: 'custom-marker',
        html: iconeTabletteSvg(STATUTS[etat].couleur),
        iconSize: [36, 44],
        iconAnchor: [18, 22],
      });
      const marker = L.marker([lat, lng], { icon, title: pdv.nom_pdv }).addTo(mapRef.current!);
      marker.bindPopup(`
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 6px 0; font-weight: bold;">${echapperHtml(pdv.nom_pdv)}</h3>
          <p style="margin: 0 0 8px 0;">${badgeStatutHtml(etat)}</p>
          <p style="margin: 4px 0;"><strong>Dernier signal :</strong> ${signal === null ? 'jamais' : ageLisible(signal, maintenant)}</p>
          <p style="margin: 4px 0;"><strong>Fiche :</strong> ${echapperHtml(pdv.statut)}</p>
          <p style="margin: 4px 0;"><strong>Point de vente :</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
        </div>`);
      markersRef.current.push(marker);
    });

    if (markersRef.current.length > 0) {
      mapRef.current.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.1));
    }

    return () => {
      markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
      markersRef.current = [];
    };
  }, [pdvs]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }} />
      <div className="absolute bottom-2 left-2 right-2 z-[400] pointer-events-none">
        <PDVStatusLegend compteurs={compteurs} className="pointer-events-auto [&>*]:shadow-sm" />
      </div>
    </div>
  );
};

export default LeafletMap;
