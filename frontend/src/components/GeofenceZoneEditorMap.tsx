import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Undo2, Trash2 } from 'lucide-react';

type LatLng = [number, number];

interface GeofenceZoneEditorMapProps {
  type: 'cercle' | 'polygone';
  coordonnees: any;
  rayon: number;
  onChange: (coordonnees: any) => void;
}

// GeoJSON stocke [lng, lat], Leaflet attend [lat, lng]
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
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.CircleMarker[]>([]);

  const [center, setCenter] = useState<LatLng | null>(hasValidPoint(coordonnees) ? toLatLng(coordonnees.coordinates) : null);
  const [points, setPoints] = useState<LatLng[]>(
    hasValidPolygon(coordonnees)
      ? coordonnees.coordinates[0].slice(0, -1).map((c: [number, number]) => toLatLng(c))
      : []
  );

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialView: LatLng = center ?? (points[0] ?? [6.3703, 2.3912]); // fallback Cotonou
    mapRef.current = L.map(containerRef.current).setView(initialView, center || points.length ? 14 : 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gestion des clics : place le centre (cercle) ou ajoute un sommet (polygone)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const latlng: LatLng = [e.latlng.lat, e.latlng.lng];
      if (type === 'cercle') {
        setCenter(latlng);
      } else {
        setPoints((prev) => [...prev, latlng]);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [type]);

  // Dessin du cercle
  useEffect(() => {
    if (!mapRef.current || type !== 'cercle') return;

    if (circleRef.current) {
      mapRef.current.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (centerMarkerRef.current) {
      mapRef.current.removeLayer(centerMarkerRef.current);
      centerMarkerRef.current = null;
    }

    if (center) {
      circleRef.current = L.circle(center, {
        radius: rayon || 100,
        color: '#e06e00',
        weight: 2,
        fillColor: '#e06e00',
        fillOpacity: 0.18
      }).addTo(mapRef.current);

      centerMarkerRef.current = L.marker(center, { draggable: true }).addTo(mapRef.current);
      centerMarkerRef.current.on('dragend', () => {
        const pos = centerMarkerRef.current!.getLatLng();
        setCenter([pos.lat, pos.lng]);
      });

      onChange({ type: 'Point', coordinates: toLngLat(center), radius: rayon || 100 });
    }
  }, [center, rayon, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dessin du polygone
  useEffect(() => {
    if (!mapRef.current || type !== 'polygone') return;

    if (polygonRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    vertexMarkersRef.current = [];

    points.forEach((pt, i) => {
      const marker = L.circleMarker(pt, {
        radius: 6,
        color: '#e06e00',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1
      }).addTo(mapRef.current!);
      marker.bindTooltip(`Sommet ${i + 1}`, { direction: 'top' });
      vertexMarkersRef.current.push(marker);
    });

    if (points.length >= 2) {
      polygonRef.current = L.polygon(points, {
        color: '#e06e00',
        weight: 2,
        fillColor: '#e06e00',
        fillOpacity: 0.18
      }).addTo(mapRef.current);
    }

    if (points.length >= 3) {
      const ring = [...points, points[0]].map(toLngLat);
      onChange({ type: 'Polygon', coordinates: [ring] });
    }
  }, [points, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = () => setPoints((prev) => prev.slice(0, -1));
  const handleClear = () => setPoints([]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        style={{ height: '220px', width: '100%', borderRadius: '0.75rem' }}
        className="border border-ink-200"
      />
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
