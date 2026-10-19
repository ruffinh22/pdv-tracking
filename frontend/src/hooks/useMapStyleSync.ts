import { useEffect, type MutableRefObject } from 'react';
import { stylesCarte } from '../config/googleMaps';
import { useThemeStore } from '../contexts/themeStore';

/** Applique le style clair/sombre à une carte Google dès qu'elle est prête et à chaque changement de thème. */
export function useMapStyleSync(mapRef: MutableRefObject<google.maps.Map | null>, pret: boolean) {
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    mapRef.current?.setOptions({ styles: stylesCarte(mode) });
  }, [mapRef, mode, pret]);
}
