import { useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '../lib/theme';
import { STATUTS, StatutReel, ORDRE_STATUTS, calculerStatutReel, compterStatuts, dernierSignal, ageLisible, badgeStatutHtml, echapperHtml as echapper } from '../lib/pdvStatus';
import PDVStatusLegend from '../components/PDVStatusLegend';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { pdvService } from '../services/pdvService';
import { Maximize2, Minimize2, RefreshCw, Filter, Play, Pause, Radio, X, AlertTriangle } from 'lucide-react';

interface PDV {
  id: number;
  nom_pdv: string;
  latitude_creation: number;
  longitude_creation: number;
  derniere_position_latitude?: number;
  derniere_position_longitude?: number;
  derniere_position_date?: string;
  derniere_position_recue_at?: string | null;
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
  recu_at?: string | null;
}

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
    recu_at: raw?.recu_at ?? null,
    precision: rawPrecision !== null && rawPrecision !== undefined && Number.isFinite(Number(rawPrecision))
      ? Number(rawPrecision)
      : null,
  };
};

const createIcon = (etat: StatutReel, isSelected: boolean) => {
  const color = STATUTS[etat].couleur;
  const size = isSelected ? 40 : 32;
  const borderSize = isSelected ? 4 : 3;
  const enLigne = etat === 'en_ligne';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 8px;
      border: ${borderSize}px ${enLigne ? 'solid' : 'dashed'} white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      ${isSelected ? 'animation: pulse 2s infinite;' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// Au-delà de ce silence, un terminal de fiche active nécessite un passage terrain.
const SEUIL_A_INTERVENIR_MS = 30 * 60 * 1000;

const toCoord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const popupHtml = (
  pdv: PDV,
  pos: { lat: number; lng: number; date: string; live: boolean; precision: number | null },
  suivi: boolean,
  etat: StatutReel,
  signal: number | null
) => `
  <div style="min-width: 250px;">
    <h3 style="margin: 0 0 6px 0; font-weight: bold;">${echapper(pdv.nom_pdv)}</h3>
    <p style="margin: 0 0 8px 0;">${badgeStatutHtml(etat)}</p>
    <p style="margin: 4px 0;"><strong>Dernier signal reçu :</strong> ${signal === null ? 'jamais' : `${ageLisible(signal)} (${new Date(signal).toLocaleString('fr-FR')})`}</p>
    <p style="margin: 4px 0;"><strong>Position relevée :</strong> ${echapper(pos.date ? new Date(pos.date).toLocaleString('fr-FR') : 'Inconnue')}</p>
    <p style="margin: 4px 0;"><strong>Coordonnées :</strong> ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</p>
    <p style="margin: 4px 0;"><strong>Précision GPS :</strong> ${pos.precision !== null ? `±${Math.round(pos.precision)} m` : 'indisponible'}</p>
    <p style="margin: 4px 0;"><strong>Fiche :</strong> ${echapper(pdv.statut)}</p>
    ${
      suivi
        ? `<p style="margin: 8px 0 0 0; color: ${BRAND.green}; font-weight: 600;">Suivi en cours</p>
           <button data-action="arreter" data-pdv="${pdv.id}" style="margin-top: 6px; padding: 6px 12px; background: ${BRAND.red}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Arrêter le suivi</button>`
        : `<button data-action="suivre" data-pdv="${pdv.id}" style="margin-top: 8px; padding: 6px 12px; background: ${BRAND.green}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Suivre ce PDV</button>`
    }
  </div>`;

const Tracking = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const accuracyCirclesRef = useRef<Map<number, L.Circle>>(new Map());
  const polylinesRef = useRef<Map<number, L.Polyline>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [selectedPDV, setSelectedPDV] = useState<number | null>(null);
  const [livePositions, setLivePositions] = useState<Map<number, Position>>(new Map());
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [panneauOuvert, setPanneauOuvert] = useState(false);
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

  // Statut réel de chaque PDV : fiche + âge du dernier signal (heure serveur
  // de préférence, sinon horloge du terminal).
  const statuts = useMemo(() => {
    const m = new Map<number, { etat: StatutReel; signal: number | null }>();
    allPdvs.forEach((pdv) => {
      const live = livePositions.get(pdv.id);
      const signal = dernierSignal(maintenant, live?.recu_at, live?.horodatage, pdv.derniere_position_recue_at, pdv.derniere_position_date);
      m.set(pdv.id, { etat: calculerStatutReel(pdv.statut, signal, maintenant), signal });
    });
    return m;
  }, [allPdvs, livePositions, maintenant]);
  const compteurs = useMemo(() => compterStatuts(Array.from(statuts.values()).map((v) => v.etat)), [statuts]);

  // Terminaux muets : fiche active, jamais connectés ou sans signal depuis trop
  // longtemps. Les plus silencieux d'abord.
  const aIntervenir = useMemo(
    () =>
      allPdvs
        .map((pdv) => ({ pdv, ...(statuts.get(pdv.id) ?? { etat: 'jamais_connecte' as StatutReel, signal: null as number | null }) }))
        .filter(({ pdv, etat, signal }) =>
          pdv.statut === 'actif' &&
          (etat === 'jamais_connecte' || etat === 'hors_ligne' || (etat === 'en_retard' && signal !== null && maintenant - signal > SEUIL_A_INTERVENIR_MS))
        )
        .sort((a, b) => (a.signal ?? -Infinity) - (b.signal ?? -Infinity)),
    [allPdvs, statuts, maintenant]
  );

  const localiser = (id: number) => {
    const marker = markersRef.current.get(id);
    if (!marker || !mapRef.current) return;
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16));
    marker.openPopup();
  };

  // Filtres statut / zone réellement appliqués à la carte (auparavant ces deux
  // sélecteurs ne faisaient qu'un console.log, sans le moindre effet visible).
  const pdvs: PDV[] = useMemo(
    () =>
      allPdvs.filter((pdv) => {
        if (statutFilter !== 'all' && statuts.get(pdv.id)?.etat !== statutFilter) return false;
        if (zoneFilter === 'none' && pdv.zone_geofence_id) return false;
        return true;
      }),
    [allPdvs, statutFilter, zoneFilter, statuts]
  );

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: true
      });

      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, \u00a9 OpenStreetMap contributors, GIS User Community',
        maxZoom: 16
      }).addTo(mapRef.current);
    }

    return () => {
      markersRef.current.clear();
      accuracyCirclesRef.current.forEach((circle) => circle.remove());
      accuracyCirclesRef.current.clear();
      polylinesRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
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

  // Synchronisation incrémentale des marqueurs : on déplace/met à jour ceux qui
  // existent au lieu de tout supprimer à chaque position reçue (ce qui fermait
  // la fenêtre d'information et réinitialisait la vue en permanence).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const voulus = new Set(pdvs.filter((p) => positions.has(p.id)).map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!voulus.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });
    accuracyCirclesRef.current.forEach((circle, id) => {
      if (!voulus.has(id)) {
        map.removeLayer(circle);
        accuracyCirclesRef.current.delete(id);
      }
    });

    pdvs.forEach((pdv) => {
      const pos = positions.get(pdv.id);
      if (!pos) return;
      const { etat, signal } = statuts.get(pdv.id) ?? { etat: 'jamais_connecte' as StatutReel, signal: null };
      const couleurEtat = STATUTS[etat].couleur;
      const cle = `${etat}|${selectedPDV === pdv.id}`;
      const accuracyCircle = accuracyCirclesRef.current.get(pdv.id);
      if (pos.precision !== null && pos.precision > 0) {
        if (accuracyCircle) {
          accuracyCircle
            .setLatLng([pos.lat, pos.lng])
            .setRadius(pos.precision)
            .setStyle({
              color: couleurEtat,
              fillColor: couleurEtat,
            });
        } else {
          accuracyCirclesRef.current.set(
            pdv.id,
            L.circle([pos.lat, pos.lng], {
              radius: pos.precision,
              color: couleurEtat,
              weight: 1,
              fillColor: couleurEtat,
              fillOpacity: 0.12,
              interactive: false,
            }).addTo(map)
          );
        }
      } else if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCirclesRef.current.delete(pdv.id);
      }
      let marker = markersRef.current.get(pdv.id) as (L.Marker & { __cle?: string; __html?: string }) | undefined;

      if (!marker) {
        marker = L.marker([pos.lat, pos.lng], { icon: createIcon(etat, selectedPDV === pdv.id) }) as L.Marker & { __cle?: string; __html?: string };
        marker.__cle = cle;
        marker.addTo(map);
        marker.__html = popupHtml(pdv, pos, selectedPDV === pdv.id, etat, signal);
        marker.bindPopup(marker.__html);
        markersRef.current.set(pdv.id, marker);
      } else {
        marker.setLatLng([pos.lat, pos.lng]);
        if (marker.__cle !== cle) {
          marker.setIcon(createIcon(etat, selectedPDV === pdv.id));
          marker.__cle = cle;
        }
        // Le contenu n'est remplacé que s'il a changé : sinon le bouton serait
        // recréé sous le doigt de l'utilisateur et le clic perdu.
        const html = popupHtml(pdv, pos, selectedPDV === pdv.id, etat, signal);
        if (marker.__html !== html) {
          marker.__html = html;
          marker.setPopupContent(html);
        }
      }
    });

    // Trajectoire du PDV suivi (historique réel + position actuelle)
    polylinesRef.current.forEach((pl) => map.removeLayer(pl));
    polylinesRef.current.clear();
    if (selectedPDV && positions.has(selectedPDV)) {
      const pos = positions.get(selectedPDV)!;
      const points: [number, number][] = historique.map((h) => [h.latitude, h.longitude]);
      const dernier = points[points.length - 1];
      if (!dernier || dernier[0] !== pos.lat || dernier[1] !== pos.lng) points.push([pos.lat, pos.lng]);
      if (points.length > 1) {
        polylinesRef.current.set(
          selectedPDV,
          L.polyline(points, { color: BRAND.orange, weight: 3, opacity: 0.8, dashArray: '10, 10' }).addTo(map)
        );
      }
    }
  }, [pdvs, positions, selectedPDV, historique, statuts]);

  // Cadrage global : uniquement quand l'ensemble des PDV affichés change
  // (chargement, filtre) ou quand on arrête le suivi, jamais à chaque position.
  const cleCadrage = useMemo(
    () => pdvs.filter((p) => positions.has(p.id)).map((p) => p.id).join(','),
    [pdvs, positions]
  );
  const aucunSuivi = selectedPDV === null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !aucunSuivi || markersRef.current.size === 0) return;
    const groupe = L.featureGroup(Array.from(markersRef.current.values()));
    map.fitBounds(groupe.getBounds().pad(0.1), { maxZoom: 15 });
  }, [cleCadrage, aucunSuivi]);

  // Suivi : zoom sur le PDV à la sélection, puis la carte le suit sans toucher au zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPDV) return;
    const marker = markersRef.current.get(selectedPDV);
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
  }, [selectedPDV]);

  const posSuivie = selectedPDV ? positions.get(selectedPDV) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !posSuivie || !isTracking) return;
    map.panTo([posSuivie.lat, posSuivie.lng], { animate: true });
  }, [posSuivie?.lat, posSuivie?.lng, isTracking]);

  // Boutons de la fenêtre d'information. Écoute en phase de capture sur la carte :
  // Leaflet stoppe la propagation des clics à l'intérieur des popups.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const surClic = (e: Event) => {
      const cible = (e.target as HTMLElement | null)?.closest?.('[data-action]') as HTMLElement | null;
      if (!cible) return;
      if (cible.dataset.action === 'suivre') {
        setSelectedPDV(Number(cible.dataset.pdv));
        setIsTracking(true);
        mapRef.current?.closePopup();
      } else if (cible.dataset.action === 'arreter') {
        setSelectedPDV(null);
        mapRef.current?.closePopup();
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
    if (mapRef.current) {
      mapRef.current.invalidateSize();
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">PDV en ligne (&lt; 2 min)</p>
              <p className="text-[20px] font-bold tabular-nums">{compteurs.en_ligne}<span className="text-[13px] font-semibold text-white/70"> / {allPdvs.length}</span></p>
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
          <select value={statutFilter} className="toolbar-select !h-9 !w-44" onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            {ORDRE_STATUTS.map((st) => (
              <option key={st} value={st}>{STATUTS[st].libelle} ({compteurs[st]})</option>
            ))}
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

        <button
          type="button"
          onClick={() => setPanneauOuvert((v) => !v)}
          className={`inline-flex items-center gap-2 h-9 px-3 rounded-[4px] border text-[13px] font-semibold transition-colors ${
            aIntervenir.length ? 'bg-danger-50 border-danger-200 text-danger-700 hover:bg-danger-100' : 'bg-ink-50 border-ink-200 text-ink-600'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          À intervenir
          <span className="tabular-nums">{aIntervenir.length}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <PDVStatusLegend compteurs={compteurs} selection={statutFilter} onSelect={setStatutFilter} />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-ink-50 border border-ink-200 text-xs font-semibold text-ink-700">
            <span className="w-4 h-0 border-t-2 border-dashed border-primary-500" />Trajectoire
          </span>
        </div>
      </div>

      {/* Carte en plein écran */}
      <div className="flex-1 relative z-0">
        <div ref={mapContainerRef} className="absolute inset-0 bg-ink-100" />
        {panneauOuvert && (
          <aside className="absolute top-3 right-3 bottom-3 w-80 max-w-[85vw] z-[500] flex flex-col bg-white border border-ink-300 rounded-[4px] shadow-popover">
            <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-ink-200">
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-ink-900">Terminaux à intervenir</p>
                <p className="text-[11px] text-ink-500">Fiche active, sans signal depuis plus de 30 min</p>
              </div>
              <button onClick={() => setPanneauOuvert(false)} className="p-1 text-ink-500 hover:text-ink-900" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </header>
            <ul className="flex-1 overflow-y-auto divide-y divide-ink-100">
              {aIntervenir.length === 0 && <li className="px-3.5 py-6 text-center text-[13px] text-ink-500">Aucun terminal muet.</li>}
              {aIntervenir.map(({ pdv, etat, signal }) => (
                <li key={pdv.id}>
                  <button onClick={() => localiser(pdv.id)} className="w-full text-left px-3.5 py-2.5 hover:bg-ink-50 flex items-start gap-2.5">
                    <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUTS[etat].couleur }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink-900 truncate">{pdv.nom_pdv}</span>
                      <span className="block text-[11.5px] text-ink-500">
                        {STATUTS[etat].libelle} · {signal === null ? 'aucun signal reçu' : `dernier signal ${ageLisible(signal, maintenant)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
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