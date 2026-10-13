import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUTS, ageLisible, badgeStatutHtml, compterStatuts, dernierSignal, echapperHtml, iconeTabletteSvg, statutDuPdv } from '../lib/pdvStatus';
import PDVStatusLegend from './PDVStatusLegend';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import MapStatusOverlay from './MapStatusOverlay';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  statut: string;
  derniere_position_date?: string | null;
  derniere_position_recue_at?: string | null;
}

interface PDVOverviewMapProps {
  pdvs: PDV[];
}

const iconeTablette = (couleur: string) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconeTabletteSvg(couleur))}`,
  scaledSize: new google.maps.Size(36, 44),
  anchor: new google.maps.Point(18, 22),
});

const PDVOverviewMap = ({ pdvs }: PDVOverviewMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const pdvsRef = useRef(pdvs);
  pdvsRef.current = pdvs;
  const [erreur, setErreur] = useState<string | null>(null);
  const [pret, setPret] = useState(false);
  const compteurs = useMemo(() => compterStatuts(pdvs.map((p) => statutDuPdv(p))), [pdvs]);

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
      const maintenant = Date.now();

      pdvsRef.current.forEach((pdv) => {
        if (!pdv.latitude_creation || !pdv.longitude_creation) return;
        const lat = Number(pdv.latitude_creation);
        const lng = Number(pdv.longitude_creation);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const position = { lat, lng };
        const marker = new g.maps.Marker({
          position,
          map,
          icon: iconeTablette(STATUTS[statutDuPdv(pdv, maintenant)].couleur),
          title: pdv.nom_pdv,
        });

        marker.addListener('click', () => {
          const etat = statutDuPdv(pdv, maintenant);
          const signal = dernierSignal(maintenant, pdv.derniere_position_recue_at, pdv.derniere_position_date);
          infoWindowRef.current?.setContent(`
            <div style="min-width: 220px;">
              <h3 style="margin: 0 0 6px 0; font-weight: bold;">${echapperHtml(pdv.nom_pdv)}</h3>
              <p style="margin: 0 0 8px 0;">${badgeStatutHtml(etat)}</p>
              <p style="margin: 4px 0;"><strong>Dernier signal :</strong> ${signal === null ? 'jamais' : ageLisible(signal, maintenant)}</p>
              <p style="margin: 4px 0;"><strong>Fiche :</strong> ${echapperHtml(pdv.statut)}</p>
              <p style="margin: 4px 0;"><strong>Point de vente :</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
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
      <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
        <PDVStatusLegend compteurs={compteurs} className="pointer-events-auto [&>*]:shadow-sm" />
      </div>
    </div>
  );
};

export default PDVOverviewMap;
