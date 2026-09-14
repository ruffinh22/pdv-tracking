const { Op } = require('sequelize');

/**
 * Portée des données par rôle (du plus large au plus étroit) :
 *
 *   admin        -> aucune restriction, toute la base
 *   chef_zone    -> les PDV de sa zone            (PDV.chef_zone_id  = userId)
 *   superviseur  -> les PDV de son équipe         (PDV.superviseur_id = userId)
 *   agence       -> les PDV de son agence         (PDV.agence_id     = agence_id du compte)
 *   commercial   -> ses propres PDV               (PDV.commercial_id = userId)
 *
 * Toutes les entités qui dépendent d'un PDV (Vente, Position, Alerte) héritent
 * de la même portée via une jointure sur PDV.
 */

const ROLES_GLOBAUX = ['admin'];

/**
 * Condition Sequelize (colonnes de la table `pdv`) représentant le périmètre
 * de données de l'utilisateur connecté. Un objet vide signifie "pas de
 * restriction".
 */
function pdvScope(user) {
  if (!user || !user.role) return { id: -1 };
  switch (user.role) {
    case 'admin':
      return {};
    case 'chef_zone':
      return { chef_zone_id: user.userId };
    case 'superviseur':
      return { superviseur_id: user.userId };
    case 'agence':
      return { agence_id: user.agence_id || -1 };
    case 'commercial':
      return { commercial_id: user.userId };
    default:
      return { id: -1 };
  }
}

/** true si le rôle n'a aucune restriction de périmètre (voit toute la base). */
function estGlobal(user) {
  return !!user && ROLES_GLOBAUX.includes(user.role);
}

/**
 * Vérifie qu'un PDV déjà chargé (instance Sequelize ou objet brut, doit
 * contenir agence_id / commercial_id / superviseur_id / chef_zone_id) entre
 * bien dans le périmètre de l'utilisateur connecté.
 */
function peutAccederAuPDV(user, pdv) {
  if (!user || !pdv) return false;
  switch (user.role) {
    case 'admin':
      return true;
    case 'chef_zone':
      return pdv.chef_zone_id === user.userId;
    case 'superviseur':
      return pdv.superviseur_id === user.userId;
    case 'agence':
      return !!user.agence_id && pdv.agence_id === user.agence_id;
    case 'commercial':
      return pdv.commercial_id === user.userId;
    default:
      return false;
  }
}

/** Fusionne un `where` Sequelize existant avec le filtre de portée. */
function withScope(where, scope) {
  const hasScope = scope && Object.keys(scope).length > 0;
  const hasWhere = where && Object.keys(where).length > 0;
  if (!hasScope) return where || {};
  if (!hasWhere) return scope;
  return { [Op.and]: [where, scope] };
}

/**
 * Bloc `include` prêt à l'emploi pour restreindre une requête sur un modèle
 * lié à PDV (Vente, Position, Alerte...) à la portée de l'utilisateur.
 * `as` est l'alias d'association vers PDV défini dans le modèle appelant.
 */
function pdvIncludeScope(user, as = 'pdv', extra = {}) {
  const scope = pdvScope(user);
  const base = { model: require('../models').PDV, as, attributes: [], ...extra };
  if (Object.keys(scope).length === 0) {
    return { ...base, required: !!extra.required };
  }
  return { ...base, where: withScope(extra.where, scope), required: true };
}

module.exports = { pdvScope, estGlobal, peutAccederAuPDV, withScope, pdvIncludeScope };
