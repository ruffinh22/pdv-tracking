const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const loginValidation = [
  body('email').isEmail().withMessage('Email invalide'),
  body('mot_de_passe').notEmpty().withMessage('Le mot de passe est requis')
];

// Routes
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getProfile);

module.exports = router;
