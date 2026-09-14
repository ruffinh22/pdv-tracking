import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeofenceZone } from '../services/geofenceService';

interface GeofenceZonesMapProps {
  zones: GeofenceZone[];
  selectedZoneId?: number | null;
}

// Palette cyclique pour distinguer les zones sur la carte
const ZONE_COLORS = ['#e06e00', '#00833a', '#0ea5e9', '#c98a00', '#d64545', '#795548', '#14b8a6', '#8f4500'];

const colorForZone = (index: number) => ZONE_COLORS[index % ZONE_COLORS.length];

// Les coordonnées stockées sont au format GeoJSON [lng, lat] : on convertit pour Leaflet [lat, lng]
const toLatLng = (coord: [number, number]): [number, number] => [coord[1], coord[0]];

const GeofenceZonesMap = ({ zones, selectedZoneId }: GeofenceZonesMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);
      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, \u00a9 OpenStreetMap contributors, GIS User Community',
        maxZoom: 16
      }).addTo(mapRef.current);
    }

    // Nettoyer les contours existants avant de redessiner
    layersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer));
    layersRef.current = [];

    const boundsGroup: L.Layer[] = [];

    zones.forEach((zone, index) => {
      const color = colorForZone(index);
      const isSelected = selectedZoneId != null && zone.id === selectedZoneId;
      const weight = isSelected ? 4 : 2;
      const fillOpacity = isSelected ? 0.25 : 0.12;

      try {
        if (zone.type === 'cercle' && zone.coordonnees?.coordinates) {
          const center = toLatLng(zone.coordonnees.coordinates);
          const radius = zone.coordonnees.radius ?? zone.rayon ?? 100;

          if (!isNaN(center[0]) && !isNaN(center[1])) {
            const circle = L.circle(center, {
              radius,
              color,
              weight,
              fillColor: color,
              fillOpacity
            }).addTo(mapRef.current!);

            circle.bindPopup(`
              <div style="min-width: 180px;">
                <h3 style="margin: 0 0 6px 0; font-weight: bold;">${zone.nom_zone}</h3>
                <p style="margin: 2px 0;">Cercle · rayon ${radius} m</p>
                <p style="margin: 2px 0;">PDV assignés : ${zone.pdvs?.length ?? 0}</p>
              </div>
            `);

            layersRef.current.push(circle);
            boundsGroup.push(circle);
          }
        } else if (zone.type === 'polygone' && zone.coordonnees?.coordinates?.[0]) {
          const points = zone.coordonnees.coordinates[0].map((c: [number, number]) => toLatLng(c));

          if (points.length >= 3) {
            const polygon = L.polygon(points, {
              color,
              weight,
              fillColor: color,
              fillOpacity
            }).addTo(mapRef.current!);

            polygon.bindPopup(`
              <div style="min-width: 180px;">
                <h3 style="margin: 0 0 6px 0; font-weight: bold;">${zone.nom_zone}</h3>
                <p style="margin: 2px 0;">Polygone · ${points.length} sommets</p>
                <p style="margin: 2px 0;">PDV assignés : ${zone.pdvs?.length ?? 0}</p>
              </div>
            `);

            layersRef.current.push(polygon);
            boundsGroup.push(polygon);
          }
        }
      } catch {
        // Coordonnées invalides pour cette zone : on l'ignore silencieusement
      }
    });

    if (boundsGroup.length > 0) {
      const group = L.featureGroup(boundsGroup);
      mapRef.current.fitBounds(group.getBounds().pad(0.2));
    }

    return () => {
      layersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer));
      layersRef.current = [];
    };
  }, [zones, selectedZoneId]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    />
  );
};

export default GeofenceZonesMap;
