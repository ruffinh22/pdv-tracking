const { User } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const userController = {
  async createUser(req, res) {
    try {
      const { nom, prenom, email, mot_de_passe, role, telephone, agence_id } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Le matricule est la clé d'enrôlement mobile : il est normalisé en
      // majuscules pour que l'agent puisse le taper comme il veut sur le
      // terrain, et son unicité est vérifiée ici pour renvoyer un message
      // clair plutôt qu'une erreur de contrainte SQL.
      const matricule = req.body.matricule ? String(req.body.matricule).trim().toUpperCase() : null;
      if (matricule) {
        const matriculeExistant = await User.findOne({ where: { matricule } });
        if (matriculeExistant) {
          return res.status(400).json({ error: 'Ce matricule est déjà attribué à un autre agent' });
        }
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      const user = await User.create({
        nom,
        prenom,
        email,
        mot_de_passe: hashedPassword,
        role,
        telephone,
        matricule,
        agence_id: agence_id || null
      });

      logger.info(`Nouvel utilisateur créé: ${email}`);
      res.status(201).json({
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        matricule: user.matricule,
        statut: user.statut
      });
    } catch (error) {
      logger.error('Erreur lors de la création de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllUsers(req, res) {
    try {
      const { role } = req.query;
      const isDropdownMode = req.query.all === 'true';
      const requester = req.user || {};
      const ROLES_TAGGING = ['admin', 'superviseur', 'chef_zone', 'agence', 'commercial'];

      // La liste paginée complète (page "Utilisateurs") est réservée à l'admin.
      if (!isDropdownMode && requester.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      // Le mode "dropdown" (listes déroulantes de tagging PDV : Commercial /
      // Superviseur / Chef de zone) reste ouvert aux rôles qui taguent des PDV.
      if (isDropdownMode && !ROLES_TAGGING.includes(requester.role)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const where = {};
      if (role) {
        where.role = role;
      }

      // Mode complet pour alimenter les listes déroulantes (formulaire de tagging PDV)
      if (isDropdownMode) {
        const users = await User.findAll({
          where: { ...where, statut: 'actif' },
          attributes: { exclude: ['mot_de_passe'] },
          order: [['prenom', 'ASC'], ['nom', 'ASC']]
        });
        return res.json(users);
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        where,
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

      // Même normalisation qu'à la création : le matricule saisi sur le mobile
      // est comparé en majuscules, il doit donc être stocké ainsi.
      if (req.body.matricule !== undefined) {
        const matricule = req.body.matricule ? String(req.body.matricule).trim().toUpperCase() : null;
        if (matricule) {
          const doublon = await User.findOne({ where: { matricule } });
          if (doublon && doublon.id !== user.id) {
            return res.status(400).json({ error: 'Ce matricule est déjà attribué à un autre agent' });
          }
        }
        req.body.matricule = matricule;
      }

      await user.update(req.body);
      res.json({
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        matricule: user.matricule,
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