const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const geofenceController = require('../controllers/geofenceController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

// Validation middleware
const createZoneValidation = [
  body('nom_zone').notEmpty().withMessage('Le nom de la zone est requis'),
  body('type').isIn(['cercle', 'polygone']).withMessage('Type de zone invalide'),
  body('coordonnees').notEmpty().withMessage('Les coordonnées sont requises')
];

// La lecture des zones reste ouverte à tout authentifié (utile pour situer un
// PDV sur la carte quel que soit le rôle) ; leur gestion (page "Zones
// Geofence") est réservée à l'administrateur.
router.post('/', authMiddleware, roleMiddleware(['admin']), createZoneValidation, geofenceController.createZone);
router.get('/', authMiddleware, geofenceController.getAllZones);
router.get('/:id', authMiddleware, geofenceController.getZoneById);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), geofenceController.updateZone);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), geofenceController.deleteZone);
router.post('/:id/assign-pdv', authMiddleware, roleMiddleware(['admin']), geofenceController.assignPDVToZone);
router.delete('/:id/remove-pdv/:pdvId', authMiddleware, roleMiddleware(['admin']), geofenceController.removePDVFromZone);
router.post('/check-position', authMiddleware, geofenceController.checkPositionInZone);

module.exports = router;