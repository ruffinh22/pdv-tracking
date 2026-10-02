/** Affiche l'ID métier du PDV, avec repli compatible pour les anciens caches mobiles. */
export function formatIdUniquePdv(
  idUnique?: string | null,
  pdvId?: number | string | null
): string {
  if (idUnique?.trim()) return idUnique;
  const numericId = Number(pdvId);
  if (!Number.isInteger(numericId) || numericId <= 0) return 'Non associé';
  return `CI-PDV-${String(numericId).padStart(4, '0')}`;
}