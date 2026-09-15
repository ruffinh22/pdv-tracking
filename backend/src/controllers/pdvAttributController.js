const { PdvAttribut, PdvAttributValeur } = require('../models');
const logger = require('../utils/logger');

const TYPES_AVEC_OPTIONS = ['liste', 'liste_multiple'];

/** Normalise un libellé en code technique (slug) : "Type de local" -> "type_de_local". */
function slugifier(texte) {
  return String(texte)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const pdvAttributController = {
  /**
   * Liste des attributs. `?actif=true` ne renvoie que ceux à afficher dans le
   * formulaire de complétion — c'est le mode utilisé par les agents
   * commerciaux ; l'admin, lui, appelle sans filtre pour voir aussi les
   * attributs désactivés qu'il peut réactiver.
   */
  async getAll(req, res) {
    try {
      const where = {};
      if (req.query.actif === 'true') where.actif = true;
      if (req.query.actif === 'false') where.actif = false;

      const attributs = await PdvAttribut.findAll({
        where,
        order: [['ordre', 'ASC'], ['id', 'ASC']]
      });
      res.json(attributs);
    } catch (error) {
      logger.error('Erreur lors de la récupération des attributs PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getById(req, res) {
    try {
      const attribut = await PdvAttribut.findByPk(req.params.id);
      if (!attribut) return res.status(404).json({ error: 'Attribut non trouvé' });
      res.json(attribut);
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'attribut PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async create(req, res) {
    try {
      const { libelle, type, options, obligatoire, groupe, aide, ordre, actif } = req.body;
      if (!libelle) {
        return res.status(400).json({ error: 'Le libellé est requis' });
      }

      // Le code est dérivé du libellé plutôt que saisi : un champ technique de
      // moins à remplir pour l'admin, et on évite les codes incohérents.
      const code = req.body.code ? slugifier(req.body.code) : slugifier(libelle);
      if (!code) {
        return res.status(400).json({ error: 'Le libellé ne permet pas de générer un code valide' });
      }

      const existant = await PdvAttribut.findOne({ where: { code } });
      if (existant) {
        return res.status(400).json({ error: `Un attribut avec le code "${code}" existe déjà` });
      }

      if (TYPES_AVEC_OPTIONS.includes(type) && (!Array.isArray(options) || options.length === 0)) {
        return res.status(400).json({ error: 'Au moins une option est requise pour ce type de champ' });
      }

      const attribut = await PdvAttribut.create({
        code,
        libelle,
        type: type || 'texte',
        options: TYPES_AVEC_OPTIONS.includes(type) ? options : null,
        obligatoire: !!obligatoire,
        groupe: groupe || 'Informations complémentaires',
        aide: aide || null,
        ordre: Number.isFinite(Number(ordre)) ? Number(ordre) : 0,
        actif: actif === undefined ? true : !!actif
      });

      logger.info(`Nouvel attribut PDV créé: ${attribut.code}`);
      res.status(201).json(attribut);
    } catch (error) {
      logger.error('Erreur lors de la création de l\'attribut PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async update(req, res) {
    try {
      const attribut = await PdvAttribut.findByPk(req.params.id);
      if (!attribut) return res.status(404).json({ error: 'Attribut non trouvé' });

      const { libelle, type, options, obligatoire, groupe, aide, ordre, actif } = req.body;

      if (TYPES_AVEC_OPTIONS.includes(type) && (!Array.isArray(options) || options.length === 0)) {
        return res.status(400).json({ error: 'Au moins une option est requise pour ce type de champ' });
      }

      // Le `code` n'est volontairement pas modifiable : c'est la clé à laquelle
      // les valeurs déjà saisies sont rattachées côté API et formulaire.
      await attribut.update({
        libelle: libelle ?? attribut.libelle,
        type: type ?? attribut.type,
        options: TYPES_AVEC_OPTIONS.includes(type ?? attribut.type) ? options ?? attribut.options : null,
        obligatoire: obligatoire === undefined ? attribut.obligatoire : !!obligatoire,
        groupe: groupe ?? attribut.groupe,
        aide: aide === undefined ? attribut.aide : aide,
        ordre: ordre === undefined ? attribut.ordre : Number(ordre),
        actif: actif === undefined ? attribut.actif : !!actif
      });

      res.json(attribut);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'attribut PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Suppression définitive : elle emporte toutes les valeurs saisies sur les
   * PDV. Le nombre de PDV impactés est renvoyé pour que l'interface puisse
   * afficher une confirmation informée. Pour retirer un champ du formulaire
   * sans rien perdre, préférer `actif: false` via update.
   */
  async remove(req, res) {
    try {
      const attribut = await PdvAttribut.findByPk(req.params.id);
      if (!attribut) return res.status(404).json({ error: 'Attribut non trouvé' });

      const valeursSupprimees = await PdvAttributValeur.destroy({ where: { attribut_id: attribut.id } });
      await attribut.destroy();

      logger.info(`Attribut PDV supprimé: ${attribut.code} (${valeursSupprimees} valeur(s))`);
      res.json({ message: 'Attribut supprimé avec succès', valeurs_supprimees: valeursSupprimees });
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'attribut PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /** Réordonne les attributs en un seul appel (drag & drop côté admin). */
  async reorder(req, res) {
    try {
      const { ordres } = req.body; // [{ id, ordre }]
      if (!Array.isArray(ordres)) {
        return res.status(400).json({ error: 'ordres doit être un tableau [{ id, ordre }]' });
      }
      await Promise.all(
        ordres.map(({ id, ordre }) => PdvAttribut.update({ ordre: Number(ordre) }, { where: { id } }))
      );
      const attributs = await PdvAttribut.findAll({ order: [['ordre', 'ASC'], ['id', 'ASC']] });
      res.json(attributs);
    } catch (error) {
      logger.error('Erreur lors du réordonnancement des attributs PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = pdvAttributController;
