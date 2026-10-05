'use strict';

const SEUIL_EN_LIGNE_MS = 2 * 60 * 1000;
const SEUIL_HORS_LIGNE_MS = 48 * 60 * 60 * 1000;

function calculerEtatSuivi(dernierePositionDate, maintenant = Date.now()) {
  if (!dernierePositionDate) return 'jamais_connecte';

  const horodatage = new Date(dernierePositionDate).getTime();
  if (!Number.isFinite(horodatage)) return 'jamais_connecte';

  const age = maintenant - horodatage;
  if (age <= SEUIL_EN_LIGNE_MS) return 'en_ligne';
  if (age <= SEUIL_HORS_LIGNE_MS) return 'en_retard';
  return 'hors_ligne';
}

module.exports = {
  calculerEtatSuivi,
  SEUIL_EN_LIGNE_MS,
  SEUIL_HORS_LIGNE_MS,
};