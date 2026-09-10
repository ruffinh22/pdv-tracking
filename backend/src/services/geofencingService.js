const { PDV, GeofenceZone, Alerte } = require('../models');
const turf = require('@turf/turf');
const logger = require('../utils/logger');

class GeofencingService {
  setIo(ioInstance) {
    this.io = ioInstance;
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

        // Émettre notification WebSocket
        if (this.io) {
          this.io.emit('alerte', {
            type: 'sortie_zone',
            pdv_id: pdvId,
            pdv_nom: pdv.nom_pdv,
            zone_nom: zone.nom_zone,
            latitude,
            longitude,
            horodatage: alerte.horodatage
          });
        }

        // Envoyer email de notification (optionnel)
        // await this.sendNotificationEmail(alerte);
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification du geofencing:', error);
    }
  }

  async sendNotificationEmail(alerte) {
    // Implémentation de l'envoi d'email avec nodemailer
    // À configurer selon les besoins
  }
}

module.exports = new GeofencingService();
