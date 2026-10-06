const { Op } = require('sequelize');
const { PDV } = require('../models');
const logger = require('../utils/logger');

/**
 * Réveil à distance des terminaux muets : notification « data-only » (sans
 * affichage) envoyée via le service push d'Expo / FCM. L'app se relance, remet le
 * suivi en route et envoie une position. Sans effet si l'app a été forcée à l'arrêt.
 */
const ACTIF = process.env.REVEIL_ACTIF !== 'false';
const PERIODE_MS = 5 * 60 * 1000;
const SILENCE_MIN_MS = 5 * 60 * 1000;            // muet depuis > 5 min
const INTERVALLE_REVEIL_MS = 15 * 60 * 1000;     // pas plus d'un réveil / 15 min
const INTERVALLE_LONG_MS = 2 * 60 * 60 * 1000;   // / 2 h si muet depuis > 48 h
const SEUIL_LONG_MS = 48 * 60 * 60 * 1000;
const URL_EXPO = 'https://exp.host/--/api/v2/push/send';

async function reveillerTerminauxMuets(maintenant = Date.now()) {
  if (typeof fetch !== 'function') return 0;
  const pdvs = await PDV.findAll({
    where: { statut: 'actif', push_token: { [Op.ne]: null } },
    attributes: ['id', 'push_token', 'derniere_position_date', 'derniere_position_recue_at', 'dernier_reveil_at'],
  });

  const aReveiller = pdvs.filter((p) => {
    const ref = p.derniere_position_recue_at || p.derniere_position_date;
    const silence = ref ? maintenant - new Date(ref).getTime() : Infinity;
    if (silence < SILENCE_MIN_MS) return false;
    const pause = silence > SEUIL_LONG_MS ? INTERVALLE_LONG_MS : INTERVALLE_REVEIL_MS;
    return !p.dernier_reveil_at || maintenant - new Date(p.dernier_reveil_at).getTime() >= pause;
  });
  if (!aReveiller.length) return 0;

  let envoyes = 0;
  for (let i = 0; i < aReveiller.length; i += 100) {
    const lot = aReveiller.slice(i, i + 100);
    try {
      const reponse = await fetch(URL_EXPO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lot.map((p) => ({
          to: p.push_token, data: { type: 'reveil' }, priority: 'high', ttl: 600, _contentAvailable: true,
        }))),
      });
      const { data: tickets = [] } = await reponse.json();
      const invalides = [];
      lot.forEach((p, k) => { if (tickets[k]?.details?.error === 'DeviceNotRegistered') invalides.push(p.id); });
      await PDV.update({ dernier_reveil_at: new Date(maintenant) }, { where: { id: lot.map((p) => p.id) } });
      if (invalides.length) await PDV.update({ push_token: null }, { where: { id: invalides } });
      envoyes += lot.length;
    } catch (error) {
      logger.warn('Réveil des terminaux impossible', { message: error.message });
    }
  }
  logger.info(`Réveil silencieux envoyé à ${envoyes} terminal(aux)`);
  return envoyes;
}

function demarrerReveilPeriodique() {
  if (!ACTIF) return null;
  const minuteur = setInterval(() => reveillerTerminauxMuets().catch((e) => logger.warn(e.message)), PERIODE_MS);
  if (typeof minuteur.unref === 'function') minuteur.unref();
  return minuteur;
}

module.exports = { reveillerTerminauxMuets, demarrerReveilPeriodique };
