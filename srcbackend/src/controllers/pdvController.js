const { PDV, Position, Vente, Alerte, Produit, Agence, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const geocodingService = require('../services/geocodingService');
const { pdvScope, withScope, peutAccederAuPDV } = require('../utils/scope');

/**
 * Pour les rôles à périmètre restreint, force automatiquement le champ de
 * hiérarchie correspondant sur le PDV créé/modifié afin qu'un utilisateur ne
 * puisse jamais taguer un PDV en dehors de son propre espace (ex: un
 * commercial ne peut pas s'assigner un PDV à un autre commercial).
 */
function appliquerProprietaire(user, payload) {
  if (!user) return payload;
  if (user.role === 'commercial') return { ...payload, commercial_id: user.userId };
  if (user.role === 'agence') return { ...payload, agence_id: user.agence_id || null };
  if (user.role === 'superviseur') return { ...payload, superviseur_id: user.userId };
  if (user.role === 'chef_zone') return { ...payload, chef_zone_id: user.userId };
  return payload;
}

// Inclusions standard pour renvoyer un PDV complet (hiérarchie + produits tagués)
const INCLUDE_PDV_COMPLET = [
  'zone',
  { model: Agence, as: 'agence' },
  { model: User, as: 'commercial', attributes: ['id', 'nom', 'prenom'] },
  { model: User, as: 'superviseur', attributes: ['id', 'nom', 'prenom'] },
  { model: User, as: 'chefZone', attributes: ['id', 'nom', 'prenom'] },
  { model: Produit, as: 'produits', attributes: ['id', 'nom_produit'], through: { attributes: [] } }
];

/**
 * Associe la liste de produits vendus (choix multiples) à un PDV.
 * `produitsIds` peut être un tableau d'IDs ou de noms de produits.
 */
async function synchroniserProduits(pdv, produitsIds) {
  if (!Array.isArray(produitsIds)) return;

  let ids = produitsIds;
  // Tolère l'envoi de noms de produits plutôt que d'IDs
  if (ids.length > 0 && typeof ids[0] === 'string' && isNaN(Number(ids[0]))) {
    const produits = await Produit.findAll({ where: { nom_produit: ids } });
    ids = produits.map(p => p.id);
  }

  await pdv.setProduits(ids);
}

/**
 * Complète automatiquement pays/ville/commune/quartier par géocodage inverse
 * lorsque ces champs ne sont pas fournis explicitement.
 */
async function completerLocalisation(payload) {
  if (payload.pays || payload.ville) {
    return payload; // Renseigné manuellement, on ne l'écrase pas
  }
  if (!payload.latitude_creation || !payload.longitude_creation) {
    return payload;
  }
  try {
    const info = await geocodingService.reverseGeocode(payload.latitude_creation, payload.longitude_creation);
    return {
      ...payload,
      pays: info.pays || payload.pays,
      ville: info.ville || payload.ville,
      commune: info.commune || payload.commune,
      quartier: info.quartier || payload.quartier
    };
  } catch (error) {
    logger.error('Géocodage automatique du PDV impossible:', error);
    return payload;
  }
}

const pdvController = {
  // Routes mobiles sans auth
  /**
   * Upsert en un seul aller-retour réseau : évite le pattern "login qui échoue
   * puis register" qui coûtait 2 requêtes séquentielles à chaque création de
   * compte (le principal facteur de lenteur perçue à l'onboarding). Renvoie le
   * PDV existant s'il y en a un pour ce msisdn, sinon en crée un nouveau.
   */
  async mobileUpsert(req, res) {
    try {
      const { nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, device_info } = req.body;

      if (!msisdn_responsable) {
        return res.status(400).json({ error: 'msisdn_responsable requis' });
      }

      const existingPDV = await PDV.findOne({ where: { msisdn_responsable } });
      if (existingPDV) {
        return res.json({ ...existingPDV.toJSON(), _existing: true });
      }

      const payload = await completerLocalisation({
        nom_pdv: nom_pdv || `PDV ${msisdn_responsable}`,
        msisdn_responsable,
        latitude_creation,
        longitude_creation,
        statut: 'actif',
        device_info,
        derniere_position_latitude: latitude_creation,
        derniere_position_longitude: longitude_creation,
        derniere_position_date: new Date(),
      });

      const pdv = await PDV.create(payload);
      logger.info(`Nouveau PDV mobile enregistré: ${pdv.nom_pdv} (${msisdn_responsable})`);
      res.status(201).json({ ...pdv.toJSON(), _existing: false });
    } catch (error) {
      logger.error("Erreur lors de l'upsert mobile du PDV:", error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileRegister(req, res) {
    try {
      const { nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, device_info } = req.body;

      // Vérifier si le MSISDN existe déjà
      const existingPDV = await PDV.findOne({ where: { msisdn_responsable } });
      if (existingPDV) {
        return res.status(400).json({ error: 'Ce MSISDN est déjà enregistré' });
      }

      const payload = await completerLocalisation({
        nom_pdv: nom_pdv || `PDV ${msisdn_responsable}`,
        msisdn_responsable,
        latitude_creation,
        longitude_creation,
        statut: 'actif',
        device_info,
        derniere_position_latitude: latitude_creation,
        derniere_position_longitude: longitude_creation,
        derniere_position_date: new Date()
      });

      const pdv = await PDV.create(payload);

      logger.info(`Nouveau PDV mobile enregistré: ${pdv.nom_pdv} (${msisdn_responsable})`);
      res.status(201).json(pdv);
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement mobile du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileLogin(req, res) {
    try {
      const { msisdn } = req.body;

      const pdv = await PDV.findOne({ where: { msisdn_responsable: msisdn } });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }

      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la connexion mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createPDV(req, res) {
    const t = await sequelize.transaction();
    try {
      const { produits_ids, ...pdvData } = req.body;
      const payload = await completerLocalisation(appliquerProprietaire(req.user, pdvData));

      const pdv = await PDV.create(payload, { transaction: t });

      if (produits_ids) {
        await t.commit();
        await synchroniserProduits(pdv, produits_ids);
      } else {
        await t.commit();
      }

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });

      logger.info(`Nouveau PDV créé: ${pdv.nom_pdv}`);
      res.status(201).json(pdvComplet);
    } catch (error) {
      if (!t.finished) await t.rollback();
      logger.error('Erreur lors de la création du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllPDVs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Filtres utilisés notamment par les analyses du dashboard
      const {
        statut, ville, commune, quartier, pays,
        agence_id, commercial_id, superviseur_id, chef_zone_id, produit_id,
        search
      } = req.query;

      const where = {};
      if (statut) where.statut = statut;
      if (ville) where.ville = ville;
      if (commune) where.commune = commune;
      if (quartier) where.quartier = quartier;
      if (pays) where.pays = pays;
      if (agence_id) where.agence_id = agence_id;
      if (commercial_id) where.commercial_id = commercial_id;
      if (superviseur_id) where.superviseur_id = superviseur_id;
      if (chef_zone_id) where.chef_zone_id = chef_zone_id;
      if (search) {
        where[Op.or] = [
          { nom_pdv: { [Op.like]: `%${search}%` } },
          { msisdn_responsable: { [Op.like]: `%${search}%` } },
          { id_terminal: { [Op.like]: `%${search}%` } }
        ];
      }

      // Périmètre de données : chaque rôle ne voit que les PDV de son espace.
      const whereScoped = withScope(where, pdvScope(req.user));

      const include = [...INCLUDE_PDV_COMPLET, 'positions'];
      if (produit_id) {
        include[include.length - 2] = {
          model: Produit,
          as: 'produits',
          attributes: ['id', 'nom_produit'],
          through: { attributes: [] },
          where: { id: produit_id }
        };
      }

      const { count, rows: pdvs } = await PDV.findAndCountAll({
        where: whereScoped,
        include,
        limit,
        offset,
        distinct: true
      });

      res.json({
        data: pdvs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVById(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id, {
        include: [...INCLUDE_PDV_COMPLET, 'positions', 'ventes', 'alertes']
      });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la récupération du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updatePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const { produits_ids, ...pdvData } = req.body;
      await pdv.update(pdvData);

      if (produits_ids) {
        await synchroniserProduits(pdv, produits_ids);
      }

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });
      res.json(pdvComplet);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Met à jour uniquement les produits vendus par un PDV (choix multiples)
  async updatePDVProduits(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const { produits_ids } = req.body;
      if (!Array.isArray(produits_ids)) {
        return res.status(400).json({ error: 'produits_ids doit être un tableau' });
      }

      await synchroniserProduits(pdv, produits_ids);

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });
      res.json(pdvComplet);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour des produits du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deletePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      await pdv.destroy();
      res.json({ message: 'PDV supprimé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVPositions(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const positions = await Position.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(positions);
    } catch (error) {
      logger.error('Erreur lors de la récupération des positions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVVentes(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const ventes = await Vente.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVAlertes(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const alertes = await Alerte.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = pdvController;