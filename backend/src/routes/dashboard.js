const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController.js');
const authMiddleware = require('../middleware/authMiddleware');

// KPIs généraux (tagging + suivi terrain, plus aucun compteur de ventes)
// Accepte les mêmes filtres optionnels que les autres routes ci-dessous.
router.get('/kpi', authMiddleware, dashboardController.getKPIs);

// Synthèse complète de la page Reporting, en un seul appel
router.get('/reporting', authMiddleware, dashboardController.getReportingSynthese);

// PDV tagués/actifs/inactifs par période + par produit + ratio
// Tous acceptent en plus les filtres optionnels ?commercial_id=&superviseur_id=&chef_zone_id=&agence_id=
router.get('/pdv-stats', authMiddleware, dashboardController.getPDVStats);
router.get('/pdv-par-produit', authMiddleware, dashboardController.getPDVParProduit);
router.get('/ratio-produits', authMiddleware, dashboardController.getRatioProduits);

// Analyses transverses (ville, commune, quartier, agence, commercial, superviseur, chef de zone)
router.get('/analyses', authMiddleware, dashboardController.getAnalyses);

// Intrus (PDV ayant quitté leur zone/position initiale) + export
router.get('/instrus', authMiddleware, dashboardController.getInstrus);
router.get('/instrus/export', authMiddleware, dashboardController.exportInstrusExcel);

router.get('/pdv/actifs', authMiddleware, dashboardController.getPDVActifs);
router.get('/alertes/actives', authMiddleware, dashboardController.getAlertesActives);
router.get('/couverture', authMiddleware, dashboardController.getCouvertureGeographique);
router.get('/export/excel', authMiddleware, dashboardController.exportExcel);

module.exports = router;
