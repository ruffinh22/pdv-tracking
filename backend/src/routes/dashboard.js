const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// KPIs généraux
router.get('/kpi', authMiddleware, dashboardController.getKPIs);

// Point 5 : PDV tagués/actifs/inactifs par période + par produit + ratio
router.get('/pdv-stats', authMiddleware, dashboardController.getPDVStats);
router.get('/pdv-par-produit', authMiddleware, dashboardController.getPDVParProduit);
router.get('/ratio-produits', authMiddleware, dashboardController.getRatioProduits);

// Point 3 : analyses transverses (ville, commune, quartier, agence, commercial, superviseur, chef de zone)
router.get('/analyses', authMiddleware, dashboardController.getAnalyses);

// Point 6 : instrus (PDV ayant quitté leur zone/position initiale) + export
router.get('/instrus', authMiddleware, dashboardController.getInstrus);
router.get('/instrus/export', authMiddleware, dashboardController.exportInstrusExcel);

// Ventes
router.get('/ventes/periode', authMiddleware, dashboardController.getVentesPeriode);
router.get('/ventes/produit', authMiddleware, dashboardController.getVentesParProduit);
router.get('/ventes/zone', authMiddleware, dashboardController.getVentesParZone);

router.get('/pdv/actifs', authMiddleware, dashboardController.getPDVActifs);
router.get('/alertes/actives', authMiddleware, dashboardController.getAlertesActives);
router.get('/couverture', authMiddleware, dashboardController.getCouvertureGeographique);
router.get('/export/excel', authMiddleware, dashboardController.exportExcel);

module.exports = router;
