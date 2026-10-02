const jwt = require('jsonwebtoken');
const { PDV } = require('../models');

module.exports = async function mobilePositionAuth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Jeton du terminal manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'mobile-position' || !decoded.pdvId || !decoded.terminalId) {
      return res.status(401).json({ error: 'Jeton du terminal invalide' });
    }
    if (Number(req.body?.pdv_id) !== Number(decoded.pdvId)) {
      return res.status(403).json({ error: 'Ce terminal ne peut pas envoyer la position de ce PDV' });
    }

    const pdv = await PDV.findOne({
      where: { id: decoded.pdvId, id_terminal: decoded.terminalId },
      attributes: ['id'],
    });
    if (!pdv) return res.status(401).json({ error: 'Association terminal-PDV révoquée' });

    req.mobilePdvId = Number(decoded.pdvId);
    next();
  } catch {
    return res.status(401).json({ error: 'Jeton du terminal invalide ou expiré' });
  }
};