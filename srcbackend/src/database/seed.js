require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Agence, Produit } = require('../models');

const seedDatabase = async () => {
  try {
    // Synchroniser la base de données
    await sequelize.sync({ alter: true });
    console.log('Base de données synchronisée');

    // Vérifier si l'utilisateur admin existe déjà
    const existingAdmin = await User.findOne({ where: { email: 'admin@trackingpdv.com' } });

    if (existingAdmin) {
      console.log('L\'utilisateur admin existe déjà, seed ignoré.');
      return;
    }

    // Créer l'utilisateur admin par défaut
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      nom: 'Admin',
      prenom: 'Système',
      email: 'admin@trackingpdv.com',
      mot_de_passe: hashedPassword,
      role: 'admin',
      statut: 'actif'
    });
    console.log('✔ Utilisateur admin créé: admin@trackingpdv.com / admin123');

    // Créer un utilisateur superviseur par défaut
    const hashedPasswordSup = await bcrypt.hash('superviseur123', 10);
    await User.create({
      nom: 'Superviseur',
      prenom: 'Test',
      email: 'superviseur@trackingpdv.com',
      mot_de_passe: hashedPasswordSup,
      role: 'superviseur',
      statut: 'actif'
    });
    console.log('✔ Utilisateur superviseur créé: superviseur@trackingpdv.com / superviseur123');

    // Créer un utilisateur commercial par défaut
    const hashedPasswordCom = await bcrypt.hash('commercial123', 10);
    await User.create({
      nom: 'Commercial',
      prenom: 'Test',
      email: 'commercial@trackingpdv.com',
      mot_de_passe: hashedPasswordCom,
      role: 'commercial',
      statut: 'actif'
    });
    console.log('✔ Utilisateur commercial créé: commercial@trackingpdv.com / commercial123');

    // Créer un utilisateur chef de zone par défaut
    const hashedPasswordChef = await bcrypt.hash('chefzone123', 10);
    await User.create({
      nom: 'ChefZone',
      prenom: 'Test',
      email: 'chefzone@trackingpdv.com',
      mot_de_passe: hashedPasswordChef,
      role: 'chef_zone',
      statut: 'actif'
    });
    console.log('✔ Utilisateur chef de zone créé: chefzone@trackingpdv.com / chefzone123');

    // Référentiel Agence (utilisé dans les dropdowns du formulaire de tagging PDV)
    await Agence.bulkCreate([
      { nom_agence: 'Agence Cotonou Centre', ville: 'Cotonou' },
      { nom_agence: 'Agence Porto-Novo', ville: 'Porto-Novo' },
      { nom_agence: 'Agence Parakou', ville: 'Parakou' }
    ]);
    console.log('✔ Référentiel Agences créé (3 agences)');

    // Référentiel Produits (utilisé dans le multi-select "type de produit vendu")
    await Produit.bulkCreate([
      { nom_produit: 'Bonbons', categorie: 'Confiserie' },
      { nom_produit: 'Boisson', categorie: 'Boissons' },
      { nom_produit: 'Recharge mobile', categorie: 'Télécom' },
      { nom_produit: 'Cigarettes', categorie: 'Tabac' }
    ]);
    console.log('✔ Référentiel Produits créé (4 produits)');

    console.log('\nSeed terminé avec succès.');
  } catch (error) {
    console.error('Erreur lors du seed de la base de données:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seedDatabase();
