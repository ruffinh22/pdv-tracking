require('dotenv').config();
const { PDV, Position, Alerte, GeofenceZone } = require('../models');

const seedTrackingData = async () => {
  try {
    console.log('Création des données de test pour le tracking...');

    // Supprimer les données existantes
    await Alerte.destroy({ where: {} });
    await Position.destroy({ where: {} });
    await PDV.destroy({ where: {} });
    await GeofenceZone.destroy({ where: {} });
    console.log('Anciennes données supprimées');

    // Créer une zone geofence de test
    const zoneData = {
      nom_zone: 'Zone Paris Centre',
      type: 'cercle',
      coordonnees: {
        type: 'Point',
        coordinates: [2.3522, 48.8566]
      },
      rayon: 5000,
      cree_par: 1
    };
    
    const createdZone = await GeofenceZone.create(zoneData);
    console.log('Zone geofence créée avec succès');

    // Créer des PDV avec des positions GPS réalistes (autour de Paris)
    const pdvsData = [
      {
        nom_pdv: 'PDV Paris Centre',
        msisdn_responsable: '+33612345678',
        latitude_creation: 48.8566,
        longitude_creation: 2.3522,
        statut: 'actif',
        derniere_position_latitude: 48.8566,
        derniere_position_longitude: 2.3522,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV La Défense',
        msisdn_responsable: '+33623456789',
        latitude_creation: 48.8922,
        longitude_creation: 2.2404,
        statut: 'actif',
        derniere_position_latitude: 48.8922,
        derniere_position_longitude: 2.2404,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Montmartre',
        msisdn_responsable: '+33634567890',
        latitude_creation: 48.8867,
        longitude_creation: 2.3431,
        statut: 'actif',
        derniere_position_latitude: 48.8867,
        derniere_position_longitude: 2.3431,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Champs-Élysées',
        msisdn_responsable: '+33645678901',
        latitude_creation: 48.8656,
        longitude_creation: 2.3212,
        statut: 'inactif',
        derniere_position_latitude: 48.8656,
        derniere_position_longitude: 2.3212,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Bastille',
        msisdn_responsable: '+33656789012',
        latitude_creation: 48.8530,
        longitude_creation: 2.3690,
        statut: 'suspendu',
        derniere_position_latitude: 48.8530,
        derniere_position_longitude: 2.3690,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Marais',
        msisdn_responsable: '+33667890123',
        latitude_creation: 48.8462,
        longitude_creation: 2.3376,
        statut: 'actif',
        derniere_position_latitude: 48.8462,
        derniere_position_longitude: 2.3376,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Quartier Latin',
        msisdn_responsable: '+33678901234',
        latitude_creation: 48.8530,
        longitude_creation: 2.3499,
        statut: 'actif',
        derniere_position_latitude: 48.8530,
        derniere_position_longitude: 2.3499,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      },
      {
        nom_pdv: 'PDV Tour Eiffel',
        msisdn_responsable: '+33689012345',
        latitude_creation: 48.8584,
        longitude_creation: 2.2945,
        statut: 'actif',
        derniere_position_latitude: 48.8584,
        derniere_position_longitude: 2.2945,
        derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id
      }
    ];

    const createdPDVs = await PDV.bulkCreate(pdvsData);
    console.log(`${createdPDVs.length} PDV créés avec succès`);

    // Créer des positions GPS historiques pour simuler le mouvement
    const positionsData = [];
    const baseTime = new Date();
    
    createdPDVs.forEach((pdv, index) => {
      // Créer 5 positions par PDV pour simuler un mouvement
      for (let i = 0; i < 5; i++) {
        const timeOffset = i * 5 * 60 * 1000; // 5 minutes d'intervalle
        const time = new Date(baseTime.getTime() - timeOffset);
        
        // Simuler un petit mouvement aléatoire
        const latOffset = (Math.random() - 0.5) * 0.002;
        const lngOffset = (Math.random() - 0.5) * 0.002;
        
        positionsData.push({
          pdv_id: pdv.id,
          latitude: pdv.latitude_creation + latOffset,
          longitude: pdv.longitude_creation + lngOffset,
          horodatage: time.toISOString()
        });
      }
    });

    await Position.bulkCreate(positionsData);
    console.log(`${positionsData.length} positions GPS créées`);

    // Créer des alertes de test avec la zone créée
    const alertesData = [
      {
        pdv_id: createdPDVs[0].id,
        zone_id: createdZone.id,
        type_alerte: 'sortie_zone',
        latitude: createdPDVs[0].latitude_creation,
        longitude: createdPDVs[0].longitude_creation,
        description: 'PDV Paris Centre a quitté sa zone géographique assignée',
        statut: 'non_traitee',
        horodatage: new Date().toISOString()
      },
      {
        pdv_id: createdPDVs[1].id,
        zone_id: createdZone.id,
        type_alerte: 'deplacement_anormal',
        latitude: createdPDVs[1].latitude_creation,
        longitude: createdPDVs[1].longitude_creation,
        description: 'PDV La Défense n\'a pas envoyé de position depuis 2 heures',
        statut: 'non_traitee',
        horodatage: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        pdv_id: createdPDVs[4].id,
        zone_id: createdZone.id,
        type_alerte: 'sortie_zone',
        latitude: createdPDVs[4].latitude_creation,
        longitude: createdPDVs[4].longitude_creation,
        description: 'PDV Bastille a été suspendu automatiquement',
        statut: 'traitee',
        horodatage: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        pdv_id: createdPDVs[2].id,
        zone_id: createdZone.id,
        type_alerte: 'deplacement_anormal',
        latitude: createdPDVs[2].latitude_creation,
        longitude: createdPDVs[2].longitude_creation,
        description: 'Position GPS anormale détectée pour PDV Montmartre',
        statut: 'non_traitee',
        horodatage: new Date().toISOString()
      }
    ];

    await Alerte.bulkCreate(alertesData);
    console.log(`${alertesData.length} alertes créées`);

    console.log('Données de tracking créées avec succès!');
    console.log('Accès aux PDV avec leurs positions GPS et alertes');
    
  } catch (error) {
    console.error('Erreur lors de la création des données de tracking:', error);
  } finally {
    process.exit(0);
  }
};

seedTrackingData();