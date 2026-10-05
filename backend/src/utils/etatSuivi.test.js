const { calculerEtatSuivi, SEUIL_EN_LIGNE_MS, SEUIL_HORS_LIGNE_MS } = require('./etatSuivi');

describe('calculerEtatSuivi', () => {
  const maintenant = Date.parse('2026-10-05T12:00:00.000Z');

  it('distingue une position récente', () => {
    expect(calculerEtatSuivi(maintenant - SEUIL_EN_LIGNE_MS, maintenant)).toBe('en_ligne');
  });

  it('signale un retard avant le seuil hors ligne', () => {
    expect(calculerEtatSuivi(maintenant - SEUIL_EN_LIGNE_MS - 1, maintenant)).toBe('en_retard');
    expect(calculerEtatSuivi(maintenant - SEUIL_HORS_LIGNE_MS, maintenant)).toBe('en_retard');
  });

  it('signale hors ligne au-delà de 48 heures', () => {
    expect(calculerEtatSuivi(maintenant - SEUIL_HORS_LIGNE_MS - 1, maintenant)).toBe('hors_ligne');
  });

  it('distingue un terminal sans historique valide', () => {
    expect(calculerEtatSuivi(null, maintenant)).toBe('jamais_connecte');
    expect(calculerEtatSuivi('date invalide', maintenant)).toBe('jamais_connecte');
  });
});