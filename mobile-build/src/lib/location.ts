import { Linking, Platform } from 'react-native';
import { GPSPoint } from '@/types';

/**
 * Acquisition de position, en une seule place.
 *
 * Le bug historique : `getFastLocation` faisait un `Promise.race` entre la
 * position fraîche et un timeout de 8 s, puis — si le timeout gagnait et qu'il
 * n'y avait pas de position en cache — faisait `return freshFix`, c'est-à-dire
 * qu'il ATTENDAIT sans limite la promesse qu'on venait justement d'abandonner
 * pour cause de lenteur. `getCurrentPositionAsync` ne rejette jamais tout seul
 * quand le GPS ne converge pas : elle reste simplement en attente. Résultat,
 * `refreshLocation()` ne se terminait jamais, l'écran restait bloqué sur son
 * indicateur de chargement, et comme rien ne réinitialisait l'état, le bouton
 * "Réessayer" relançait une deuxième promesse tout aussi éternelle. D'où
 * l'impression d'une initialisation qui « ne vient plus jamais ».
 *
 * Ici, TOUTE attente est bornée, toute erreur est convertie en résultat typé,
 * et deux appels simultanés partagent la même requête au lieu d'en empiler.
 */

export type EchecLocalisation =
  | 'permission_refusee'
  | 'service_desactive'
  | 'delai_depasse'
  | 'indisponible';

export type ResultatLocalisation =
  | { ok: true; point: GPSPoint; source: 'fraiche' | 'cache' }
  | { ok: false; raison: EchecLocalisation; message: string };

const MESSAGES: Record<EchecLocalisation, string> = {
  permission_refusee:
    "L'accès à la localisation est refusé. Autorisez-le dans les réglages de votre téléphone, puis réessayez.",
  service_desactive:
    'La localisation de votre téléphone est désactivée. Activez le GPS, puis réessayez.',
  delai_depasse:
    "Le signal GPS n'a pas été capté à temps. Sortez à l'air libre ou approchez-vous d'une fenêtre, puis réessayez.",
  indisponible: "La position n'a pas pu être obtenue. Réessayez dans quelques instants.",
};

/** Délai au-delà duquel on cesse d'attendre une position fraîche. */
const DELAI_POSITION_FRAICHE_MS = 12000;
/** Délai (court) pour la lecture de la dernière position connue, qui doit être quasi immédiate. */
const DELAI_CACHE_MS = 2500;
/** Âge maximal accepté pour une position en cache. */
const AGE_MAX_CACHE_MS = 5 * 60 * 1000;

let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Location = require('expo-location');
  } catch (error) {
    console.warn('[location] expo-location indisponible:', error);
  }
}

/**
 * Borne une promesse dans le temps. Le point clé par rapport à un
 * `Promise.race` nu : la promesse d'origine n'est jamais « ré-attendue »
 * ailleurs, donc elle ne peut pas rebloquer l'appelant. Si elle finit par
 * répondre après le délai, on l'ignore (et on neutralise son rejet éventuel
 * pour ne pas déclencher un "unhandled rejection").
 */
function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T | null> {
  let minuteur: ReturnType<typeof setTimeout>;
  const expiration = new Promise<null>((resolve) => {
    minuteur = setTimeout(() => resolve(null), delaiMs);
  });

  return Promise.race([
    promesse.catch((error) => {
      console.warn('[location] Erreur lors de l\'acquisition:', error);
      return null;
    }),
    expiration,
  ]).finally(() => clearTimeout(minuteur)) as Promise<T | null>;
}

function versPoint(position: any): GPSPoint | null {
  const coords = position && position.coords;
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return null;
  }
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : null,
    timestamp: position.timestamp || Date.now(),
  };
}

function echec(raison: EchecLocalisation): ResultatLocalisation {
  return { ok: false, raison, message: MESSAGES[raison] };
}

/** Position via l'API du navigateur, utilisée uniquement sur la cible web. */
function localiserWeb(): Promise<ResultatLocalisation> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(echec('indisponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => {
        resolve({
          ok: true,
          source: 'fraiche',
          point: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? null,
            timestamp: timestamp || Date.now(),
          },
        });
      },
      (erreur) => {
        resolve(echec(erreur && erreur.code === 1 ? 'permission_refusee' : 'delai_depasse'));
      },
      { enableHighAccuracy: true, timeout: DELAI_POSITION_FRAICHE_MS, maximumAge: 5000 }
    );
  });
}

/** Une seule acquisition en vol à la fois : deux écrans qui demandent la position partagent la requête. */
let requeteEnCours: Promise<ResultatLocalisation> | null = null;

