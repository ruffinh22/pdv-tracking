import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const COULEUR_ANCRAGE = '#ff8200';
const COULEUR_TRACE = '#009a44';
const COULEUR_HORS_ZONE = '#d64545';

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

/**
 * Carte de suivi d'un point de vente : le point d'ancrage, le cercle de
 * géofence, le trajet du terminal sur la période et sa position courante.
 *
 * Tous les calques sont regroupés dans un LayerGroup unique, vidé et redessiné
 * à chaque changement : c'est ce qui évite l'accumulation silencieuse de
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
  const carteRef = useRef<L.Map | null>(null);
  const calquesRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!conteneurRef.current) return;

    if (!carteRef.current) {
      carteRef.current = L.map(conteneurRef.current, { zoomControl: true }).setView(
        [ancrage.latitude, ancrage.longitude],
        16
      );
      L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, \u00a9 OpenStreetMap contributors',
          maxZoom: 18,
        }
      ).addTo(carteRef.current);
      calquesRef.current = L.layerGroup().addTo(carteRef.current);
    }

    const carte = carteRef.current;
    const calques = calquesRef.current!;
    calques.clearLayers();

    // 1. Zone autorisée autour du point d'ancrage
    L.circle([ancrage.latitude, ancrage.longitude], {
      radius: rayonGeofence,
      color: COULEUR_ANCRAGE,
      weight: 1.5,
      fillColor: COULEUR_ANCRAGE,
      fillOpacity: 0.07,
    }).addTo(calques);

    // 2. Point d'ancrage (emplacement déclaré du PDV)
    L.marker([ancrage.latitude, ancrage.longitude], {
      icon: L.divIcon({
        className: 'pdv-ancrage',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${COULEUR_ANCRAGE};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    })
      .bindPopup('<strong>Point de vente</strong><br/>Position relevée à l\'installation')
      .addTo(calques);

    // 3. Trajet du terminal
    const points: [number, number][] = positions
      .map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number])
      .filter(([lat, lng]) => !Number.isNaN(lat) && !Number.isNaN(lng));

    if (points.length > 1) {
      L.polyline(points, {
        color: COULEUR_TRACE,
        weight: 3,
        opacity: 0.75,
        lineJoin: 'round',
      }).addTo(calques);
    }

    // Les points intermédiaires sont de simples repères discrets : afficher un
    // marqueur complet par position rendrait la carte illisible dès quelques
    // centaines de points.
    positions.forEach((p, i) => {
      if (i === positions.length - 1) return;
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      L.circleMarker([lat, lng], {
        radius: 2.5,
        color: COULEUR_TRACE,
        fillColor: COULEUR_TRACE,
        fillOpacity: 0.8,
        weight: 0,
      })
        .bindPopup(new Date(p.horodatage).toLocaleString('fr-FR'))
        .addTo(calques);
    });

    // 4. Position courante — celle du socket si elle est disponible, sinon le
    // dernier point de l'historique.
    const derniere = positions[positions.length - 1];
    const courante = positionLive
      ? { latitude: positionLive.latitude, longitude: positionLive.longitude, horodatage: positionLive.horodatage }
      : derniere
      ? { latitude: Number(derniere.latitude), longitude: Number(derniere.longitude), horodatage: derniere.horodatage }
      : null;

    if (courante && !Number.isNaN(courante.latitude)) {
      const ecart = distanceEnMetres(
        ancrage.latitude,
        ancrage.longitude,
        courante.latitude,
        courante.longitude
      );
      const horsZone = ecart > rayonGeofence;
      const couleur = horsZone ? COULEUR_HORS_ZONE : COULEUR_TRACE;

      L.marker([courante.latitude, courante.longitude], {
        icon: L.divIcon({
          className: 'pdv-courant',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${couleur};border:3px solid #fff;box-shadow:0 0 0 4px ${couleur}33"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        zIndexOffset: 500,
      })
        .bindPopup(
          `<strong>Position actuelle</strong><br/>${new Date(courante.horodatage).toLocaleString('fr-FR')}<br/>` +
            `${Math.round(ecart)} m du point de vente${horsZone ? ' — hors zone' : ''}`
        )
        .addTo(calques);
    }

    // 5. Cadrage : on englobe la zone et le trajet, sans zoomer à l'excès
    // quand le terminal n'a pas bougé (cas normal d'un PDV sédentaire).
    const aCadrer: [number, number][] = [
      [ancrage.latitude, ancrage.longitude],
      ...points,
    ];
    if (courante) aCadrer.push([courante.latitude, courante.longitude]);

    if (aCadrer.length > 1) {
      carte.fitBounds(L.latLngBounds(aCadrer).pad(0.25), { maxZoom: 17 });
    } else {
      carte.setView([ancrage.latitude, ancrage.longitude], 16);
    }

    // Leaflet calcule mal ses dimensions quand le conteneur est monté dans un
    // onglet ou une carte qui vient d'apparaître : on force un recalcul.
    setTimeout(() => carte.invalidateSize(), 80);
  }, [ancrage, positions, rayonGeofence, positionLive]);

  // La carte n'est détruite qu'au démontage du composant, pas à chaque rendu.
  useEffect(() => {
    return () => {
      carteRef.current?.remove();
      carteRef.current = null;
      calquesRef.current = null;
    };
  }, []);

  return <div ref={conteneurRef} style={{ height: hauteur, width: '100%', borderRadius: '0.5rem' }} />;
};

export default PDVTrackingMap;
