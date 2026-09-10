const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes
router.get('/kpi', authMiddleware, dashboardController.getKPIs);
router.get('/ventes/periode', authMiddleware, dashboardController.getVentesPeriode);
router.get('/ventes/produit', authMiddleware, dashboardController.getVentesParProduit);
router.get('/ventes/zone', authMiddleware, dashboardController.getVentesParZone);
router.get('/pdv/actifs', authMiddleware, dashboardController.getPDVActifs);
router.get('/alertes/actives', authMiddleware, dashboardController.getAlertesActives);
router.get('/couverture', authMiddleware, dashboardController.getCouvertureGeographique);
router.get('/export/excel', authMiddleware, dashboardController.exportExcel);

module.exports = router;
