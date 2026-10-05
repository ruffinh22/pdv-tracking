import { useEffect, useMemo, useRef, useState } from 'react';
import { BRAND, couleurStatut } from '../lib/theme';
import { useQuery } from '@tanstack/react-query';
import { chargerGoogleMaps } from '../lib/googleMapsLoader';
import { GOOGLE_MAP_STYLE } from '../config/googleMaps';
import { io, Socket } from 'socket.io-client';
import { pdvService } from '../services/pdvService';
import { Maximize2, Minimize2, RefreshCw, Filter, Play, Pause, Radio, X } from 'lucide-react';
import MapStatusOverlay from '../components/MapStatusOverlay';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  derniere_position_latitude?: number;
  derniere_position_longitude?: number;
  derniere_position_date?: string;
  derniere_position_precision?: number | string | null;
  statut: string;
  zone_geofence_id?: number | null;
}

interface Position {
  pdv_id: number;
  latitude: number;
  longitude: number;
  horodatage: string;
  precision: number | null;
}

const SEUIL_POSITION_RECENTE_MS = 2 * 60 * 1000;

const estPositionRecente = (date: string, maintenant: number): boolean => {
  const horodatage = Date.parse(date);
  const age = maintenant - horodatage;
  return Number.isFinite(horodatage) && age >= -30_000 && age <= SEUIL_POSITION_RECENTE_MS;
};

// Le backend peut renvoyer l'historique de positions avec des noms de champs
// légèrement différents selon l'endpoint ; on normalise ici plutôt que de
// supposer un seul format.
const normalizePosition = (raw: any): Position | null => {
  const lat = Number(raw?.latitude ?? raw?.lat);
  const lng = Number(raw?.longitude ?? raw?.lng ?? raw?.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  const rawPrecision = raw?.precision ?? raw?.accuracy;
  return {
    pdv_id: Number(raw?.pdv_id ?? raw?.pdvId),
    latitude: lat,
    longitude: lng,
    horodatage: raw?.horodatage ?? raw?.date ?? raw?.timestamp ?? raw?.created_at ?? '',
    precision: rawPrecision !== null && rawPrecision !== undefined && Number.isFinite(Number(rawPrecision))
      ? Number(rawPrecision)
      : null,
  };
};

// Icône "téléphone" en SVG inline encodé en data URI : Google Maps Marker
// n'accepte pas de HTML arbitraire comme icône (contrairement au L.divIcon de
// Leaflet), seulement une URL/SVG. Le halo pulsé du PDV sélectionné est rendu
// séparément par un cercle Google Maps additionnel (voir dessinerMarqueurs).
const createIcon = (g: typeof google, statut: string, isSelected: boolean, positionRecente: boolean) => {
  const color = positionRecente ? couleurStatut(statut) : '#8B929B';
  const size = isSelected ? 40 : 32;
  const borderSize = isSelected ? 4 : 3;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="${borderSize / 2}" y="${borderSize / 2}" width="${size - borderSize}" height="${size - borderSize}" rx="8" ry="8" fill="${color}" stroke="white" stroke-width="${borderSize}"/>
      <g transform="translate(${size * 0.225}, ${size * 0.225}) scale(${size * 0.55 / 24})">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(size, size),
    anchor: new g.maps.Point(size / 2, size / 2),
  };
};

