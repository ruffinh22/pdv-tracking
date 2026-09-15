const { Op } = require('sequelize');
const { Position } = require('../models');
const logger = require('../utils/logger');

/**
 * Rétention de l'historique de positions.
 *
 * Le tracking écrit un point toutes les 30 secondes par terminal, soit environ
 * 1 million de lignes par an et par PDV. Sans purge, la table `positions`
 * devient le goulot d'étranglement de toute la plateforme (carte de suivi,
 * reporting, sauvegardes) en quelques mois. On conserve donc une fenêtre
 * glissante, configurable via POSITIONS_RETENTION_JOURS.
 *
 * La suppression se fait par lots : un DELETE massif sur plusieurs millions de
 * lignes verrouille la table et bloque les écritures du tracking en cours.
 */
const RETENTION_JOURS = parseInt(process.env.POSITIONS_RETENTION_JOURS, 10) || 90;
const TAILLE_LOT = 5000;
const INTERVALLE_MS = 24 * 60 * 60 * 1000;

async function purgerAnciennesPositions(retentionJours = RETENTION_JOURS) {
  // 0 ou une valeur négative désactive la purge : utile pour les déploiements
  // soumis à une obligation de conservation longue.
  if (!retentionJours || retentionJours <= 0) return 0;

  const seuil = new Date(Date.now() - retentionJours * 24 * 60 * 60 * 1000);
  let totalSupprime = 0;

  try {
    let supprimeDansLeLot;
    do {
      supprimeDansLeLot = await Position.destroy({
        where: { horodatage: { [Op.lt]: seuil } },
        limit: TAILLE_LOT
      });
      totalSupprime += supprimeDansLeLot;
    } while (supprimeDansLeLot === TAILLE_LOT);

    if (totalSupprime > 0) {
      logger.info(
        `Purge des positions: ${totalSupprime} ligne(s) antérieure(s) au ${seuil.toISOString()} supprimée(s)`
      );
    }
  } catch (error) {
    // Une purge qui échoue ne doit jamais interrompre le service : elle sera
    // retentée au cycle suivant.
    logger.error('Erreur lors de la purge des positions:', error);
  }

  return totalSupprime;
}

/** Démarre la purge quotidienne. Le premier passage est différé de 5 minutes
 *  pour ne pas concurrencer le démarrage du serveur. */
function demarrerPurgePeriodique() {
  if (RETENTION_JOURS <= 0) {
    logger.info('Purge des positions désactivée (POSITIONS_RETENTION_JOURS <= 0)');
    return null;
  }

  logger.info(`Purge des positions activée — rétention de ${RETENTION_JOURS} jours`);
  setTimeout(() => purgerAnciennesPositions(), 5 * 60 * 1000);

  const minuteur = setInterval(() => purgerAnciennesPositions(), INTERVALLE_MS);
  // `unref` évite que ce minuteur maintienne le process en vie tout seul.
  if (typeof minuteur.unref === 'function') minuteur.unref();
  return minuteur;
}

module.exports = { purgerAnciennesPositions, demarrerPurgePeriodique, RETENTION_JOURS };
