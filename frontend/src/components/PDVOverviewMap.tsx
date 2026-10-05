import { useEffect, useRef, useState } from 'react';
import { couleurStatut } from '../lib/theme';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import MapStatusOverlay from './MapStatusOverlay';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: string;
}

interface PDVOverviewMapProps {
  pdvs: PDV[];
}

// Icône "tablette" en SVG encodé en data URI, équivalent du L.divIcon
// d'origine — Google Maps Marker n'accepte pas de HTML arbitraire comme icône,
// seulement une URL ou un SVG inline via data:image/svg+xml.
const iconeTablette = (statut: string) => {
  const color = couleurStatut(statut);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <rect x="1.5" y="1.5" width="33" height="41" rx="6" ry="6" fill="${color}" stroke="white" stroke-width="3"/>
      <rect x="11" y="7" width="14" height="20" rx="1.4" ry="1.4" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="18" cy="30.5" r="0.9" fill="white"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 44),
    anchor: new google.maps.Point(18, 22),
  };
};

const PDVOverviewMap = ({ pdvs }: PDVOverviewMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const pdvsRef = useRef(pdvs);
  pdvsRef.current = pdvs;
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
        console.error('[PDVOverviewMap] Google Maps indisponible:', err);
        if (!annule) setErreur(err?.message || 'Échec du chargement de Google Maps.');
      });

    function dessiner(g: typeof google) {
      const map = mapRef.current!;

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      const bounds = new g.maps.LatLngBounds();
      let aUnPoint = false;

      pdvsRef.current.forEach((pdv) => {
        if (!pdv.latitude_creation || !pdv.longitude_creation) return;
        const lat = Number(pdv.latitude_creation);
        const lng = Number(pdv.longitude_creation);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const position = { lat, lng };
        const marker = new g.maps.Marker({
          position,
          map,
          icon: iconeTablette(pdv.statut),
          title: pdv.nom_pdv,
        });

        marker.addListener('click', () => {
          infoWindowRef.current?.setContent(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; font-weight: bold;">${pdv.nom_pdv}</h3>
              <p style="margin: 5px 0;"><strong>Statut:</strong> ${pdv.statut}</p>
              <p style="margin: 5px 0;"><strong>Position:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            </div>
          `);
          infoWindowRef.current?.open({ map, anchor: marker });
        });

        markersRef.current.push(marker);
        bounds.extend(position);
        aUnPoint = true;
      });

      if (aUnPoint) {
        map.fitBounds(bounds, 40);
      }
    }

    return () => {
      annule = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [pdvs]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: '0.5rem',
        }}
      />
      {!pret && <MapStatusOverlay erreur={erreur} />}
    </div>
  );
};

export default PDVOverviewMap;
