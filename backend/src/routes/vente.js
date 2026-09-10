const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const venteController = require('../controllers/venteController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const createVenteValidation = [
  body('pdv_id').isInt().withMessage('ID PDV invalide'),
  body('produit').notEmpty().withMessage('Le produit est requis'),
  body('nom_concessionnaire').notEmpty().withMessage('Le nom du concessionnaire est requis'),
  body('nom_vendeur').notEmpty().withMessage('Le nom du vendeur est requis'),
  body('contact_vendeur').notEmpty().withMessage('Le contact du vendeur est requis'),
  body('latitude_saisie').isFloat().withMessage('Latitude invalide'),
  body('longitude_saisie').isFloat().withMessage('Longitude invalide')
];

// Routes publiques pour l'application mobile
router.post('/mobile/create', venteController.mobileCreateVente);

// Routes protégées (require auth)
router.post('/', authMiddleware, createVenteValidation, venteController.createVente);
router.get('/', authMiddleware, venteController.getAllVentes);
router.get('/:id', authMiddleware, venteController.getVenteById);
router.put('/:id', authMiddleware, venteController.updateVente);
router.delete('/:id', authMiddleware, venteController.deleteVente);
router.post('/batch', authMiddleware, venteController.createBatchVentes);

module.exports = router;
