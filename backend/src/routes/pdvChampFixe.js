const express = require('express');
const router = express.Router();
const pdvChampFixeController = require('../controllers/pdvChampFixeController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

// Lecture ouverte à tous les rôles authentifiés : le formulaire de complétion
// (utilisé par les agents commerciaux) a besoin de savoir quels champs
// afficher et lesquels sont obligatoires, pas seulement l'admin.
router.get('/', authMiddleware, pdvChampFixeController.getAll);

// Pas de POST ni de DELETE ici : contrairement aux attributs personnalisés,
// la liste des champs fixes est câblée dans le code (voir la migration de
// seed) — chaque ligne correspond à une colonne réelle ou une relation.
router.put('/:code', authMiddleware, roleMiddleware(['admin']), pdvChampFixeController.update);

module.exports = router;
