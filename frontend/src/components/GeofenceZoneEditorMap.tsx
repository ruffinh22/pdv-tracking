import { useEffect, useRef, useState } from 'react';
import { BRAND } from '../lib/theme';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import { Undo2, Trash2 } from 'lucide-react';
import MapStatusOverlay from './MapStatusOverlay';

type LatLng = [number, number];

interface GeofenceZoneEditorMapProps {
  type: 'cercle' | 'polygone';
  coordonnees: any;
  rayon: number;
  onChange: (coordonnees: any) => void;
}

// GeoJSON stocke [lng, lat], Google Maps attend {lat, lng}
const toLatLng = (coord: [number, number]): LatLng => [coord[1], coord[0]];
const toLngLat = (coord: LatLng): [number, number] => [coord[1], coord[0]];

const hasValidPoint = (coordonnees: any) =>
  coordonnees?.type === 'Point' &&
  Array.isArray(coordonnees.coordinates) &&
  (coordonnees.coordinates[0] !== 0 || coordonnees.coordinates[1] !== 0);

const hasValidPolygon = (coordonnees: any) =>
  coordonnees?.type === 'Polygon' &&
  Array.isArray(coordonnees.coordinates?.[0]) &&
  coordonnees.coordinates[0].length >= 4;

const GeofenceZoneEditorMap = ({ type, coordonnees, rayon, onChange }: GeofenceZoneEditorMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const vertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const prete = useRef(false);
  const [, forceRender] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const [center, setCenter] = useState<LatLng | null>(hasValidPoint(coordonnees) ? toLatLng(coordonnees.coordinates) : null);
  const [points, setPoints] = useState<LatLng[]>(
    hasValidPolygon(coordonnees)
      ? coordonnees.coordinates[0].slice(0, -1).map((c: [number, number]) => toLatLng(c))
      : []
  );

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    let annule = false;
    if (!containerRef.current || mapRef.current) return;

    const initialView: LatLng = center ?? (points[0] ?? [6.3703, 2.3912]); // fallback Cotonou

    chargerGoogleMaps()
      .then((g) => {
        if (annule || !containerRef.current || mapRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: { lat: initialView[0], lng: initialView[1] },
          zoom: center || points.length ? 14 : 6,
          styles: GOOGLE_MAP_STYLE,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        prete.current = true;
        forceRender((n) => n + 1); // redéclenche les effets ci-dessous une fois la carte prête
      })
      .catch((err) => {
        console.error('[GeofenceZoneEditorMap] Google Maps indisponible:', err);
        if (!annule) setErreur(err?.message || 'Échec du chargement de Google Maps.');
      });

    return () => {
      annule = true;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gestion des clics : place le centre (cercle) ou ajoute un sommet (polygone)
  useEffect(() => {
    if (!mapRef.current || !prete.current) return;
    const map = mapRef.current;

    clickListenerRef.current?.remove();
    clickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const latlng: LatLng = [e.latLng.lat(), e.latLng.lng()];
      if (type === 'cercle') {
        setCenter(latlng);
      } else {
        setPoints((prev) => [...prev, latlng]);
      }
    });

    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
  }, [type, prete.current]);

  // Dessin du cercle
  useEffect(() => {
    if (!mapRef.current || !prete.current || type !== 'cercle') return;
    const map = mapRef.current;

    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
      centerMarkerRef.current = null;
    }

    if (center) {
      circleRef.current = new google.maps.Circle({
        center: { lat: center[0], lng: center[1] },
        radius: rayon || 100,
        strokeColor: BRAND.orange,
        strokeWeight: 2,
        fillColor: BRAND.orange,
        fillOpacity: 0.18,
        map,
      });

      centerMarkerRef.current = new google.maps.Marker({
        position: { lat: center[0], lng: center[1] },
        map,
        draggable: true,
      });
      centerMarkerRef.current.addListener('dragend', () => {
        const pos = centerMarkerRef.current!.getPosition()!;
        setCenter([pos.lat(), pos.lng()]);
      });

      onChange({ type: 'Point', coordinates: toLngLat(center), radius: rayon || 100 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, rayon, type, prete.current]);

  // Dessin du polygone
  useEffect(() => {
    if (!mapRef.current || !prete.current || type !== 'polygone') return;
    const map = mapRef.current;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => m.setMap(null));
    vertexMarkersRef.current = [];

    points.forEach((pt, i) => {
      const marker = new google.maps.Marker({
        position: { lat: pt[0], lng: pt[1] },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          strokeColor: BRAND.orange,
          strokeWeight: 2,
          fillColor: '#ffffff',
          fillOpacity: 1,
        },
        label: { text: `${i + 1}`, fontSize: '10px', color: BRAND.orange },
        title: `Sommet ${i + 1}`,
      });
      vertexMarkersRef.current.push(marker);
    });

    if (points.length >= 2) {
      polygonRef.current = new google.maps.Polygon({
        paths: points.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: BRAND.orange,
        strokeWeight: 2,
        fillColor: BRAND.orange,
        fillOpacity: 0.18,
        map,
      });
    }

    if (points.length >= 3) {
      const ring = [...points, points[0]].map(toLngLat);
      onChange({ type: 'Polygon', coordinates: [ring] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, type, prete.current]);

  const handleUndo = () => setPoints((prev) => prev.slice(0, -1));
  const handleClear = () => setPoints([]);

  return (
    <div className="space-y-2">
      <div style={{ position: 'relative', height: '220px', width: '100%' }}>
        <div
          ref={containerRef}
          style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
          className="border border-ink-200"
        />
        {!prete.current && <MapStatusOverlay erreur={erreur} />}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>
          {type === 'cercle'
            ? center
              ? `Centre : ${center[0].toFixed(5)}, ${center[1].toFixed(5)} — cliquez pour le déplacer`
              : 'Cliquez sur la carte pour placer le centre'
            : points.length < 3
            ? `Cliquez pour ajouter des sommets (${points.length}/3 min.)`
            : `${points.length} sommets — cliquez pour en ajouter d'autres`}
        </span>
        {type === 'polygone' && points.length > 0 && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              className="btn-icon w-7 h-7 hover:text-primary-600 hover:bg-primary-50"
              title="Annuler le dernier sommet"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="btn-icon w-7 h-7 hover:text-danger-600 hover:bg-danger-50"
              title="Effacer le polygone"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeofenceZoneEditorMap;
