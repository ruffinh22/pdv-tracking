import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';

// Plusieurs cartes (suivi, détail PDV, zones de géofencing) peuvent monter en
// même temps sur une page ou en navigation rapide : on ne charge le script
// Google Maps qu'une seule fois pour toute l'application, et toute carte qui
// se monte pendant que le chargement est déjà en cours attend la même promesse
// au lieu d'injecter un deuxième <script> (ce qui ferait planter l'API avec
// l'erreur "google.maps already defined").
let chargementPromise: Promise<typeof google> | null = null;

export function chargerGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps ne peut être chargé que côté navigateur'));
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  if (chargementPromise) return chargementPromise;

  chargementPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(
        new Error(
          "Clé API Google Maps manquante : définissez VITE_GOOGLE_MAPS_API_KEY " +
            '(voir frontend/src/config/googleMaps.ts).'
        )
      );
      return;
    }

    const callbackName = '__initGoogleMaps__';
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve((window as any).google);
    };

    // Si le navigateur bloque le script (politique de sécurité du serveur), on le détecte
    // pour afficher une cause précise au lieu d'accuser la clé ou le réseau.
    let bloqueParCsp = false;
    const surViolation = (e: SecurityPolicyViolationEvent) => {
      if (e.blockedURI.includes('maps.googleapis.com')) bloqueParCsp = true;
    };
    document.addEventListener('securitypolicyviolation', surViolation);

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&libraries=geometry&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      chargementPromise = null;
      document.removeEventListener('securitypolicyviolation', surViolation);
      reject(
        new Error(
          bloqueParCsp
            ? 'Google Maps est bloqué par la politique de sécurité (CSP) du serveur : autorisez https://maps.googleapis.com dans script-src, connect-src et img-src.'
            : 'Échec du chargement du script Google Maps (clé invalide, quota, ou réseau).'
        )
      );
    };
    document.head.appendChild(script);
  });

  return chargementPromise;
}
