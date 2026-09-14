const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const authController = {
  async register(req, res) {
    try {
      const { nom, prenom, email, mot_de_passe, role } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      // Créer l'utilisateur
      const user = await User.create({
        nom,
        prenom,
        email,
        mot_de_passe: hashedPassword,
        role: role || 'commercial'
      });

      logger.info(`Nouvel utilisateur créé: ${email}`);
      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: {
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Erreur lors de l\'inscription:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async login(req, res) {
    try {
      const { email, mot_de_passe } = req.body;

      // Trouver l'utilisateur
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier le mot de passe
      const isValidPassword = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier le statut
      if (user.statut !== 'actif') {
        return res.status(403).json({ error: 'Compte désactivé' });
      }

      // Générer les tokens
      // Le rôle ET l'agence_id (pour les comptes de rôle 'agence') voyagent dans le
      // token : c'est sur cette base que le middleware de portée des données
      // (voir utils/scope.js) restreint ce que chaque rôle peut voir/modifier.
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, agence_id: user.agence_id || null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
      );

      logger.info(`Connexion réussie: ${email}`);
      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          role: user.role,
          agence_id: user.agence_id || null
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la connexion:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token requis' });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, agence_id: user.agence_id || null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({ token });
    } catch (error) {
      logger.error('Erreur lors du rafraîchissement du token:', error);
      res.status(401).json({ error: 'Refresh token invalide' });
    }
  },

  async logout(req, res) {
    // Dans une implémentation complète, on pourrait invalider le token dans Redis
    res.json({ message: 'Déconnexion réussie' });
  },

  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.userId, {
        attributes: { exclude: ['mot_de_passe'] }
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = authController;