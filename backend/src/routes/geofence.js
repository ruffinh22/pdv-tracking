const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const geofenceController = require('../controllers/geofenceController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const createZoneValidation = [
  body('nom_zone').notEmpty().withMessage('Le nom de la zone est requis'),
  body('type').isIn(['cercle', 'polygone']).withMessage('Type de zone invalide'),
  body('coordonnees').notEmpty().withMessage('Les coordonnées sont requises')
];

// Routes
router.post('/', authMiddleware, createZoneValidation, geofenceController.createZone);
router.get('/', authMiddleware, geofenceController.getAllZones);
router.get('/:id', authMiddleware, geofenceController.getZoneById);
router.put('/:id', authMiddleware, geofenceController.updateZone);
router.delete('/:id', authMiddleware, geofenceController.deleteZone);
router.post('/:id/assign-pdv', authMiddleware, geofenceController.assignPDVToZone);
router.delete('/:id/remove-pdv/:pdvId', authMiddleware, geofenceController.removePDVFromZone);
router.post('/check-position', authMiddleware, geofenceController.checkPositionInZone);

module.exports = router;
