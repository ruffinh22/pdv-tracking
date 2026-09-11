const { PDV, GeofenceZone, Alerte } = require('../models');
const turf = require('@turf/turf');
const logger = require('../utils/logger');
const { distanceEnMetres } = require('../utils/geoUtils');

// Rayon (en mètres) au-delà duquel un déplacement par rapport à la position
// initiale de tagging du PDV est considéré comme une activité suspecte.
const RAYON_ACTIVITE_SUSPECTE_METRES = parseInt(process.env.RAYON_ALERTE_METRES, 10) || 500;

// Délai (en minutes) pendant lequel on évite de recréer une alerte identique
// pour le même PDV, afin de ne pas spammer une alerte à chaque position reçue.
const DELAI_ANTI_DOUBLON_MINUTES = 30;

class GeofencingService {
  setIo(ioInstance) {
    this.io = ioInstance;
  }

  /**
   * Point d'entrée unique appelé à chaque nouvelle position reçue d'un PDV.
   * Combine deux contrôles indépendants :
   *  1. Sortie d'une zone geofence explicitement assignée (polygone/cercle métier)
   *  2. Activité suspecte : écart de plus de 500m (configurable) par rapport
   *     à la position initiale de tagging du PDV, indépendamment de toute zone.
   */
  async checkAll(pdvId, latitude, longitude) {
    await Promise.all([
      this.checkGeofencing(pdvId, latitude, longitude),
      this.checkActiviteSuspecte(pdvId, latitude, longitude)
    ]);
  }

  async checkGeofencing(pdvId, latitude, longitude) {
    try {
      const pdv = await PDV.findByPk(pdvId, { include: ['zone'] });

      if (!pdv || !pdv.zone) {
        return; // Pas de zone assignée, pas de vérification
      }

      const zone = pdv.zone;
      const point = turf.point([longitude, latitude]);
      const zoneGeoJSON = zone.coordonnees;

      const isInside = turf.booleanPointInPolygon(point, zoneGeoJSON);

      if (!isInside) {
        const dejaAlerte = await this.aDejaUneAlerteRecente(pdvId, 'sortie_zone');
        if (dejaAlerte) return;

        // Sortie de zone détectée - créer une alerte
        const alerte = await Alerte.create({
          pdv_id: pdvId,
          zone_id: zone.id,
          type_alerte: 'sortie_zone',
          latitude,
          longitude,
          statut: 'non_traitee'
        });

        logger.warn(`Alerte sortie de zone: PDV ${pdvId}, Zone ${zone.nom_zone}`);

        this.emettreAlerte(alerte, pdv, { zone_nom: zone.nom_zone });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification du geofencing:', error);
    }
  }

  /**
   * Point 1 du cahier des charges : détecte quand un PDV s'éloigne de plus de
   * 500 mètres (par défaut) de sa position initiale de tagging, qu'une zone
   * geofence lui soit assignée ou non.
   */
  async checkActiviteSuspecte(pdvId, latitude, longitude) {
    try {
      const pdv = await PDV.findByPk(pdvId);
      if (!pdv || !pdv.latitude_creation || !pdv.longitude_creation) {
        return;
      }

      const distance = distanceEnMetres(
        parseFloat(pdv.latitude_creation),
        parseFloat(pdv.longitude_creation),
        parseFloat(latitude),
        parseFloat(longitude)
      );

      if (distance > RAYON_ACTIVITE_SUSPECTE_METRES) {
        const dejaAlerte = await this.aDejaUneAlerteRecente(pdvId, 'deplacement_anormal');
        if (dejaAlerte) return;

        const alerte = await Alerte.create({
          pdv_id: pdvId,
          type_alerte: 'deplacement_anormal',
          latitude,
          longitude,
          distance_metres: distance.toFixed(2),
          statut: 'non_traitee'
        });

        logger.warn(
          `Activité suspecte: PDV ${pdvId} à ${distance.toFixed(0)}m de sa position initiale (seuil: ${RAYON_ACTIVITE_SUSPECTE_METRES}m)`
        );

        this.emettreAlerte(alerte, pdv, { distance_metres: Math.round(distance) });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification de l\'activité suspecte:', error);
    }
  }

  /**
   * Évite de recréer une alerte identique tant qu'une alerte non traitée du
   * même type existe déjà pour ce PDV, ou qu'une alerte a été émise il y a
   * moins de DELAI_ANTI_DOUBLON_MINUTES.
   */
  async aDejaUneAlerteRecente(pdvId, typeAlerte) {
    const { Op } = require('sequelize');
    const seuil = new Date(Date.now() - DELAI_ANTI_DOUBLON_MINUTES * 60 * 1000);

    const alerteExistante = await Alerte.findOne({
      where: {
        pdv_id: pdvId,
        type_alerte: typeAlerte,
        [Op.or]: [
          { statut: 'non_traitee' },
          { horodatage: { [Op.gte]: seuil } }
        ]
      },
      order: [['horodatage', 'DESC']]
    });

    return !!alerteExistante;
  }

  emettreAlerte(alerte, pdv, extra = {}) {
    if (!this.io) return;
    this.io.emit('alerte', {
      id: alerte.id,
      type: alerte.type_alerte,
      pdv_id: pdv.id,
      pdv_nom: pdv.nom_pdv,
      latitude: alerte.latitude,
      longitude: alerte.longitude,
      horodatage: alerte.horodatage,
      ...extra
    });
  }

  async sendNotificationEmail(alerte) {
    // Implémentation de l'envoi d'email avec nodemailer
    // À configurer selon les besoins
  }
}

module.exports = new GeofencingService();

