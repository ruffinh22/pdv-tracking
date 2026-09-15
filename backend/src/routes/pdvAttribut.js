const express = require('express');
const router = express.Router();
const pdvAttributController = require('../controllers/pdvAttributController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

// Lecture ouverte à tous les rôles authentifiés : le formulaire de complétion
// du dossier PDV (utilisé par les agents commerciaux) a besoin de connaître la
// liste des champs à afficher.
router.get('/', authMiddleware, pdvAttributController.getAll);
router.get('/:id', authMiddleware, pdvAttributController.getById);

// L'administration du schéma (quels champs existent) est réservée à l'admin.
router.post('/', authMiddleware, roleMiddleware(['admin']), pdvAttributController.create);
router.put('/reorder', authMiddleware, roleMiddleware(['admin']), pdvAttributController.reorder);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), pdvAttributController.update);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), pdvAttributController.remove);

module.exports = router;
