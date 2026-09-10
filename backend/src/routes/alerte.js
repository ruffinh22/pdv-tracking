const express = require('express');
const router = express.Router();
const alerteController = require('../controllers/alerteController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes
router.get('/', authMiddleware, alerteController.getAllAlertes);
router.get('/:id', authMiddleware, alerteController.getAlerteById);
router.put('/:id/traiter', authMiddleware, alerteController.traiterAlerte);
router.get('/pdv/:pdvId', authMiddleware, alerteController.getAlertesByPDV);
router.get('/zone/:zoneId', authMiddleware, alerteController.getAlertesByZone);
router.get('/statistiques/periode', authMiddleware, alerteController.getStatistiquesPeriode);

module.exports = router;
