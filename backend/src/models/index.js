const { sequelize } = require('../config/database');
const User = require('./User');
const PDV = require('./PDV');
const Position = require('./Position');
const Vente = require('./Vente');
const GeofenceZone = require('./GeofenceZone');
const Alerte = require('./Alerte');
const Produit = require('./Produit');

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

module.exports = {
  sequelize,
  User,
  PDV,
  Position,
  Vente,
  GeofenceZone,
  Alerte,
  Produit
};
