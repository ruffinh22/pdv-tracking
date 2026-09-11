const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const agenceController = require('../controllers/agenceController');
const authMiddleware = require('../middleware/authMiddleware');

const createAgenceValidation = [
  body('nom_agence').notEmpty().withMessage('Le nom de l\'agence est requis')
];

router.post('/', authMiddleware, createAgenceValidation, agenceController.createAgence);
router.get('/', authMiddleware, agenceController.getAllAgences);
router.get('/:id', authMiddleware, agenceController.getAgenceById);
router.put('/:id', authMiddleware, agenceController.updateAgence);
router.delete('/:id', authMiddleware, agenceController.deleteAgence);

module.exports = router;
