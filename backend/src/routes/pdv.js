const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const pdvController = require('../controllers/pdvController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const createPDVValidation = [
  body('nom_pdv').notEmpty().withMessage('Le nom du PDV est requis'),
  body('msisdn_responsable').notEmpty().withMessage('Le MSISDN est requis'),
  body('latitude_creation').isFloat().withMessage('Latitude invalide'),
  body('longitude_creation').isFloat().withMessage('Longitude invalide')
];

// Routes publiques pour l'application mobile
router.post('/mobile/register', pdvController.mobileRegister);
router.post('/mobile/login', pdvController.mobileLogin);

// Routes protégées (require auth)
router.post('/', authMiddleware, createPDVValidation, pdvController.createPDV);
router.get('/', authMiddleware, pdvController.getAllPDVs);
router.get('/:id', authMiddleware, pdvController.getPDVById);
router.put('/:id', authMiddleware, pdvController.updatePDV);
router.put('/:id/produits', authMiddleware, pdvController.updatePDVProduits);
router.delete('/:id', authMiddleware, pdvController.deletePDV);
router.get('/:id/positions', authMiddleware, pdvController.getPDVPositions);
router.get('/:id/ventes', authMiddleware, pdvController.getPDVVentes);
router.get('/:id/alertes', authMiddleware, pdvController.getPDVAlertes);

module.exports = router;
