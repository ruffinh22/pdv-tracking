const axios = require('axios');
const logger = require('../utils/logger');

class GeocodingService {
  /**
   * Effectue un géocodage inverse pour obtenir l'adresse à partir des coordonnées GPS
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {Promise<Object>} Informations de localisation (ville, localité, pays, etc.)
   */
  async reverseGeocode(latitude, longitude) {
    try {
      // Utilisation de l'API OpenStreetMap Nominatim (gratuit)
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          params: {
            lat: latitude,
            lon: longitude,
            format: 'json',
            accept_language: 'fr'
          },
          headers: {
            'User-Agent': 'TrackingPDV/1.0'
          }
        }
      );

      const data = response.data;
      
      if (data && data.address) {
        // La ville correspond à la ville principale
        const ville = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
        // La commune correspond à la localité (quartiers/sous-districts)
        const commune = data.address.suburb || data.address.district || data.address.neighbourhood || '';
        // Le quartier correspond à la rue spécifique
        const quartier = data.address.road || data.address.street || '';

        return {
          ville: ville,
          commune: commune,
          localite: commune,
          quartier: quartier,
          pays: data.address.country || '',
          code_postal: data.address.postcode || '',
          adresse_complete: data.display_name || ''
        };
      }

      return {
        ville: '',
        commune: '',
        localite: '',
        quartier: '',
        pays: '',
        code_postal: '',
        adresse_complete: ''
      };
    } catch (error) {
      logger.error('Erreur lors du géocodage inverse:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        ville: '',
        commune: '',
        localite: '',
        quartier: '',
        pays: '',
        code_postal: '',
        adresse_complete: ''
      };
    }
  }
}

module.exports = new GeocodingService();