const { User } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const userController = {
  async createUser(req, res) {
    try {
      const { nom, prenom, email, mot_de_passe, role, telephone } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      const user = await User.create({
        nom,
        prenom,
        email,
        mot_de_passe: hashedPassword,
        role,
        telephone
      });

      logger.info(`Nouvel utilisateur créé: ${email}`);
      res.status(201).json({
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        statut: user.statut
      });
    } catch (error) {
      logger.error('Erreur lors de la création de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        attributes: { exclude: ['mot_de_passe'] },
        limit,
        offset
      });

      res.json({
        data: users,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des utilisateurs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getUserById(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: { exclude: ['mot_de_passe'] }
      });
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      res.json(user);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateUser(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Si le mot de passe est fourni, le hasher
      if (req.body.mot_de_passe) {
        req.body.mot_de_passe = await bcrypt.hash(req.body.mot_de_passe, 10);
      }

      await user.update(req.body);
      res.json({
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        statut: user.statut
      });
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deleteUser(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      await user.destroy();
      res.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updateUserStatut(req, res) {
    try {
      const { statut } = req.body;
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      await user.update({ statut });
      res.json({ message: 'Statut mis à jour avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = userController;
