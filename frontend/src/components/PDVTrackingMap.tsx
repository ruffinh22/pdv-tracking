import { useEffect, useRef } from 'react';
import { BRAND } from '../lib/theme';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import { PositionPDV } from '../services/pdvService';

interface Props {
  /** Position relevée à l'enrôlement : le point de vente déclaré. */
  ancrage: { latitude: number; longitude: number };
  /** Historique de positions, du plus ancien au plus récent. */
  positions: PositionPDV[];
  /** Rayon de la géofence, en mètres. */
  rayonGeofence?: number;
  /** Position poussée en direct par le socket, si plus récente que l'historique. */
  positionLive?: { latitude: number; longitude: number; horodatage: string } | null;
  hauteur?: number;
}

const COULEUR_ANCRAGE = BRAND.orange;
const COULEUR_TRACE = BRAND.green;
const COULEUR_HORS_ZONE = BRAND.red;

/** Distance en mètres entre deux points (Haversine), pour colorer le marqueur
 *  courant selon qu'il est dans la géofence ou non. */
function distanceEnMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const pointIcon = (g: typeof google, couleur: string, taille: number) => ({
  path: g.maps.SymbolPath.CIRCLE,
  scale: taille,
  fillColor: couleur,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
});

/**
 * Carte de suivi d'un point de vente : le point d'ancrage, le cercle de
 * géofence, le trajet du terminal sur la période et sa position courante.
 *
 * Tous les calques sont retirés et redessinés à chaque changement (au lieu
 * d'un LayerGroup Leaflet) : c'est ce qui évite l'accumulation silencieuse de
 * polylignes fantômes quand l'utilisateur change de période plusieurs fois.
 */
