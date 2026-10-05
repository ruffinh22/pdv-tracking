import { useEffect, useRef, useState } from 'react';
import { CHART_SERIES } from '../lib/theme';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import { GeofenceZone } from '../services/geofenceService';
import MapStatusOverlay from './MapStatusOverlay';

interface GeofenceZonesMapProps {
  zones: GeofenceZone[];
  selectedZoneId?: number | null;
}

// Palette cyclique pour distinguer les zones sur la carte
const ZONE_COLORS = CHART_SERIES;

const colorForZone = (index: number) => ZONE_COLORS[index % ZONE_COLORS.length];

// Les coordonnées stockées sont au format GeoJSON [lng, lat] : on convertit pour Google Maps {lat, lng}
const toLatLng = (coord: [number, number]): google.maps.LatLngLiteral => ({ lat: coord[1], lng: coord[0] });

type Calque = google.maps.Circle | google.maps.Polygon;

const GeofenceZonesMap = ({ zones, selectedZoneId }: GeofenceZonesMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Calque[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;

    chargerGoogleMaps()
      .then((g) => {
        if (annule || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(mapContainerRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            styles: GOOGLE_MAP_STYLE,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          });
          infoWindowRef.current = new g.maps.InfoWindow();
        }

        setPret(true);
        dessiner(g);
      })
      .catch((err) => {
        console.error('[GeofenceZonesMap] Google Maps indisponible:', err);
        if (!annule) setErreur(err?.message || 'Échec du chargement de Google Maps.');
      });

    function dessiner(g: typeof google) {
      const map = mapRef.current!;

      // Nettoyer les contours existants avant de redessiner
      layersRef.current.forEach((layer) => layer.setMap(null));
      layersRef.current = [];

      const bounds = new g.maps.LatLngBounds();
      let aUnePointe = false;

      zones.forEach((zone, index) => {
        const color = colorForZone(index);
        const isSelected = selectedZoneId != null && zone.id === selectedZoneId;
        const weight = isSelected ? 4 : 2;
        const fillOpacity = isSelected ? 0.25 : 0.12;

        try {
          if (zone.type === 'cercle' && zone.coordonnees?.coordinates) {
            const center = toLatLng(zone.coordonnees.coordinates);
            const radius = zone.coordonnees.radius ?? zone.rayon ?? 100;

            if (!Number.isNaN(center.lat) && !Number.isNaN(center.lng)) {
              const circle = new g.maps.Circle({
                center,
                radius,
                strokeColor: color,
                strokeWeight: weight,
                fillColor: color,
                fillOpacity,
                map,
              });

              circle.addListener('click', () => {
                infoWindowRef.current?.setContent(`
                  <div style="min-width: 180px;">
                    <h3 style="margin: 0 0 6px 0; font-weight: bold;">${zone.nom_zone}</h3>
                    <p style="margin: 2px 0;">Cercle · rayon ${radius} m</p>
                    <p style="margin: 2px 0;">PDV assignés : ${zone.pdvs?.length ?? 0}</p>
                  </div>
                `);
                infoWindowRef.current?.setPosition(center);
                infoWindowRef.current?.open({ map });
              });

              layersRef.current.push(circle);
              bounds.union(circle.getBounds()!);
              aUnePointe = true;
            }
          } else if (zone.type === 'polygone' && zone.coordonnees?.coordinates?.[0]) {
            const points: google.maps.LatLngLiteral[] = zone.coordonnees.coordinates[0].map(
              (c: [number, number]) => toLatLng(c)
            );

            if (points.length >= 3) {
              const polygon = new g.maps.Polygon({
                paths: points,
                strokeColor: color,
                strokeWeight: weight,
                fillColor: color,
                fillOpacity,
                map,
              });

              polygon.addListener('click', (e: google.maps.PolyMouseEvent) => {
                infoWindowRef.current?.setContent(`
                  <div style="min-width: 180px;">
                    <h3 style="margin: 0 0 6px 0; font-weight: bold;">${zone.nom_zone}</h3>
                    <p style="margin: 2px 0;">Polygone · ${points.length} sommets</p>
                    <p style="margin: 2px 0;">PDV assignés : ${zone.pdvs?.length ?? 0}</p>
                  </div>
                `);
                if (e.latLng) infoWindowRef.current?.setPosition(e.latLng);
                infoWindowRef.current?.open({ map });
              });

              layersRef.current.push(polygon);
              points.forEach((pt: google.maps.LatLngLiteral) => bounds.extend(pt));
              aUnePointe = true;
            }
          }
        } catch {
          // Coordonnées invalides pour cette zone : on l'ignore silencieusement
        }
      });

      if (aUnePointe) {
        map.fitBounds(bounds, 32);
      }
    }

    return () => {
      annule = true;
    };
  }, [zones, selectedZoneId]);

  useEffect(() => {
    return () => {
      layersRef.current.forEach((layer) => layer.setMap(null));
      layersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }} />
      {!pret && <MapStatusOverlay erreur={erreur} />}
    </div>
  );
};

export default GeofenceZonesMap;
