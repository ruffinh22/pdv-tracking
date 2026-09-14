const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const positionController = require('../controllers/positionController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const createPositionValidation = [
  body('pdv_id').isInt().withMessage('ID PDV invalide'),
  body('latitude').isFloat().withMessage('Latitude invalide'),
  body('longitude').isFloat().withMessage('Longitude invalide')
];

// Routes publiques pour l'application mobile
router.post('/mobile/create', positionController.mobileCreatePosition);

// Routes protégées (require auth)
router.post('/', authMiddleware, createPositionValidation, positionController.createPosition);
router.get('/', authMiddleware, positionController.getAllPositions);
router.get('/:id', authMiddleware, positionController.getPositionById);
router.get('/pdv/:pdvId', authMiddleware, positionController.getPositionsByPDV);
router.post('/batch', authMiddleware, positionController.createBatchPositions);

module.exports = router;
