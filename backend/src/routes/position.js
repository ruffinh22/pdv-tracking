const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const positionController = require('../controllers/positionController');
const authMiddleware = require('../middleware/authMiddleware');
const mobilePositionAuth = require('../middleware/mobilePositionAuth');

const mobilePositionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => `pdv-${req.mobilePdvId}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de positions reçues pour ce terminal. Réessayez plus tard.' },
});

// Validation middleware
const createPositionValidation = [
  body('pdv_id').isInt().withMessage('ID PDV invalide'),
  body('latitude').isFloat().withMessage('Latitude invalide'),
  body('longitude').isFloat().withMessage('Longitude invalide')
];

// Routes publiques pour l'application mobile
router.post('/mobile/create', mobilePositionAuth, mobilePositionLimiter, positionController.mobileCreatePosition);
router.post('/mobile/batch', mobilePositionAuth, mobilePositionLimiter, positionController.mobileCreatePositionsBatch);

// Routes protégées (require auth)
router.post('/', authMiddleware, createPositionValidation, positionController.createPosition);
router.get('/', authMiddleware, positionController.getAllPositions);
router.get('/:id', authMiddleware, positionController.getPositionById);
router.get('/pdv/:pdvId', authMiddleware, positionController.getPositionsByPDV);
router.post('/batch', authMiddleware, positionController.createBatchPositions);

module.exports = router;