async function acquerir(): Promise<ResultatLocalisation> {
  if (Platform.OS === 'web') return localiserWeb();
  if (!Location) return echec('indisponible');

  // 1. Permission. Un refus est un état stable : inutile de lancer une
  //    acquisition qui échouerait silencieusement derrière.
  let permission;
  try {
    permission = await avecDelai(Location.requestForegroundPermissionsAsync(), 15000);
  } catch {
    return echec('indisponible');
  }
  if (!permission) return echec('delai_depasse');
  if (permission.status !== 'granted') return echec('permission_refusee');

  // 2. Services de localisation activés ? Si le GPS du téléphone est coupé,
  //    `getCurrentPositionAsync` reste en attente indéfiniment sur Android —
  //    c'est exactement le cas qui bloquait l'app. On le détecte AVANT.
  try {
    const actif = await avecDelai(Location.hasServicesEnabledAsync(), 3000);
    if (actif === false) return echec('service_desactive');
  } catch {
    // Vérification best-effort : on poursuit, les délais ci-dessous protègent.
  }

  // 3. Dernière position connue d'abord : quasi instantanée, et suffisante
  //    pour une géofence de 500 m. L'écran affiche donc quelque chose tout de
  //    suite au lieu de rester vide pendant la convergence du GPS.
  let cache: GPSPoint | null = null;
  try {
    const connue = await avecDelai(
      Location.getLastKnownPositionAsync({ maxAge: AGE_MAX_CACHE_MS }),
      DELAI_CACHE_MS
    );
    cache = versPoint(connue);
  } catch {
    cache = null;
  }

  // 4. Position fraîche, strictement bornée. `Balanced` (assisté réseau)
  //    converge en quelques secondes là où `High` peut mettre 30 s en
  //    intérieur, pour une précision dont on n'a pas besoin ici.
  const fraiche = await avecDelai(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    DELAI_POSITION_FRAICHE_MS
  );
  const pointFrais = versPoint(fraiche);
  if (pointFrais) return { ok: true, point: pointFrais, source: 'fraiche' };

  // 5. Rien de frais : on rend le cache s'il existe. Sinon on ÉCHOUE
  //    explicitement — on ne repart jamais attendre la promesse abandonnée.
  if (cache) return { ok: true, point: cache, source: 'cache' };
  return echec('delai_depasse');
}

/**
 * Obtient la position courante. Se termine TOUJOURS, au pire par un échec
 * typé — jamais par une attente infinie.
 */
export async function obtenirPosition(): Promise<ResultatLocalisation> {
  if (requeteEnCours) return requeteEnCours;
  requeteEnCours = acquerir().finally(() => {
    requeteEnCours = null;
  });
  return requeteEnCours;
}

/**
 * Suit la position en continu tant que l'écran est monté. Complète (et ne
 * remplace pas) le tracking en arrière-plan : c'est ce qui fait bouger les
 * coordonnées à l'écran sans que l'utilisateur ait à appuyer sur "Actualiser".
 * Renvoie une fonction d'arrêt, toujours sûre à appeler.
 */
export async function suivrePosition(
  surPosition: (point: GPSPoint) => void
): Promise<() => void> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) =>
        surPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          timestamp: timestamp || Date.now(),
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }

  if (!Location) return () => {};

  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') return () => {};

    const abonnement = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
      (position: any) => {
        const point = versPoint(position);
        if (point) surPosition(point);
      }
    );
    return () => {
      try {
        abonnement.remove();
      } catch {
        // L'abonnement peut déjà avoir été retiré par le système.
      }
    };
  } catch (error) {
    console.warn('[location] Suivi continu indisponible:', error);
    return () => {};
  }
}

/** Ouvre les réglages système, pour que l'utilisateur puisse corriger lui-même un refus. */
export async function ouvrirReglages(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.warn('[location] Impossible d\'ouvrir les réglages:', error);
  }
}

/** Ouvre la position dans l'application de cartes du téléphone. */
export async function ouvrirDansMaps(point: GPSPoint, etiquette = 'Point de vente'): Promise<boolean> {
  const { latitude, longitude } = point;
  const candidats =
    Platform.OS === 'ios'
      ? [
          `maps://?q=${encodeURIComponent(etiquette)}&ll=${latitude},${longitude}`,
          `https://maps.apple.com/?q=${latitude},${longitude}`,
        ]
      : [
          `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(etiquette)})`,
          `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        ];

  for (const url of candidats) {
    try {
      // On tente l'ouverture directement plutôt que de se fier à `canOpenURL`,
      // qui renvoie false sur Android dès que le schéma n'est pas déclaré dans
      // le manifeste — alors que l'ouverture, elle, fonctionne.
      await Linking.openURL(url);
      return true;
    } catch {
      // On essaie le lien suivant (schéma natif -> lien web universel).
    }
  }
  return false;
}
