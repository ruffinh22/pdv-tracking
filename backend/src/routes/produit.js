const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const produitController = require('../controllers/produitController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const createProduitValidation = [
  body('nom_produit').notEmpty().withMessage('Le nom du produit est requis'),
  body('nom_produit').isLength({ max: 200 }).withMessage('Le nom ne peut pas dépasser 200 caractères')
];

// Routes publiques pour l'application mobile et le web
router.get('/list', produitController.getAllProduits);
router.get('/', produitController.getAllProduits);

// Routes protégées (require auth)
router.post('/', authMiddleware, createProduitValidation, produitController.createProduit);
router.get('/:id', authMiddleware, produitController.getProduitById);
router.put('/:id', authMiddleware, produitController.updateProduit);
router.delete('/:id', authMiddleware, produitController.deleteProduit);

module.exports = router;