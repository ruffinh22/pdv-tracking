/** Libellés institutionnels partagés (mêmes termes partout dans l'application). */
const TYPES_ALERTE: Record<string, string> = {
  sortie_zone: 'Sortie de zone',
  deplacement: 'Déplacement anormal',
  hors_zone: 'Hors zone',
};

export function libelleTypeAlerte(type: string): string {
  return TYPES_ALERTE[type] ?? type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
