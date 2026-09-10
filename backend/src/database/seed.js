require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

const seedDatabase = async () => {
  try {
    // Synchroniser la base de données
    await sequelize.sync({ force: false });
    console.log('Base de données synchronisée');

    // Vérifier si l'utilisateur admin existe déjà
    const existingAdmin = await User.findOne({ where: { email: 'admin@trackingpdv.com' } });

    if (existingAdmin) {
      console.log('L\'utilisateur admin existe déjà');
      return;
    }

    // Créer l'utilisateur admin par défaut
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await User.create({
      nom: 'Admin',
      prenom: 'Système',
      email: 'admin@trackingpdv.com',
      mot_de_passe: hashedPassword,
      role: 'admin',
      statut: 'actif'
    });

    console.log('Utilisateur admin créé avec succès:');
    console.log('Email: admin@trackingpdv.com');
    console.log('Mot de passe: admin123');
    console.log('Rôle: admin');

    // Créer un utilisateur superviseur par défaut
    const hashedPasswordSup = await bcrypt.hash('superviseur123', 10);

    const superviseur = await User.create({
      nom: 'Superviseur',
      prenom: 'Test',
      email: 'superviseur@trackingpdv.com',
      mot_de_passe: hashedPasswordSup,
      role: 'superviseur',
      statut: 'actif'
    });

    console.log('Utilisateur superviseur créé avec succès:');
    console.log('Email: superviseur@trackingpdv.com');
    console.log('Mot de passe: superviseur123');
    console.log('Rôle: superviseur');

  } catch (error) {
    console.error('Erreur lors du seed de la base de données:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seedDatabase();
