const { sequelize } = require('../config/database');
const User = require('./User');
const PDV = require('./PDV');
const Position = require('./Position');
const Vente = require('./Vente');
const GeofenceZone = require('./GeofenceZone');
const Alerte = require('./Alerte');
const Produit = require('./Produit');
const Agence = require('./Agence');
const PDVProduit = require('./PDVProduit');

// Définition des relations
User.hasMany(PDV, { foreignKey: 'cree_par', as: 'pdvsCrees' });
PDV.belongsTo(User, { foreignKey: 'cree_par', as: 'createur' });

PDV.hasMany(Position, { foreignKey: 'pdv_id', as: 'positions' });
Position.belongsTo(PDV, { foreignKey: 'pdv_id', as: 'pdv' });

PDV.hasMany(Vente, { foreignKey: 'pdv_id', as: 'ventes' });
Vente.belongsTo(PDV, { foreignKey: 'pdv_id', as: 'pdv' });

GeofenceZone.hasMany(PDV, { foreignKey: 'zone_geofence_id', as: 'pdvs' });
PDV.belongsTo(GeofenceZone, { foreignKey: 'zone_geofence_id', as: 'zone' });

GeofenceZone.hasMany(Alerte, { foreignKey: 'zone_id', as: 'alertes' });
Alerte.belongsTo(GeofenceZone, { foreignKey: 'zone_id', as: 'zone' });

PDV.hasMany(Alerte, { foreignKey: 'pdv_id', as: 'alertes' });
Alerte.belongsTo(PDV, { foreignKey: 'pdv_id', as: 'pdv' });

User.hasMany(Alerte, { foreignKey: 'traitee_par', as: 'alertesTraitees' });
Alerte.belongsTo(User, { foreignKey: 'traitee_par', as: 'traiteur' });

User.hasMany(GeofenceZone, { foreignKey: 'cree_par', as: 'zonesCrees' });
GeofenceZone.belongsTo(User, { foreignKey: 'cree_par', as: 'createur' });

// Référentiel Agence
Agence.hasMany(PDV, { foreignKey: 'agence_id', as: 'pdvs' });
PDV.belongsTo(Agence, { foreignKey: 'agence_id', as: 'agence' });

// Hiérarchie commerciale (référentiels utilisateurs, plus de saisie libre)
User.hasMany(PDV, { foreignKey: 'commercial_id', as: 'pdvsCommercial' });
PDV.belongsTo(User, { foreignKey: 'commercial_id', as: 'commercial' });

User.hasMany(PDV, { foreignKey: 'superviseur_id', as: 'pdvsSuperviseur' });
PDV.belongsTo(User, { foreignKey: 'superviseur_id', as: 'superviseur' });

User.hasMany(PDV, { foreignKey: 'chef_zone_id', as: 'pdvsChefZone' });
PDV.belongsTo(User, { foreignKey: 'chef_zone_id', as: 'chefZone' });

// Types de produits vendus par PDV (choix multiples)
PDV.belongsToMany(Produit, { through: PDVProduit, foreignKey: 'pdv_id', otherKey: 'produit_id', as: 'produits' });
Produit.belongsToMany(PDV, { through: PDVProduit, foreignKey: 'produit_id', otherKey: 'pdv_id', as: 'pdvs' });

// Associations directes sur la table de liaison, utiles pour les agrégations du dashboard
PDVProduit.belongsTo(PDV, { foreignKey: 'pdv_id', as: 'pdv' });
PDVProduit.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });
PDV.hasMany(PDVProduit, { foreignKey: 'pdv_id', as: 'tagsProduits' });
Produit.hasMany(PDVProduit, { foreignKey: 'produit_id', as: 'tagsPdv' });

module.exports = {
  sequelize,
  User,
  PDV,
  Position,
  Vente,
  GeofenceZone,
  Alerte,
  Produit,
  Agence,
  PDVProduit
};