const PDVTrackingMap = ({
  ancrage,
  positions,
  rayonGeofence = 500,
  positionLive = null,
  hauteur = 380,
}: Props) => {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  // Tous les calques actuellement sur la carte, pour pouvoir tout nettoyer
  // avant de redessiner (équivalent du LayerGroup.clearLayers() de Leaflet).
  type Calque = google.maps.Marker | google.maps.Circle | google.maps.Polyline;
  const calquesRef = useRef<Calque[]>([]);

  useEffect(() => {
    let annule = false;

    chargerGoogleMaps()
      .then((g) => {
        if (annule || !conteneurRef.current) return;

        if (!carteRef.current) {
          carteRef.current = new g.maps.Map(conteneurRef.current, {
            center: { lat: ancrage.latitude, lng: ancrage.longitude },
            zoom: 16,
            styles: GOOGLE_MAP_STYLE,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          });
          infoWindowRef.current = new g.maps.InfoWindow();
        }

        dessiner(g);
      })
      .catch((err) => console.error('[PDVTrackingMap] Google Maps indisponible:', err));

    function dessiner(g: typeof google) {
      const carte = carteRef.current!;

      calquesRef.current.forEach((calque) => calque.setMap(null));
      calquesRef.current = [];

      // 1. Zone autorisée autour du point d'ancrage
      const zone = new g.maps.Circle({
        center: { lat: ancrage.latitude, lng: ancrage.longitude },
        radius: rayonGeofence,
        strokeColor: COULEUR_ANCRAGE,
        strokeWeight: 1.5,
        fillColor: COULEUR_ANCRAGE,
        fillOpacity: 0.07,
        map: carte,
        clickable: false,
      });
      calquesRef.current.push(zone);

      // 2. Point d'ancrage (emplacement déclaré du PDV)
      const markerAncrage = new g.maps.Marker({
        position: { lat: ancrage.latitude, lng: ancrage.longitude },
        map: carte,
        icon: pointIcon(g, COULEUR_ANCRAGE, 8),
        zIndex: 10,
      });
      markerAncrage.addListener('click', () => {
        infoWindowRef.current?.setContent('<strong>Point de vente</strong><br/>Position relevée à l\'installation');
        infoWindowRef.current?.open({ map: carte, anchor: markerAncrage });
      });
      calquesRef.current.push(markerAncrage);

      // 3. Trajet du terminal
      const points = positions
        .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }))
        .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

      if (points.length > 1) {
        const trace = new g.maps.Polyline({
          path: points,
          strokeColor: COULEUR_TRACE,
          strokeWeight: 3,
          strokeOpacity: 0.75,
          map: carte,
          clickable: false,
        });
        calquesRef.current.push(trace);
      }

      // Les points intermédiaires sont de simples repères discrets : afficher
      // un marqueur complet par position rendrait la carte illisible dès
      // quelques centaines de points.
      positions.forEach((p, i) => {
        if (i === positions.length - 1) return;
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const repere = new g.maps.Marker({
          position: { lat, lng },
          map: carte,
          icon: pointIcon(g, COULEUR_TRACE, 3),
          zIndex: 1,
        });
        repere.addListener('click', () => {
          infoWindowRef.current?.setContent(new Date(p.horodatage).toLocaleString('fr-FR'));
          infoWindowRef.current?.open({ map: carte, anchor: repere });
        });
        calquesRef.current.push(repere);
      });

      // 4. Position courante — celle du socket si elle est disponible, sinon
      // le dernier point de l'historique.
      const derniere = positions[positions.length - 1];
      const courante = positionLive
        ? { latitude: positionLive.latitude, longitude: positionLive.longitude, horodatage: positionLive.horodatage }
        : derniere
        ? { latitude: Number(derniere.latitude), longitude: Number(derniere.longitude), horodatage: derniere.horodatage }
        : null;

      let pointCourant: google.maps.LatLngLiteral | null = null;
      if (courante && !Number.isNaN(courante.latitude)) {
        const ecart = distanceEnMetres(ancrage.latitude, ancrage.longitude, courante.latitude, courante.longitude);
        const horsZone = ecart > rayonGeofence;
        const couleur = horsZone ? COULEUR_HORS_ZONE : COULEUR_TRACE;
        pointCourant = { lat: courante.latitude, lng: courante.longitude };

        const markerCourant = new g.maps.Marker({
          position: pointCourant,
          map: carte,
          icon: pointIcon(g, couleur, 7),
          zIndex: 20,
        });
        markerCourant.addListener('click', () => {
          infoWindowRef.current?.setContent(
            `<strong>Position actuelle</strong><br/>${new Date(courante.horodatage).toLocaleString('fr-FR')}<br/>` +
              `${Math.round(ecart)} m du point de vente${horsZone ? ' — hors zone' : ''}`
          );
          infoWindowRef.current?.open({ map: carte, anchor: markerCourant });
        });
        calquesRef.current.push(markerCourant);
      }

      // 5. Cadrage : on englobe la zone et le trajet, sans zoomer à l'excès
      // quand le terminal n'a pas bougé (cas normal d'un PDV sédentaire).
      const bounds = new g.maps.LatLngBounds();
      bounds.extend({ lat: ancrage.latitude, lng: ancrage.longitude });
      points.forEach((p) => bounds.extend(p));
      if (pointCourant) bounds.extend(pointCourant);

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      if (ne.equals(sw)) {
        carte.setCenter({ lat: ancrage.latitude, lng: ancrage.longitude });
        carte.setZoom(16);
      } else {
        carte.fitBounds(bounds, 48);
      }
    }

    return () => {
      annule = true;
    };
  }, [ancrage, positions, rayonGeofence, positionLive]);

  // La carte n'est détruite qu'au démontage du composant, pas à chaque rendu.
  useEffect(() => {
    return () => {
      calquesRef.current.forEach((calque) => calque.setMap(null));
      calquesRef.current = [];
      carteRef.current = null;
    };
  }, []);

  return <div ref={conteneurRef} style={{ height: hauteur, width: '100%', borderRadius: '0.5rem' }} />;
};

export default PDVTrackingMap;
