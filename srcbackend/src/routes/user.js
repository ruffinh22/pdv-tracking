const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = authMiddleware;

// Validation middleware
const createUserValidation = [
  body('nom').notEmpty().withMessage('Le nom est requis'),
  body('prenom').notEmpty().withMessage('Le prénom est requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('mot_de_passe').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('role').isIn(['admin', 'superviseur', 'commercial', 'chef_zone', 'agence']).withMessage('Rôle invalide')
];

// La gestion des comptes utilisateurs (page "Utilisateurs") est réservée à
// l'administrateur. Le seul accès accordé aux autres rôles habilités à taguer
// un PDV est la liste en mode "dropdown" (?all=true), filtrée dans le
// contrôleur — voir userController.getAllUsers.
router.post('/', authMiddleware, roleMiddleware(['admin']), createUserValidation, userController.createUser);
router.get('/', authMiddleware, userController.getAllUsers);
router.get('/:id', authMiddleware, roleMiddleware(['admin']), userController.getUserById);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), userController.updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), userController.deleteUser);
router.put('/:id/statut', authMiddleware, roleMiddleware(['admin']), userController.updateUserStatut);

module.exports = router;