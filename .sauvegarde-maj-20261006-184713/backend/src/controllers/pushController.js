const { PDV } = require('../models');
const logger = require('../utils/logger');

/** Le terminal enregistre (ou renouvelle) son jeton de notification. */
exports.enregistrerPushToken = async (req, res) => {
  try {
    const token = String(req.body?.push_token || '').trim();
    if (!/^(Expo|Exponent)PushToken\[[\w-]+\]$/.test(token)) {
      return res.status(400).json({ error: 'Jeton de notification invalide' });
    }
    await PDV.update({ push_token: token }, { where: { id: req.mobilePdvId } });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('Enregistrement du jeton push impossible', { message: error.message });
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
