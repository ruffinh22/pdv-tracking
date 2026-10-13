import { BRAND } from './theme';

/**
 * Statut RÉEL d'un point de vente, source unique pour toutes les cartes.
 * Il combine la fiche (actif / inactif / suspendu) et la vie du terminal
 * (âge du dernier signal reçu). Mêmes seuils que le backend (utils/etatSuivi).
 */
export type StatutReel = 'en_ligne' | 'en_retard' | 'hors_ligne' | 'jamais_connecte' | 'inactif' | 'suspendu';

export const SEUIL_EN_LIGNE_MS = 2 * 60 * 1000;
export const SEUIL_HORS_LIGNE_MS = 48 * 60 * 60 * 1000;
const TOLERANCE_AVANCE_MS = 5 * 60 * 1000; // horloge téléphone en avance

export const STATUTS: Record<StatutReel, { libelle: string; description: string; couleur: string }> = {
  en_ligne: { libelle: 'En ligne', description: 'Signal reçu il y a moins de 2 min', couleur: BRAND.green },
  en_retard: { libelle: 'Signal en retard', description: 'Dernier signal entre 2 min et 48 h', couleur: BRAND.orange },
  hors_ligne: { libelle: 'Hors ligne', description: 'Aucun signal depuis plus de 48 h', couleur: BRAND.red },
  jamais_connecte: { libelle: 'Jamais connecté', description: 'Aucune position reçue du terminal', couleur: '#E0A800' },
  inactif: { libelle: 'Fiche inactive', description: 'Point de vente désactivé', couleur: BRAND.grey },
  suspendu: { libelle: 'Fiche suspendue', description: 'Point de vente suspendu', couleur: BRAND.charcoal },
};

export const ORDRE_STATUTS: StatutReel[] = ['en_ligne', 'en_retard', 'hors_ligne', 'jamais_connecte', 'inactif', 'suspendu'];

const enMs = (d: unknown): number | null => {
  if (d === null || d === undefined || d === '') return null;
  const t = d instanceof Date ? d.getTime() : typeof d === 'number' ? d : Date.parse(String(d));
  return Number.isFinite(t) ? t : null;
};

/** Signal le plus récent parmi les dates fournies (heure serveur de préférence).
 *  Une date trop en avance est ignorée ; une légère avance vaut « maintenant ». */
export const dernierSignal = (maintenant: number, ...dates: unknown[]): number | null => {
  let best: number | null = null;
  for (const d of dates) {
    let t = enMs(d);
    if (t === null || t - maintenant > TOLERANCE_AVANCE_MS) continue;
    if (t > maintenant) t = maintenant;
    if (best === null || t > best) best = t;
  }
  return best;
};

export const calculerStatutReel = (statutFiche: string | null | undefined, signal: number | null, maintenant = Date.now()): StatutReel => {
  if (statutFiche === 'suspendu') return 'suspendu';
  if (statutFiche === 'inactif') return 'inactif';
  if (signal === null) return 'jamais_connecte';
  const age = maintenant - signal;
  if (age <= SEUIL_EN_LIGNE_MS) return 'en_ligne';
  return age <= SEUIL_HORS_LIGNE_MS ? 'en_retard' : 'hors_ligne';
};

/** Statut d'un PDV tel que renvoyé par l'API (hors position temps réel). */
export const statutDuPdv = (pdv: { statut?: string | null; derniere_position_date?: string | null; derniere_position_recue_at?: string | null }, maintenant = Date.now()) =>
  calculerStatutReel(pdv.statut, dernierSignal(maintenant, pdv.derniere_position_recue_at, pdv.derniere_position_date), maintenant);

export const compterStatuts = (statuts: Iterable<StatutReel>): Record<StatutReel, number> => {
  const c = Object.fromEntries(ORDRE_STATUTS.map((s) => [s, 0])) as Record<StatutReel, number>;
  for (const s of statuts) c[s] += 1;
  return c;
};

export const ageLisible = (signal: number | null, maintenant = Date.now()): string => {
  if (signal === null) return 'jamais';
  const s = Math.max(0, Math.round((maintenant - signal) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
};

export const echapperHtml = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Pastille de statut pour les fenêtres d'information (HTML brut Leaflet / Google). */
export const badgeStatutHtml = (statut: StatutReel) =>
  `<span style="display:inline-block;padding:2px 9px;border-radius:4px;background:${STATUTS[statut].couleur};color:#fff;font-weight:700;font-size:12px;">${STATUTS[statut].libelle}</span>`;

/** Icône « tablette » colorée selon le statut (SVG), commune à toutes les cartes. */
export const iconeTabletteSvg = (couleur: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <rect x="1.5" y="1.5" width="33" height="41" rx="6" ry="6" fill="${couleur}" stroke="white" stroke-width="3"/>
    <rect x="11" y="7" width="14" height="20" rx="1.4" ry="1.4" fill="none" stroke="white" stroke-width="2"/>
    <circle cx="18" cy="30.5" r="0.9" fill="white"/>
  </svg>`;
