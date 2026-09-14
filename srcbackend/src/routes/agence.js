const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const agenceController = require('../controllers/agenceController.js');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

const createAgenceValidation = [
  body('nom_agence').notEmpty().withMessage('Le nom de l\'agence est requis')
];

// La gestion du référentiel des agences (page "Agences") est réservée à
// l'administrateur. La lecture reste ouverte à tous les authentifiés : la
// liste paginée est filtrée dans le contrôleur (getAllAgences), et le mode
// "dropdown" (?all=true) alimente le tagging PDV pour les rôles habilités.
router.post('/', authMiddleware, roleMiddleware(['admin']), createAgenceValidation, agenceController.createAgence);
router.get('/', authMiddleware, agenceController.getAllAgences);
router.get('/:id', authMiddleware, agenceController.getAgenceById);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), agenceController.updateAgence);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), agenceController.deleteAgence);

module.exports = router;