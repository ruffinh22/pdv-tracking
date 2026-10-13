export type EtatSuivi = 'en_ligne' | 'en_retard' | 'hors_ligne' | 'jamais_connecte';

export const SEUIL_EN_LIGNE_MS = 2 * 60 * 1000;
export const SEUIL_HORS_LIGNE_MS = 48 * 60 * 60 * 1000;

export function calculerEtatSuivi(
  dernierePositionDate?: string | Date | null,
  maintenant = Date.now()
): EtatSuivi {
  if (!dernierePositionDate) return 'jamais_connecte';
  const horodatage = new Date(dernierePositionDate).getTime();
  if (!Number.isFinite(horodatage)) return 'jamais_connecte';

  const age = maintenant - horodatage;
  if (age <= SEUIL_EN_LIGNE_MS) return 'en_ligne';
  if (age <= SEUIL_HORS_LIGNE_MS) return 'en_retard';
  return 'hors_ligne';
}

export const LIBELLE_ETAT_SUIVI: Record<EtatSuivi, string> = {
  en_ligne: 'En ligne',
  en_retard: 'Position en retard',
  hors_ligne: 'Hors ligne',
  jamais_connecte: 'Jamais connecté',
};

export const CLASSE_ETAT_SUIVI: Record<EtatSuivi, string> = {
  en_ligne: 'badge badge-success',
  en_retard: 'badge badge-warning',
  hors_ligne: 'badge badge-neutral',
  jamais_connecte: 'badge badge-neutral',
};