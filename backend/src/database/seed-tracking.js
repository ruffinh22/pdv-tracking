require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PDV, Position, Alerte, GeofenceZone, Agence, User, Produit } = require('../models');

const seedTrackingData = async () => {
  try {
    console.log('Création des données de démonstration...');

    // Nettoyage (ordre important pour respecter les FK)
    await Alerte.destroy({ where: {} });
    await Position.destroy({ where: {} });
    await PDV.destroy({ where: {} });
    await GeofenceZone.destroy({ where: {} });
    console.log('Anciennes données de tracking supprimées');

    // --- Référentiels : Agences, hiérarchie commerciale, produits ---
    const agenceCentre = await Agence.findOrCreate({ where: { nom_agence: 'Agence Paris Centre' }, defaults: { ville: 'Paris' } }).then(r => r[0]);
    const agenceDefense = await Agence.findOrCreate({ where: { nom_agence: 'Agence La Défense' }, defaults: { ville: 'Paris' } }).then(r => r[0]);

    const motDePasseDemo = await bcrypt.hash('demo123', 10);
    const commercial = await User.findOrCreate({ where: { email: 'commercial.demo@trackingpdv.com' }, defaults: { nom: 'Demo', prenom: 'Commercial', mot_de_passe: motDePasseDemo, role: 'commercial' } }).then(r => r[0]);
    const superviseur = await User.findOrCreate({ where: { email: 'superviseur.demo@trackingpdv.com' }, defaults: { nom: 'Demo', prenom: 'Superviseur', mot_de_passe: motDePasseDemo, role: 'superviseur' } }).then(r => r[0]);
    const chefZone = await User.findOrCreate({ where: { email: 'chefzone.demo@trackingpdv.com' }, defaults: { nom: 'Demo', prenom: 'ChefZone', mot_de_passe: motDePasseDemo, role: 'chef_zone' } }).then(r => r[0]);

    const nomsProduits = ['Bonbons', 'Boisson', 'Recharge mobile', 'Cigarettes'];
    const produits = [];
    for (const nom of nomsProduits) {
      const produit = await Produit.findOrCreate({ where: { nom_produit: nom } }).then(r => r[0]);
      produits.push(produit);
    }
    console.log('Référentiels prêts (agences, hiérarchie, produits)');

    // --- Zone geofence de test ---
    const createdZone = await GeofenceZone.create({
      nom_zone: 'Zone Paris Centre',
      type: 'cercle',
      coordonnees: { type: 'Point', coordinates: [2.3522, 48.8566] },
      rayon: 5000,
      cree_par: null
    });
    console.log('Zone geofence créée avec succès');

    // --- PDV avec toutes les nouvelles informations de tagging ---
    const pdvsData = [
      {
        nom_pdv: 'PDV Paris Centre', id_terminal: 'TERM-PC-001', msisdn_responsable: '+33612345678',
        latitude_creation: 48.8566, longitude_creation: 2.3522, statut: 'actif',
        derniere_position_latitude: 48.8566, derniere_position_longitude: 2.3522, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceCentre?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Paris', vendeur_nom: 'Jean Dupont', contact_vendeur: '+33611110001',
        pays: 'France', ville: 'Paris', commune: '1er Arrondissement', quartier: 'Louvre',
        produits: [produits[0].id, produits[1].id]
      },
      {
        nom_pdv: 'PDV La Défense', id_terminal: 'TERM-LD-002', msisdn_responsable: '+33623456789',
        latitude_creation: 48.8922, longitude_creation: 2.2404, statut: 'actif',
        derniere_position_latitude: 48.8922, derniere_position_longitude: 2.2404, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceDefense?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Défense', vendeur_nom: 'Marie Martin', contact_vendeur: '+33611110002',
        pays: 'France', ville: 'Paris', commune: 'La Défense', quartier: 'Esplanade',
        produits: [produits[1].id, produits[2].id]
      },
      {
        nom_pdv: 'PDV Montmartre', id_terminal: 'TERM-MM-003', msisdn_responsable: '+33634567890',
        latitude_creation: 48.8867, longitude_creation: 2.3431, statut: 'actif',
        derniere_position_latitude: 48.8867, derniere_position_longitude: 2.3431, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceCentre?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Nord', vendeur_nom: 'Paul Bernard', contact_vendeur: '+33611110003',
        pays: 'France', ville: 'Paris', commune: 'Montmartre', quartier: 'Butte',
        produits: [produits[0].id]
      },
      {
        nom_pdv: 'PDV Champs-Élysées', id_terminal: 'TERM-CE-004', msisdn_responsable: '+33645678901',
        latitude_creation: 48.8656, longitude_creation: 2.3212, statut: 'inactif',
        derniere_position_latitude: 48.8656, derniere_position_longitude: 2.3212, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceCentre?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Ouest', vendeur_nom: 'Sophie Petit', contact_vendeur: '+33611110004',
        pays: 'France', ville: 'Paris', commune: '8e Arrondissement', quartier: 'Champs-Élysées',
        produits: [produits[3].id]
      },
      {
        nom_pdv: 'PDV Bastille', id_terminal: 'TERM-BA-005', msisdn_responsable: '+33656789012',
        latitude_creation: 48.8530, longitude_creation: 2.3690, statut: 'suspendu',
        derniere_position_latitude: 48.8530, derniere_position_longitude: 2.3690, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceDefense?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Est', vendeur_nom: 'Luc Robert', contact_vendeur: '+33611110005',
        pays: 'France', ville: 'Paris', commune: 'Bastille', quartier: 'Faubourg Saint-Antoine',
        produits: [produits[1].id, produits[3].id]
      },
      {
        nom_pdv: 'PDV Marais', id_terminal: 'TERM-MA-006', msisdn_responsable: '+33667890123',
        latitude_creation: 48.8462, longitude_creation: 2.3376, statut: 'actif',
        derniere_position_latitude: 48.8462, derniere_position_longitude: 2.3376, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceCentre?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Centre', vendeur_nom: 'Emma Richard', contact_vendeur: '+33611110006',
        pays: 'France', ville: 'Paris', commune: 'Le Marais', quartier: 'Saint-Paul',
        produits: [produits[0].id, produits[2].id]
      },
      {
        nom_pdv: 'PDV Quartier Latin', id_terminal: 'TERM-QL-007', msisdn_responsable: '+33678901234',
        latitude_creation: 48.8530, longitude_creation: 2.3499, statut: 'actif',
        derniere_position_latitude: 48.8530, derniere_position_longitude: 2.3499, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceCentre?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Rive Gauche', vendeur_nom: 'Julie Simon', contact_vendeur: '+33611110007',
        pays: 'France', ville: 'Paris', commune: 'Quartier Latin', quartier: 'Sorbonne',
        produits: [produits[2].id]
      },
      {
        nom_pdv: 'PDV Tour Eiffel', id_terminal: 'TERM-TE-008', msisdn_responsable: '+33689012345',
        latitude_creation: 48.8584, longitude_creation: 2.2945, statut: 'actif',
        derniere_position_latitude: 48.8584, derniere_position_longitude: 2.2945, derniere_position_date: new Date().toISOString(),
        zone_geofence_id: createdZone.id, agence_id: agenceDefense?.id, commercial_id: commercial.id, superviseur_id: superviseur.id, chef_zone_id: chefZone.id,
        concessionnaire_nom: 'Concess Sud-Ouest', vendeur_nom: 'Thomas Michel', contact_vendeur: '+33611110008',
        pays: 'France', ville: 'Paris', commune: '7e Arrondissement', quartier: 'Gros-Caillou',
        produits: [produits[0].id, produits[1].id, produits[2].id]
      }
    ];

    const createdPDVs = [];
    for (const data of pdvsData) {
      const { produits: produitsIds, ...pdvFields } = data;
      const pdv = await PDV.create(pdvFields);
      await pdv.setProduits(produitsIds);
      createdPDVs.push(pdv);
    }
    console.log(`${createdPDVs.length} PDV créés avec succès (localisation, hiérarchie, produits multiples)`);

    // --- Positions GPS historiques ---
    const positionsData = [];
    const baseTime = new Date();

    createdPDVs.forEach((pdv) => {
      for (let i = 0; i < 5; i++) {
        const timeOffset = i * 5 * 60 * 1000;
        const time = new Date(baseTime.getTime() - timeOffset);
        const latOffset = (Math.random() - 0.5) * 0.002;
        const lngOffset = (Math.random() - 0.5) * 0.002;

        positionsData.push({
          pdv_id: pdv.id,
          latitude: parseFloat(pdv.latitude_creation) + latOffset,
          longitude: parseFloat(pdv.longitude_creation) + lngOffset,
          horodatage: time.toISOString()
        });
      }
    });

    await Position.bulkCreate(positionsData);
    console.log(`${positionsData.length} positions GPS créées`);

    // --- Alertes de démonstration, incluant le nouveau type "activité suspecte >500m" ---
    const alertesData = [
      {
        pdv_id: createdPDVs[0].id,
        zone_id: createdZone.id,
        type_alerte: 'sortie_zone',
        latitude: createdPDVs[0].latitude_creation,
        longitude: createdPDVs[0].longitude_creation,
        commentaire: 'PDV Paris Centre a quitté sa zone géographique assignée',
        statut: 'non_traitee',
        horodatage: new Date().toISOString()
      },
      {
        pdv_id: createdPDVs[1].id,
        type_alerte: 'deplacement_anormal',
        latitude: 48.8990,
        longitude: 2.2500,
        distance_metres: 912.4,
        commentaire: 'PDV La Défense détecté à plus de 500m de sa position initiale',
        statut: 'non_traitee',
        horodatage: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        pdv_id: createdPDVs[4].id,
        zone_id: createdZone.id,
        type_alerte: 'sortie_zone',
        latitude: createdPDVs[4].latitude_creation,
        longitude: createdPDVs[4].longitude_creation,
        commentaire: 'PDV Bastille a été suspendu automatiquement',
        statut: 'traitee',
        horodatage: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        pdv_id: createdPDVs[2].id,
        type_alerte: 'deplacement_anormal',
        latitude: 48.8930,
        longitude: 2.3550,
        distance_metres: 750.2,
        commentaire: 'Position GPS anormale détectée pour PDV Montmartre (>500m)',
        statut: 'non_traitee',
        horodatage: new Date().toISOString()
      }
    ];

    await Alerte.bulkCreate(alertesData);
    console.log(`${alertesData.length} alertes créées (dont "activité suspecte >500m")`);

    console.log('\nDonnées de démonstration créées avec succès !');
    console.log('Comptes de démonstration (mot de passe: demo123):');
    console.log('  - commercial.demo@trackingpdv.com');
    console.log('  - superviseur.demo@trackingpdv.com');
    console.log('  - chefzone.demo@trackingpdv.com');
  } catch (error) {
    console.error('Erreur lors de la création des données de démonstration:', error);
  } finally {
    process.exit(0);
  }
};

seedTrackingData();