const toCoord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const echapper = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const popupHtml = (
  pdv: PDV,
  pos: { lat: number; lng: number; date: string; live: boolean; precision: number | null },
  suivi: boolean,
  positionRecente: boolean
) => `
  <div style="min-width: 240px;">
    <h3 style="margin: 0 0 8px 0; font-weight: bold;">${echapper(pdv.nom_pdv)}</h3>
    <p style="margin: 4px 0;"><strong>Statut PDV :</strong> ${echapper(pdv.statut)}</p>
    <p style="margin: 4px 0;"><strong>Suivi GPS :</strong> ${positionRecente ? 'Position récente' : 'Aucune position depuis plus de 2 min'}</p>
    <p style="margin: 4px 0;"><strong>Position :</strong> ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</p>
    <p style="margin: 4px 0;"><strong>Précision GPS estimée :</strong> ${pos.precision !== null ? `±${Math.round(pos.precision)} m` : 'indisponible'}</p>
    <p style="margin: 4px 0;"><strong>Dernière mise à jour :</strong> ${echapper(pos.date ? new Date(pos.date).toLocaleString('fr-FR') : 'Inconnue')}</p>
    ${
      suivi
        ? `<p style="margin: 8px 0 0 0; color: ${BRAND.green}; font-weight: 600;">Suivi en cours</p>
           <button data-action="arreter" data-pdv="${pdv.id}" style="margin-top: 6px; padding: 6px 12px; background: ${BRAND.red}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Arrêter le suivi</button>`
        : `<button data-action="suivre" data-pdv="${pdv.id}" style="margin-top: 8px; padding: 6px 12px; background: ${BRAND.green}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Suivre ce PDV</button>`
    }
  </div>`;

const Tracking = () => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const accuracyCirclesRef = useRef<Map<number, google.maps.Circle>>(new Map());
  const polylinesRef = useRef<Map<number, google.maps.Polyline>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [selectedPDV, setSelectedPDV] = useState<number | null>(null);
  const [livePositions, setLivePositions] = useState<Map<number, Position>>(new Map());
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    const intervalle = setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => clearInterval(intervalle);
  }, []);

  const { data: pdvsResponse } = useQuery({
    queryKey: ['pdvsForTracking'],
    queryFn: () => pdvService.getAllPDVsNoPagination(),
    // On revalide périodiquement au cas où le socket serait momentanément
    // coupé, pour ne pas rester bloqué sur des positions figées.
    refetchInterval: isConnected ? false : 60_000,
  });

  // Historique réel des positions du PDV suivi (pour tracer la trajectoire),
  // au lieu de points générés aléatoirement.
  const { data: selectedPdvPositions } = useQuery({
    queryKey: ['pdvPositions', selectedPDV],
    queryFn: () => (selectedPDV ? pdvService.getPDVPositions(selectedPDV, { limit: 500 }) : Promise.resolve([])),
    enabled: !!selectedPDV,
    staleTime: 60_000,
  });

  const allPdvs: PDV[] = useMemo(() => pdvsResponse?.data || [], [pdvsResponse]);

  // Filtres statut / zone réellement appliqués à la carte (auparavant ces deux
  // sélecteurs ne faisaient qu'un console.log, sans le moindre effet visible).
  const pdvs: PDV[] = useMemo(
    () =>
      allPdvs.filter((pdv) => {
        if (statutFilter !== 'all' && pdv.statut !== statutFilter) return false;
        if (zoneFilter === 'none' && pdv.zone_geofence_id) return false;
        return true;
      }),
    [allPdvs, statutFilter, zoneFilter]
  );

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let annule = false;

    chargerGoogleMaps()
      .then((g) => {
        if (annule || !mapContainerRef.current || mapRef.current) return;
        googleRef.current = g;
        mapRef.current = new g.maps.Map(mapContainerRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          styles: GOOGLE_MAP_STYLE,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        infoWindowRef.current = new g.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err) => console.error('[Tracking] Google Maps indisponible:', err));

    return () => {
      annule = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      accuracyCirclesRef.current.forEach((circle) => circle.setMap(null));
      accuracyCirclesRef.current.clear();
      polylinesRef.current.forEach((pl) => pl.setMap(null));
      polylinesRef.current.clear();
      mapRef.current = null;
    };
  }, []);

  // Initialiser Socket.IO une seule fois au montage. Dépendances volontairement
  // vides : le tableau de dépendances précédent incluait `livePositions`, qui
  // change à chaque position reçue, ce qui fermait et recréait la connexion
  // en boucle toutes les quelques secondes. La connexion doit rester stable
  // pour un vrai suivi en temps réel.
  useEffect(() => {
    const socket = io(undefined, {
      // Fonction : le jeton est relu à chaque (re)connexion, donc toujours à jour.
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  // Le bouton pause/lecture n'interrompt plus une simulation : il indique au
  // serveur de suspendre/reprendre l'envoi des positions pour cette session,
  // et ignore localement les événements entrants pendant la pause.
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.emit(isTracking ? 'tracking:resume' : 'tracking:pause');
  }, [isTracking]);

  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;
    const handler = (data: any) => {
      if (!isTracking) return;
      const pos = normalizePosition(data);
      if (!pos || !pos.pdv_id) return;
      setLivePositions((prev) => {
        const next = new Map(prev);
        next.set(pos.pdv_id, pos);
        return next;
      });
    };
    socket.off('position_update');
    socket.on('position_update', handler);
    return () => {
      socket.off('position_update', handler);
    };
  }, [isTracking]);

  // Historique réel du PDV suivi, trié par date.
  const historique = useMemo(
    () =>
      (selectedPdvPositions || [])
        .map(normalizePosition)
        .filter((p): p is Position => !!p)
        .sort((x, y) => new Date(x.horodatage).getTime() - new Date(y.horodatage).getTime()),
    [selectedPdvPositions]
  );

  // Position affichée de chaque PDV : la plus récente parmi le temps réel,
  // l'historique interrogé (PDV suivi) et la dernière position connue.
  const positions = useMemo(() => {
    const out = new Map<number, { lat: number; lng: number; date: string; live: boolean; precision: number | null }>();
    const temps = (d?: string) => (d ? new Date(d).getTime() || 0 : 0);
    pdvs.forEach((pdv) => {
      const candidats: { lat: unknown; lng: unknown; date: string; live: boolean; precision: unknown }[] = [];
      const live = livePositions.get(pdv.id);
      if (live) candidats.push({ lat: live.latitude, lng: live.longitude, date: live.horodatage, live: true, precision: live.precision });
      if (selectedPDV === pdv.id && historique.length) {
        const h = historique[historique.length - 1];
        candidats.push({ lat: h.latitude, lng: h.longitude, date: h.horodatage, live: true, precision: h.precision });
      }
      candidats.push({
        lat: pdv.derniere_position_latitude,
        lng: pdv.derniere_position_longitude,
        date: pdv.derniere_position_date || '',
        live: false,
        precision: pdv.derniere_position_precision,
      });
      candidats.push({ lat: pdv.latitude_creation, lng: pdv.longitude_creation, date: '', live: false, precision: null });

      const valides = candidats
        .map((c) => ({
          ...c,
          lat: toCoord(c.lat),
          lng: toCoord(c.lng),
          precision: c.precision !== null && c.precision !== undefined && Number.isFinite(Number(c.precision))
            ? Number(c.precision)
            : null,
        }))
        .filter((c): c is { lat: number; lng: number; date: string; live: boolean; precision: number | null } => c.lat !== null && c.lng !== null);
      if (!valides.length) return;
      // Le candidat daté le plus récent gagne ; à défaut, l'ordre de priorité ci-dessus.
      const meilleur = valides.reduce((m, c) => (temps(c.date) > temps(m.date) ? c : m), valides[0]);
      out.set(pdv.id, meilleur);
    });
    return out;
  }, [pdvs, livePositions, historique, selectedPDV]);

  const positionsRecentes = useMemo(
    () => Array.from(positions.values()).filter((position) => estPositionRecente(position.date, maintenant)).length,
    [positions, maintenant]
  );

  // Synchronisation incrémentale des marqueurs : on déplace/met à jour ceux qui
  // existent au lieu de tout supprimer à chaque position reçue (ce qui fermait
  // la fenêtre d'information et réinitialisait la vue en permanence).
  useEffect(() => {
    const map = mapRef.current;
    const g = googleRef.current;
    if (!map || !g) return;

    const voulus = new Set(pdvs.filter((p) => positions.has(p.id)).map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!voulus.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });
    accuracyCirclesRef.current.forEach((circle, id) => {
      if (!voulus.has(id)) {
        circle.setMap(null);
        accuracyCirclesRef.current.delete(id);
      }
    });

    pdvs.forEach((pdv) => {
      const pos = positions.get(pdv.id);
      if (!pos) return;
      const positionRecente = estPositionRecente(pos.date, maintenant);
      const cle = `${pdv.statut}|${selectedPDV === pdv.id}|${positionRecente}`;
      const accuracyCircle = accuracyCirclesRef.current.get(pdv.id);
      if (pos.precision !== null && pos.precision > 0) {
        const couleur = positionRecente ? BRAND.green : '#8B929B';
        if (accuracyCircle) {
          accuracyCircle.setCenter({ lat: pos.lat, lng: pos.lng });
          accuracyCircle.setRadius(pos.precision);
          accuracyCircle.setOptions({ strokeColor: couleur, fillColor: couleur });
        } else {
          accuracyCirclesRef.current.set(
            pdv.id,
            new g.maps.Circle({
              center: { lat: pos.lat, lng: pos.lng },
              radius: pos.precision,
              strokeColor: couleur,
              strokeWeight: 1,
              fillColor: couleur,
              fillOpacity: 0.12,
              clickable: false,
              map,
            })
          );
        }
      } else if (accuracyCircle) {
        accuracyCircle.setMap(null);
        accuracyCirclesRef.current.delete(pdv.id);
      }
      let marker = markersRef.current.get(pdv.id) as (google.maps.Marker & { __cle?: string; __html?: string }) | undefined;
      const html = popupHtml(pdv, pos, selectedPDV === pdv.id, positionRecente);

      if (!marker) {
        marker = new g.maps.Marker({
          position: { lat: pos.lat, lng: pos.lng },
          map,
          icon: createIcon(g, pdv.statut, selectedPDV === pdv.id, positionRecente),
        }) as google.maps.Marker & { __cle?: string; __html?: string };
        marker.__cle = cle;
        marker.__html = html;
        // Le contenu est relu sur `marker.__html` au moment du clic (pas
        // capturé en closure) : il reste donc à jour même si ce listener,
        // attaché une seule fois à la création, n'est jamais recréé.
        marker.addListener('click', () => {
          infoWindowRef.current?.setContent(marker!.__html || '');
          infoWindowRef.current?.open({ map, anchor: marker });
        });
        markersRef.current.set(pdv.id, marker);
      } else {
        marker.setPosition({ lat: pos.lat, lng: pos.lng });
        if (marker.__cle !== cle) {
          marker.setIcon(createIcon(g, pdv.statut, selectedPDV === pdv.id, positionRecente));
          marker.__cle = cle;
        }
        marker.__html = html;
      }
    });

    // Trajectoire du PDV suivi (historique réel + position actuelle)
    polylinesRef.current.forEach((pl) => pl.setMap(null));
    polylinesRef.current.clear();
    if (selectedPDV && positions.has(selectedPDV)) {
      const pos = positions.get(selectedPDV)!;
      const points: google.maps.LatLngLiteral[] = historique.map((h) => ({ lat: h.latitude, lng: h.longitude }));
      const dernier = points[points.length - 1];
      if (!dernier || dernier.lat !== pos.lat || dernier.lng !== pos.lng) points.push({ lat: pos.lat, lng: pos.lng });
      if (points.length > 1) {
        polylinesRef.current.set(
          selectedPDV,
          new g.maps.Polyline({
            path: points,
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: BRAND.orange, scale: 3 },
                offset: '0',
                repeat: '14px',
              },
            ],
            map,
          })
        );
      }
    }
  }, [pdvs, positions, selectedPDV, historique, maintenant, mapReady]);

  // Cadrage global : uniquement quand l'ensemble des PDV affichés change
  // (chargement, filtre) ou quand on arrête le suivi, jamais à chaque position.
  const cleCadrage = useMemo(
    () => pdvs.filter((p) => positions.has(p.id)).map((p) => p.id).join(','),
    [pdvs, positions]
  );
  const aucunSuivi = selectedPDV === null;
  useEffect(() => {
    const map = mapRef.current;
    const g = googleRef.current;
    if (!map || !g || !aucunSuivi || markersRef.current.size === 0) return;
    const bounds = new g.maps.LatLngBounds();
    markersRef.current.forEach((marker) => {
      const pos = marker.getPosition();
      if (pos) bounds.extend(pos);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
  }, [cleCadrage, aucunSuivi, mapReady]);

  // Suivi : zoom sur le PDV à la sélection, puis la carte le suit sans toucher au zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPDV) return;
    const marker = markersRef.current.get(selectedPDV);
    const pos = marker?.getPosition();
    if (pos) {
      map.setCenter(pos);
      map.setZoom(Math.max(map.getZoom() ?? 0, 15));
    }
  }, [selectedPDV]);

  const posSuivie = selectedPDV ? positions.get(selectedPDV) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !posSuivie || !isTracking) return;
    map.panTo({ lat: posSuivie.lat, lng: posSuivie.lng });
  }, [posSuivie?.lat, posSuivie?.lng, isTracking]);

  // Boutons de la fenêtre d'information. Écoute en phase de capture sur le
  // conteneur de la carte : l'InfoWindow Google Maps est rendue à l'intérieur
  // de ce conteneur, donc ses clics y remontent normalement — on les
  // intercepte avant qu'ils n'atteignent autre chose.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const surClic = (e: Event) => {
      const cible = (e.target as HTMLElement | null)?.closest?.('[data-action]') as HTMLElement | null;
      if (!cible) return;
      if (cible.dataset.action === 'suivre') {
        setSelectedPDV(Number(cible.dataset.pdv));
        setIsTracking(true);
        infoWindowRef.current?.close();
      } else if (cible.dataset.action === 'arreter') {
        setSelectedPDV(null);
        infoWindowRef.current?.close();
      }
    };
    el.addEventListener('click', surClic, true);
    return () => el.removeEventListener('click', surClic, true);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const refreshMap = () => {
    const map = mapRef.current;
    const g = googleRef.current;
    if (map && g) {
      g.maps.event.trigger(map, 'resize');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-white flex flex-col">
      {/* Barre de contrôle principale : vert du logo, texte blanc */}
      <div className="bg-success-600 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3" style={{ position: 'relative', zIndex: 100 }}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-[4px] bg-white/15 border border-white/25">
              <Radio className="w-[18px] h-[18px]" />
            </span>
            <div className="leading-tight">
              <h1 className="text-[17px] font-bold tracking-tight text-white">Suivi en temps réel</h1>
              <p className="text-[11.5px] font-medium text-white/80">Position des points de vente</p>
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <div className="px-3.5 py-1.5 rounded-[4px] bg-white/10 border border-white/20 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">Statut PDV actif</p>
              <p className="text-[20px] font-bold tabular-nums">{allPdvs.filter((p) => p.statut === 'actif').length || 0}</p>
            </div>
            <div className="px-3.5 py-1.5 rounded-[4px] bg-white/10 border border-white/20 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">Positions récentes (&lt; 2 min)</p>
              <p className="text-[20px] font-bold tabular-nums">{positionsRecentes}</p>
            </div>
            <div
              className="px-3.5 py-1.5 rounded-[4px] bg-white text-ink-800 flex items-center gap-2.5 leading-tight"
              title={isConnected ? 'Connexion temps réel active' : 'Connexion temps réel indisponible : le PDV suivi est actualisé toutes les 10 s'}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success-600' : 'bg-danger-500'}`} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">Connexion</p>
                <p className={`text-[13px] font-bold ${isConnected ? 'text-success-700' : 'text-danger-600'}`}>
                  {isConnected ? 'Temps réel actif' : 'Indisponible'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTracking(!isTracking)}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[4px] bg-white/15 border border-white/25 hover:bg-white/25 text-sm font-semibold transition-colors"
            title={isTracking ? 'Mettre en pause' : 'Reprendre'}
          >
            {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{isTracking ? 'Pause' : 'Reprendre'}</span>
          </button>
          <button
            onClick={refreshMap}
            className="inline-flex items-center justify-center w-10 h-10 rounded-[4px] bg-white/15 border border-white/25 hover:bg-white/25 transition-colors"
            title="Rafraîchir la carte"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center w-10 h-10 rounded-[4px] bg-white/15 border border-white/25 hover:bg-white/25 transition-colors"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {selectedPDV && (
            <button
              onClick={() => setSelectedPDV(null)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[4px] bg-danger-500 hover:bg-danger-600 border border-danger-600 text-white text-sm font-semibold transition-colors"
            >
              <X className="w-4 h-4" />
              Arrêter le suivi
            </button>
          )}
        </div>
      </div>

      {/* Barre de filtres : blanche, lisible, pastilles de légende */}
      <div className="bg-white border-b border-ink-300 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ position: 'relative', zIndex: 90 }}>
        <div className="flex items-center gap-2 text-ink-700">
          <Filter className="w-4 h-4 text-success-600" />
          <span className="text-[13px] font-semibold">Filtres</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-600">Statut</label>
          <select value={statutFilter} className="toolbar-select !h-9 !w-40" onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="all">Tous</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
            <option value="suspendu">Suspendus</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-600">Zone</label>
          <select value={zoneFilter} className="toolbar-select !h-9 !w-48" onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="all">Toutes les zones</option>
            <option value="none">Sans zone</option>
          </select>
        </div>

        {(statutFilter !== 'all' || zoneFilter !== 'all') && (
          <span className="text-xs font-semibold text-success-700 bg-success-50 border border-success-200 px-2.5 py-1 rounded-[4px]">
            {pdvs.length} / {allPdvs.length} PDV affiché(s)
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto text-xs font-semibold text-ink-700">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-ink-50 border border-ink-200">
            <span className="w-2.5 h-2.5 rounded-full bg-success-600" />Actif
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-ink-50 border border-ink-200">
            <span className="w-2.5 h-2.5 rounded-full bg-ink-400" />Inactif
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-ink-50 border border-ink-200">
            <span className="w-2.5 h-2.5 rounded-full bg-danger-500" />Suspendu
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-ink-50 border border-ink-200">
            <span className="w-4 h-0 border-t-2 border-dashed border-primary-500" />Trajectoire
          </span>
        </div>
      </div>

      {/* Carte en plein écran */}
      <div className="flex-1 relative z-0">
        <div ref={mapContainerRef} className="absolute inset-0 bg-ink-100" />
        {selectedPDV && (
          <div className="absolute top-3 left-14 z-[500] flex items-center gap-3 bg-white border border-ink-300 rounded-[4px] shadow-popover px-3.5 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success-600 animate-pulse" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">Suivi en cours</p>
              <p className="text-[13px] font-bold text-ink-900">
                {allPdvs.find((p) => p.id === selectedPDV)?.nom_pdv || `PDV ${selectedPDV}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedPDV(null)}
              className="ml-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-[4px] bg-danger-500 hover:bg-danger-600 text-white text-xs font-semibold transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Arrêter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tracking;