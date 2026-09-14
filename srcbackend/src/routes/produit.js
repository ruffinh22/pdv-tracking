const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const produitController = require('../controllers/produitController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

// Validation middleware
const createProduitValidation = [
  body('nom_produit').notEmpty().withMessage('Le nom du produit est requis'),
  body('nom_produit').isLength({ max: 200 }).withMessage('Le nom ne peut pas dépasser 200 caractères')
];

// Routes publiques pour l'application mobile et le web
router.get('/list', produitController.getAllProduits);
router.get('/', produitController.getAllProduits);

// Routes protégées (require auth) — le catalogue produit (page "Produits")
// est en lecture libre pour tout authentifié, mais sa gestion (création,
// modification, désactivation) est réservée à l'administrateur.
router.post('/', authMiddleware, roleMiddleware(['admin']), createProduitValidation, produitController.createProduit);
router.get('/:id', authMiddleware, produitController.getProduitById);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), produitController.updateProduit);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), produitController.deleteProduit);

module.exports = router;