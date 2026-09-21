/**
 * SEED DE RÉINITIALISATION — Tracking PDV (Côte d'Ivoire)
 *
 * 1. PURGE toutes les données métier (utilisateurs, agences, produits, PDV,
 *    positions, ventes, alertes, zones, valeurs d'attributs) et remet les
 *    compteurs auto-increment à 1.
 * 2. RECRÉE un jeu de données cohérent de bout en bout :
 *      - noms et prénoms africains / ivoiriens, numéros +225, communes d'Abidjan
 *        et de Bouaké, montants en FCFA ;
 *      - les 6 produits réels (PMU - ALR, PMU - PLR, LOTO BONHEUR EDITEC,
 *        LOTO BONHEUR AIL, SPORTCASH, GRATTAGE) et rien d'autre ;
 *      - une hiérarchie qui se tient : chef de zone > superviseur > commercial,
 *        agence de rattachement, agents avec matricule (enrôlement mobile) ;
 *      - des zones geofence en vrais polygones (le geofencingService utilise
 *        turf.booleanPointInPolygon : un simple "Point" ferait échouer le test) ;
 *      - des PDV dont les positions, ventes et alertes respectent leur statut
 *        (un PDV suspendu ne vend plus, un brouillon n'a pas de ventes, etc.).
 *
 * Ne touche PAS : `pdv_champs_fixes` (réglage de la fiche PDV) ni, sauf
 * option --avec-config, `pdv_attributs` (attributs personnalisés de l'admin).
 *
 * Usage (depuis backend/) :
 *   npm run seed:reset -- --yes
 *   npm run seed:reset -- --yes --avec-config     # purge aussi pdv_attributs
 *   NODE_ENV=production ... --yes --allow-production
 *
 * Les données sont reproductibles (générateur pseudo-aléatoire à graine fixe,
 * modifiable via SEED_ALEA=<nombre>) ; seules les dates glissent avec "maintenant".
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const turf = require('@turf/turf');
const {
  sequelize, User, Agence, Produit, PDV, PDVProduit, Position, Vente,
  Alerte, GeofenceZone, PdvAttribut, PdvAttributValeur
} = require('../models');
const { runMigrations } = require('./runMigrations');
const { distanceEnMetres } = require('../utils/geoUtils');

// ---------------------------------------------------------------------------
// Garde-fous
// ---------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const CONFIRME = args.has('--yes') || process.env.SEED_CONFIRM === 'oui';
const AVEC_CONFIG = args.has('--avec-config');
const EST_PRODUCTION = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Générateur pseudo-aléatoire reproductible (mulberry32)
// ---------------------------------------------------------------------------
function creerAlea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const alea = creerAlea(parseInt(process.env.SEED_ALEA, 10) || 20260921);
const entre = (min, max) => min + alea() * (max - min);
const entier = (min, max) => Math.floor(entre(min, max + 1));
const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
const melanger = (liste) => {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
};
const choisirPondere = (valeurs, poids) => {
  const total = poids.reduce((s, p) => s + p, 0);
  let tirage = alea() * total;
  for (let i = 0; i < valeurs.length; i++) {
    tirage -= poids[i];
    if (tirage <= 0) return valeurs[i];
  }
  return valeurs[valeurs.length - 1];
};

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
const MIN = 60 * 1000;
const HEURE = 60 * MIN;
const JOUR = 24 * HEURE;
const MAINTENANT = new Date();
const il_y_a = (ms) => new Date(MAINTENANT.getTime() - ms);

const sansAccents = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const emailsUtilises = new Set();
function creerEmail(prenom, nom) {
  const base = `${sansAccents(prenom)}.${sansAccents(nom)}`;
  let email = `${base}@trackingpdv.com`;
  let i = 2;
  while (emailsUtilises.has(email)) email = `${base}${i++}@trackingpdv.com`;
  emailsUtilises.add(email);
  return email;
}

// Numéros ivoiriens : +225 suivi de 10 chiffres (01 Moov, 05 MTN, 07 Orange).
const numerosUtilises = new Set();
function creerTelephone() {
  let numero;
  do {
    const prefixe = choisir(['01', '05', '07']);
    numero = `+225${prefixe}${String(entier(0, 99999999)).padStart(8, '0')}`;
  } while (numerosUtilises.has(numero));
  numerosUtilises.add(numero);
  return numero;
}

const hexAleatoire = (n) =>
  Array.from({ length: n }, () => Math.floor(alea() * 16).toString(16)).join('');

function decaler(lat, lng, distanceM, cap) {
  const p = turf.destination([lng, lat], distanceM, cap, { units: 'meters' });
  return { lat: p.geometry.coordinates[1], lng: p.geometry.coordinates[0] };
}
const bruitGps = (lat, lng, maxM) => decaler(lat, lng, entre(0, maxM), entre(0, 360));
// Point situé juste au-delà du bord de la zone, dans le prolongement centre → PDV :
// une sortie de zone réaliste (quelques centaines de mètres du PDV), pas un point tiré
// au hasard à l'autre bout de la commune.
function pointHorsZone(zone, pdvLat, pdvLng, marge = 150) {
  const dCentre = distanceEnMetres(zone.centre.lat, zone.centre.lng, pdvLat, pdvLng);
  const cap = dCentre < 20
    ? entre(0, 360)
    : turf.bearing([zone.centre.lng, zone.centre.lat], [pdvLng, pdvLat]);
  return decaler(pdvLat, pdvLng, Math.max(dCentre < 20 ? zone.rayon : zone.rayon - dCentre, 0) + marge, cap);
}
const arrondir = (n, d = 8) => Number(n.toFixed(d));
const par = (liste, taille) => {
  const lots = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
};

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------
const PAYS = "Côte d'Ivoire";

// Les 6 produits réels — aucune autre ligne ne doit exister dans `produits`.
const PRODUITS = [
  { nom_produit: 'PMU - ALR', categorie: 'PMU' },
  { nom_produit: 'PMU - PLR', categorie: 'PMU' },
  { nom_produit: 'LOTO BONHEUR EDITEC', categorie: 'Loto Bonheur' },
  { nom_produit: 'LOTO BONHEUR AIL', categorie: 'Loto Bonheur' },
  { nom_produit: 'SPORTCASH', categorie: 'Paris sportifs' },
  { nom_produit: 'GRATTAGE', categorie: 'Jeux instantanés' }
];

// Montants en FCFA : [min, max, pas] par produit (mise d'une vente).
const MONTANTS = {
  'PMU - ALR': [500, 10000, 500],
  'PMU - PLR': [500, 5000, 500],
  'LOTO BONHEUR EDITEC': [200, 2000, 100],
  'LOTO BONHEUR AIL': [200, 2000, 100],
  SPORTCASH: [500, 15000, 500],
  GRATTAGE: [200, 2000, 200]
};

const AGENCES = [
  { cle: 'plateau', nom_agence: 'Agence Abidjan Plateau', ville: 'Abidjan' },
  { cle: 'abobo', nom_agence: 'Agence Abobo', ville: 'Abidjan' },
  { cle: 'yopougon', nom_agence: 'Agence Yopougon', ville: 'Abidjan' },
  { cle: 'cocody', nom_agence: 'Agence Cocody', ville: 'Abidjan' },
  { cle: 'sud', nom_agence: 'Agence Abidjan Sud', ville: 'Abidjan' },
  { cle: 'bouake', nom_agence: 'Agence Bouaké', ville: 'Bouaké' }
];

// Concessionnaires : un id_distributeur stable par concessionnaire.
const CONCESSIONNAIRES = {
  plateau: { nom: 'Ets Ouattara Distribution', id: 'DIST-001' },
  abobo: { nom: 'SARL Bakary Services', id: 'DIST-002' },
  yopougon: { nom: 'Ets Yao & Fils', id: 'DIST-003' },
  cocody: { nom: 'Groupe Sangaré Négoce', id: 'DIST-004' },
  sud: { nom: 'Ets Diabaté Loisirs', id: 'DIST-005' },
  bouake: { nom: 'SARL Coulibaly Jeux', id: 'DIST-006' }
};

// Communes : agence, couleur de zone, quartiers [lat, lng, sous-zone] (coordonnées approximatives).
const COMMUNES = {
  Abobo: {
    ville: 'Abidjan', agence: 'abobo', couleur: '#E67E22',
    quartiers: {
      'Abobo Gare': [5.417, -4.016, 'Abobo Centre'],
      'Anonkoua-Kouté': [5.431, -4.008, 'Abobo Nord'],
      'Sagbé': [5.425, -4.03, 'Abobo Ouest'],
      'PK 18': [5.448, -4.026, 'Abobo Nord']
    }
  },
  Adjamé: {
    ville: 'Abidjan', agence: 'plateau', couleur: '#8E44AD',
    quartiers: {
      Liberté: [5.35, -4.029, 'Adjamé Centre'],
      Williamsville: [5.362, -4.015, 'Adjamé Nord'],
      '220 Logements': [5.356, -4.025, 'Adjamé Centre']
    }
  },
  Plateau: {
    ville: 'Abidjan', agence: 'plateau', couleur: '#2C3E50',
    quartiers: {
      'Centre des affaires': [5.323, -4.017, 'Plateau'],
      Indénié: [5.32, -4.013, 'Plateau']
    }
  },
  Attécoubé: {
    ville: 'Abidjan', agence: 'plateau', couleur: '#16A085',
    quartiers: { Locodjro: [5.345, -4.05, 'Attécoubé'] }
  },
  Yopougon: {
    ville: 'Abidjan', agence: 'yopougon', couleur: '#C0392B',
    quartiers: {
      Sicogi: [5.342, -4.079, 'Yopougon Est'],
      'Niangon Sud': [5.33, -4.118, 'Yopougon Ouest'],
      Selmer: [5.345, -4.09, 'Yopougon Centre'],
      'Toit Rouge': [5.335, -4.096, 'Yopougon Centre'],
      Millionnaire: [5.338, -4.085, 'Yopougon Est']
    }
  },
  Cocody: {
    ville: 'Abidjan', agence: 'cocody', couleur: '#2980B9',
    quartiers: {
      'Angré 8e Tranche': [5.392, -3.985, 'Cocody Nord'],
      'Riviera Palmeraie': [5.368, -3.96, 'Cocody Est'],
      'Deux-Plateaux Vallon': [5.369, -4.0, 'Cocody Ouest'],
      'Riviera Golf': [5.352, -3.97, 'Cocody Est'],
      Blockhauss: [5.354, -4.003, 'Cocody Ouest']
    }
  },
  Marcory: {
    ville: 'Abidjan', agence: 'sud', couleur: '#27AE60',
    quartiers: {
      'Zone 4': [5.296, -3.988, 'Marcory Zone 4'],
      Anoumabo: [5.298, -3.999, 'Marcory Ouest']
    }
  },
  Treichville: {
    ville: 'Abidjan', agence: 'sud', couleur: '#D35400',
    quartiers: {
      Arras: [5.296, -4.006, 'Treichville Nord'],
      Belleville: [5.287, -4.01, 'Treichville Sud']
    }
  },
  Koumassi: {
    ville: 'Abidjan', agence: 'sud', couleur: '#F39C12',
    quartiers: {
      'Grand Campement': [5.301, -3.954, 'Koumassi Nord'],
      Remblais: [5.29, -3.95, 'Koumassi Sud']
    }
  },
  'Port-Bouët': {
    ville: 'Abidjan', agence: 'sud', couleur: '#1ABC9C',
    quartiers: {
      Gonzagueville: [5.256, -3.902, 'Port-Bouët Est'],
      Adjouffou: [5.26, -3.942, 'Port-Bouët Ouest']
    }
  },
  Bouaké: {
    ville: 'Bouaké', agence: 'bouake', couleur: '#7F8C8D',
    quartiers: {
      Commerce: [7.69, -5.03, 'Bouaké Centre'],
      'Air France 1': [7.702, -5.021, 'Bouaké Nord'],
      Koko: [7.685, -5.045, 'Bouaké Ouest'],
      Belleville: [7.678, -5.025, 'Bouaké Sud']
    }
  }
};

// ---------------------------------------------------------------------------
// Utilisateurs : noms africains / ivoiriens
// ---------------------------------------------------------------------------
const CHEFS_ZONE = {
  nord: { nom: 'Koné', prenom: 'Lacina' },
  ouest: { nom: 'Ouattara', prenom: 'Mamadou' },
  est_sud: { nom: 'N\'Guessan', prenom: 'Kouadio' },
  centre: { nom: 'Bamba', prenom: 'Aminata' }
};

const SUPERVISEURS = {
  s_abobo: { nom: 'Traoré', prenom: 'Drissa', chef: 'nord' },
  s_adjame: { nom: 'Sangaré', prenom: 'Awa', chef: 'nord' },
  s_yopougon: { nom: 'Yéo', prenom: 'Souleymane', chef: 'ouest' },
  s_cocody: { nom: 'Gbané', prenom: 'Fatoumata', chef: 'est_sud' },
  s_sud: { nom: 'Dago', prenom: 'Kouakou', chef: 'est_sud' },
  s_bouake: { nom: 'Fofana', prenom: 'Bakary', chef: 'centre' }
};

// Chaque commercial couvre une ou deux communes ; son agence = celle de sa première commune.
const COMMERCIAUX = [
  { nom: 'Kouassi', prenom: 'Koffi', sup: 's_abobo', communes: ['Abobo'] },
  { nom: 'Aka', prenom: 'Adjoua', sup: 's_abobo', communes: ['Abobo'] },
  { nom: 'Brou', prenom: 'Yao', sup: 's_adjame', communes: ['Adjamé', 'Attécoubé'] },
  { nom: 'Soro', prenom: 'Ibrahim', sup: 's_adjame', communes: ['Plateau', 'Adjamé'] },
  { nom: 'Silué', prenom: 'Nagnima', sup: 's_yopougon', communes: ['Yopougon'] },
  { nom: 'Touré', prenom: 'Moussa', sup: 's_yopougon', communes: ['Yopougon'] },
  { nom: 'Cissé', prenom: 'Mariam', sup: 's_cocody', communes: ['Cocody'] },
  { nom: 'Diomandé', prenom: 'Yacouba', sup: 's_cocody', communes: ['Cocody'] },
  { nom: 'Doumbia', prenom: 'Adama', sup: 's_sud', communes: ['Marcory', 'Treichville'] },
  { nom: 'Konaté', prenom: 'Zeinab', sup: 's_sud', communes: ['Koumassi', 'Port-Bouët'] },
  { nom: 'Bley', prenom: 'Amenan', sup: 's_bouake', communes: ['Bouaké'] },
  { nom: 'N\'Dri', prenom: 'Affoué', sup: 's_bouake', communes: ['Bouaké'] }
];

const RESPONSABLES_AGENCE = {
  plateau: { nom: 'Camara', prenom: 'Fanta' },
  abobo: { nom: 'Diallo', prenom: 'Ousmane' },
  yopougon: { nom: 'Ouédraogo', prenom: 'Rasmané' },
  cocody: { nom: 'Sylla', prenom: 'Kadiatou' },
  sud: { nom: 'Kamagaté', prenom: 'Issouf' },
  bouake: { nom: 'Koffi', prenom: 'Amoin' }
};

// Vendeurs (gérants des points de vente)
const PRENOMS_VENDEURS = [
  'Kouadio', 'Aya', 'Yacouba', 'Salimata', 'Konan', 'Affoué', 'Seydou', 'Mariam', 'Kouamé', 'Awa',
  'Lassina', 'Aminata', 'Adama', 'Nafissatou', 'Ismaël', 'Akissi', 'Souleymane', 'Djénéba', 'Kader',
  'Rokia', 'Tiémoko', 'Adjoua', 'Fousseni', 'Bintou', 'Amadou', 'Ahou', 'Brahima', 'Assétou', 'Wodjé', 'Aïcha',
  'Zié', 'Nanan', 'Mory', 'Habiba'
];
const NOMS_VENDEURS = [
  'Koffi', 'Yao', 'Kouamé', 'Konan', 'Coulibaly', 'Diabaté', 'Traoré', 'Ouattara', 'Zadi', 'Gnahoré',
  'Tanoh', 'Kouassi', 'Fofana', 'Sanogo', 'Doumbouya', 'Yéo', 'Kacou', 'Ehui', 'Diomandé', 'Bakayoko',
  'Soumahoro', 'Gnamien', 'Assi', 'Ahoussou', 'Kobenan', 'Djaha', 'Sidibé', 'Cissé', 'Touré', 'Koulibaly',
  'Ballo', 'Meité', 'Dosso', 'Silué', 'Bamba'
];

// Appareils réellement courants sur le marché ivoirien
const APPAREILS = [
  { marque: 'TECNO', modele: 'Spark 10' },
  { marque: 'TECNO', modele: 'Camon 19' },
  { marque: 'Infinix', modele: 'Hot 30' },
  { marque: 'Infinix', modele: 'Smart 7' },
  { marque: 'Samsung', modele: 'Galaxy A14' },
  { marque: 'itel', modele: 'A70' },
  { marque: 'Xiaomi', modele: 'Redmi 12' }
];

// ---------------------------------------------------------------------------
// Points de vente : [enseigne, commune, quartier, statut, produits, scénario]
// statut 'brouillon' = dossier créé par le mobile, pas encore complété sur le web.
// ---------------------------------------------------------------------------
const PDV_SPECS = [
  ['Kiosque Tantie Adjoua', 'Abobo', 'Abobo Gare', 'actif', ['PMU - ALR', 'GRATTAGE']],
  ['Maquis Le Rassemblement', 'Abobo', 'Anonkoua-Kouté', 'actif', ['PMU - ALR', 'PMU - PLR', 'SPORTCASH']],
  ['Alimentation Al Baraka', 'Abobo', 'Sagbé', 'actif', ['LOTO BONHEUR EDITEC', 'GRATTAGE']],
  ['Bar Le Djassa', 'Abobo', 'PK 18', 'brouillon', []],

  ['Boutique Djénéba & Fils', 'Adjamé', 'Liberté', 'actif', ['LOTO BONHEUR EDITEC', 'LOTO BONHEUR AIL', 'GRATTAGE']],
  ['Kiosque Marché Gouro', 'Adjamé', '220 Logements', 'inactif', ['PMU - PLR']],
  ['Espace Jeux Williamsville', 'Adjamé', 'Williamsville', 'actif', ['SPORTCASH', 'PMU - ALR']],

  ['Tabac-Presse du Plateau', 'Plateau', 'Centre des affaires', 'actif', ['LOTO BONHEUR AIL', 'GRATTAGE']],
  ['Cafétéria Indénié', 'Plateau', 'Indénié', 'actif', ['SPORTCASH', 'LOTO BONHEUR EDITEC']],

  ['Kiosque Locodjro Espoir', 'Attécoubé', 'Locodjro', 'suspendu', ['PMU - ALR', 'GRATTAGE'], 'sortie_zone_suspendu'],

  ['Maquis Chez Tantie Awa', 'Yopougon', 'Sicogi', 'actif', ['PMU - ALR', 'PMU - PLR', 'SPORTCASH']],
  ['Alimentation Le Bon Voisin', 'Yopougon', 'Niangon Sud', 'actif', ['LOTO BONHEUR EDITEC', 'GRATTAGE']],
  ['Kiosque Selmer Loisirs', 'Yopougon', 'Selmer', 'actif', ['SPORTCASH', 'GRATTAGE'], 'deplacement_en_cours'],
  ['Bar-Dancing Toit Rouge', 'Yopougon', 'Toit Rouge', 'actif', ['PMU - PLR', 'SPORTCASH', 'LOTO BONHEUR AIL']],
  ['Point Chaud Millionnaire', 'Yopougon', 'Millionnaire', 'brouillon', []],

  ['Boutique Angré Services', 'Cocody', 'Angré 8e Tranche', 'actif', ['LOTO BONHEUR EDITEC', 'LOTO BONHEUR AIL', 'GRATTAGE']],
  ['Maquis La Palmeraie', 'Cocody', 'Riviera Palmeraie', 'actif', ['PMU - ALR', 'SPORTCASH'], 'sortie_puis_retour'],
  ['Kiosque Deux-Plateaux Vallon', 'Cocody', 'Deux-Plateaux Vallon', 'actif', ['PMU - PLR', 'GRATTAGE']],
  ['Espace Sport Riviera Golf', 'Cocody', 'Riviera Golf', 'actif', ['SPORTCASH']],
  ['Alimentation Blockhauss', 'Cocody', 'Blockhauss', 'brouillon', []],

  ['Maquis Chez Tonton Bakary', 'Marcory', 'Zone 4', 'actif', ['PMU - ALR', 'PMU - PLR', 'LOTO BONHEUR EDITEC']],
  ['Kiosque Anoumabo', 'Marcory', 'Anoumabo', 'actif', ['GRATTAGE', 'LOTO BONHEUR AIL']],

  ['Bar Chez Nanan', 'Treichville', 'Arras', 'actif', ['PMU - ALR', 'SPORTCASH']],
  ['Boutique Belleville Plus', 'Treichville', 'Belleville', 'suspendu', ['LOTO BONHEUR EDITEC'], 'deplacement_suspendu'],

  ['Kiosque Grand Campement', 'Koumassi', 'Grand Campement', 'actif', ['PMU - PLR', 'GRATTAGE']],
  ['Maquis Les Remblais', 'Koumassi', 'Remblais', 'actif', ['PMU - ALR', 'SPORTCASH', 'LOTO BONHEUR AIL'], 'deplacement_ancien'],

  ['Alimentation Gonzagueville', 'Port-Bouët', 'Gonzagueville', 'actif', ['LOTO BONHEUR EDITEC', 'GRATTAGE']],
  ['Kiosque Adjouffou', 'Port-Bouët', 'Adjouffou', 'brouillon', []],

  ['Maquis Chez Tantie Amenan', 'Bouaké', 'Commerce', 'actif', ['PMU - ALR', 'PMU - PLR', 'SPORTCASH', 'GRATTAGE']],
  ['Boutique Air France Loisirs', 'Bouaké', 'Air France 1', 'actif', ['LOTO BONHEUR EDITEC', 'LOTO BONHEUR AIL']],
  ['Kiosque Koko', 'Bouaké', 'Koko', 'actif', ['SPORTCASH', 'GRATTAGE']],
  ['Bar Le Sahel', 'Bouaké', 'Belleville', 'inactif', ['PMU - ALR']]
];

// ---------------------------------------------------------------------------
// Purge
// ---------------------------------------------------------------------------
async function tableExiste(nom) {
  try {
    await sequelize.getQueryInterface().describeTable(nom);
    return true;
  } catch {
    return false;
  }
}

async function purger() {
  const modeles = [Alerte, Position, Vente, PDVProduit, PdvAttributValeur, PDV, GeofenceZone, Produit, User, Agence];
  if (AVEC_CONFIG) modeles.push(PdvAttribut);

  const tables = [];
  for (const m of modeles) {
    const nom = m.getTableName();
    if (await tableExiste(nom)) tables.push(nom);
  }

  const dialecte = sequelize.getDialect();
  const compte = {};

  if (dialecte === 'sqlite') {
    await sequelize.query('PRAGMA foreign_keys = OFF');
    for (const t of tables) {
      const [[{ n }]] = await sequelize.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      compte[t] = n;
      await sequelize.query(`DELETE FROM \`${t}\``);
      await sequelize.query('DELETE FROM sqlite_sequence WHERE name = ?', { replacements: [t] }).catch(() => {});
    }
    await sequelize.query('PRAGMA foreign_keys = ON');
  } else {
    // Une transaction épingle une seule connexion du pool : nécessaire pour que
    // SET FOREIGN_KEY_CHECKS s'applique bien aux TRUNCATE qui suivent.
    await sequelize.transaction(async (t) => {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
      try {
        for (const nom of tables) {
          const [[{ n }]] = await sequelize.query(`SELECT COUNT(*) AS n FROM \`${nom}\``, { transaction: t });
          compte[nom] = n;
          await sequelize.query(`TRUNCATE TABLE \`${nom}\``, { transaction: t });
        }
      } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
      }
    });
  }

  return compte;
}

// ---------------------------------------------------------------------------
// Génération des positions GPS d'un PDV
// ---------------------------------------------------------------------------
function genererPositions(base, { debut, fin, derive }) {
  const PAS = 10 * MIN;
  const depart = new Date(Math.max(debut.getTime(), fin.getTime() - 4 * HEURE));
  const nb = Math.max(1, Math.floor((fin - depart) / PAS) + 1);
  const lignes = [];

  for (let i = 0; i < nb; i++) {
    const t = new Date(fin.getTime() - (nb - 1 - i) * PAS);
    let cible = base;
    if (derive && t >= derive.debut) {
      const f = Math.min(1, (t - derive.debut) / (20 * MIN));
      cible = {
        lat: base.lat + (derive.cible.lat - base.lat) * f,
        lng: base.lng + (derive.cible.lng - base.lng) * f
      };
    }
    const p = bruitGps(cible.lat, cible.lng, 25);
    const source = choisirPondere(['gps', 'network', 'passive'], [80, 15, 5]);
    lignes.push({
      latitude: arrondir(p.lat),
      longitude: arrondir(p.lng),
      precision: source === 'gps' ? arrondir(entre(4, 30), 2) : arrondir(entre(30, 120), 2),
      horodatage: t,
      source
    });
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Génération des ventes d'un PDV (montants en FCFA)
// ---------------------------------------------------------------------------
const HEURES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const POIDS_HEURES = [2, 3, 3, 4, 5, 5, 4, 3, 3, 4, 5, 6, 6, 4, 2];

function genererVentes(pdv, produitsNoms, debut, fin) {
  if (fin <= debut) return [];
  const jours = (fin - debut) / JOUR;
  const parJour = 1.2 + 0.6 * produitsNoms.length;
  const nb = Math.round(jours * parJour * entre(0.8, 1.2));
  const lignes = [];

  for (let i = 0; i < nb; i++) {
    let horodatage = null;
    for (let essai = 0; essai < 10 && !horodatage; essai++) {
      const jour = new Date(debut.getTime() + alea() * (fin - debut));
      jour.setUTCHours(choisirPondere(HEURES, POIDS_HEURES), entier(0, 59), entier(0, 59), 0);
      if (jour >= debut && jour <= fin) horodatage = jour;
    }
    if (!horodatage) horodatage = new Date(debut.getTime() + alea() * (fin - debut));

    const produit = choisir(produitsNoms);
    const [min, max, pas] = MONTANTS[produit];
    const unites = Math.floor((max - min) / pas);
    // Les petites mises sont beaucoup plus fréquentes que les grosses.
    const rang = Math.floor(Math.pow(alea(), 2.2) * (unites + 1));
    let montant = min + rang * pas;
    let quantite = 1;
    if (produit === 'GRATTAGE') {
      quantite = choisirPondere([1, 2, 3, 5], [55, 25, 12, 8]);
      montant = choisir([200, 500, 1000]) * quantite;
    }

    const p = bruitGps(pdv.lat, pdv.lng, 30);
    lignes.push({
      pdv_id: pdv.id,
      produit,
      nom_concessionnaire: pdv.concessionnaire_nom,
      nom_vendeur: pdv.vendeur_nom,
      contact_vendeur: pdv.contact_vendeur,
      latitude_saisie: arrondir(p.lat),
      longitude_saisie: arrondir(p.lng),
      horodatage,
      statut_sync: 'synchronise',
      montant,
      quantite,
      ville: pdv.ville,
      commune: pdv.commune,
      localite: pdv.quartier,
      quartier: pdv.quartier,
      pays: PAYS,
      code_postal: null
    });
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------
async function main() {
  const cfg = sequelize.config || {};
  const cible = `${sequelize.getDialect()} · ${cfg.database || sequelize.options.storage || '?'}${cfg.host && sequelize.getDialect() !== 'sqlite' ? ' @ ' + cfg.host : ''}`;

  if (EST_PRODUCTION && !args.has('--allow-production')) {
    console.error(`\n✖ NODE_ENV=production : refus de purger la base (${cible}).`);
    console.error('  Ajoutez --allow-production si c\'est vraiment voulu.\n');
    process.exit(1);
  }
  if (!CONFIRME) {
    console.log(`\n⚠  Ce script VIDE la base ${cible} puis la repeuple avec des données de démonstration.`);
    console.log('   Tables purgées : users, agences, produits, pdv, pdv_produits, positions, ventes,');
    console.log('   alertes, geofence_zones, pdv_attribut_valeurs' + (AVEC_CONFIG ? ', pdv_attributs' : '') + '.');
    console.log('\n   Pour confirmer :  npm run seed:reset -- --yes\n');
    process.exit(0);
  }

  console.log(`\n▶ Base cible : ${cible}`);

  // Même ordre que server.js : migrations puis sync (crée les tables manquantes).
  await runMigrations();
  await sequelize.sync();

  // --- Colonnes réellement disponibles sur `pdv` ---------------------------
  // Le contrôleur PDV référence sous_zone, id_distributeur, type_terminal et
  // id_unique ; si le modèle ou la base ne les ont pas encore, on n'écrit pas
  // ces valeurs plutôt que de faire échouer tout le seed.
  const colonnesDb = new Set(Object.keys(await sequelize.getQueryInterface().describeTable(PDV.getTableName())));
  const colonnesModele = new Set(Object.keys(PDV.rawAttributes));
  const OPTIONNELLES = ['id_unique', 'sous_zone', 'id_distributeur', 'type_terminal'];
  const absentes = OPTIONNELLES.filter((c) => !colonnesDb.has(c) || !colonnesModele.has(c));
  const filtrerPdv = (o) => {
    const r = { ...o };
    for (const c of absentes) delete r[c];
    return r;
  };

  // --- 1. Purge --------------------------------------------------------------
  console.log('\n▶ Purge des données existantes…');
  const purge = await purger();
  for (const [table, n] of Object.entries(purge)) {
    if (n > 0) console.log(`  ✔ ${table.padEnd(22)} ${n} ligne(s) supprimée(s)`);
  }
  console.log('  ✔ compteurs auto-increment remis à 1');

  // --- 2. Référentiels -------------------------------------------------------
  console.log('\n▶ Création des référentiels…');
  const produits = {};
  for (const p of PRODUITS) {
    produits[p.nom_produit] = await Produit.create({ ...p, statut: 'actif' });
  }
  console.log(`  ✔ ${PRODUITS.length} produits : ${PRODUITS.map((p) => p.nom_produit).join(' | ')}`);

  const agences = {};
  for (const a of AGENCES) {
    agences[a.cle] = await Agence.create({ nom_agence: a.nom_agence, ville: a.ville, statut: 'actif' });
  }
  console.log(`  ✔ ${AGENCES.length} agences`);

  // --- 3. Utilisateurs -------------------------------------------------------
  console.log('\n▶ Création des utilisateurs…');
  const mdp = {
    admin: await bcrypt.hash('admin123', 10),
    chef_zone: await bcrypt.hash('chefzone123', 10),
    superviseur: await bcrypt.hash('superviseur123', 10),
    commercial: await bcrypt.hash('commercial123', 10),
    agence: await bcrypt.hash('agence123', 10)
  };
  const creerUser = (donnees, role, extra = {}) => {
    const email = donnees.email || creerEmail(donnees.prenom, donnees.nom);
    if (donnees.email) emailsUtilises.add(email);
    return User.create({
      nom: donnees.nom,
      prenom: donnees.prenom,
      email,
      mot_de_passe: mdp[role],
      role,
      statut: 'actif',
      telephone: creerTelephone(),
      ...extra
    });
  };

  const admin = await creerUser({ nom: 'Administrateur', prenom: 'Système', email: 'admin@trackingpdv.com' }, 'admin');

  const chefs = {};
  for (const [cle, d] of Object.entries(CHEFS_ZONE)) chefs[cle] = await creerUser(d, 'chef_zone');

  const superviseurs = {};
  for (const [cle, d] of Object.entries(SUPERVISEURS)) {
    superviseurs[cle] = { user: await creerUser(d, 'superviseur'), chef: d.chef };
  }

  const commerciaux = [];
  for (let i = 0; i < COMMERCIAUX.length; i++) {
    const d = COMMERCIAUX[i];
    const agenceCle = COMMUNES[d.communes[0]].agence;
    const user = await creerUser(d, 'commercial', {
      matricule: `AGT${String(i + 1).padStart(3, '0')}`,
      agence_id: agences[agenceCle].id
    });
    commerciaux.push({ user, sup: d.sup, communes: d.communes, compteur: 0 });
  }

  const comptesAgence = [];
  for (const [cle, d] of Object.entries(RESPONSABLES_AGENCE)) {
    comptesAgence.push(await creerUser(d, 'agence', { agence_id: agences[cle].id }));
  }
  console.log(`  ✔ ${1 + Object.keys(chefs).length + Object.keys(superviseurs).length + commerciaux.length + AGENCES.length} comptes (1 admin, ${Object.keys(chefs).length} chefs de zone, ${Object.keys(superviseurs).length} superviseurs, ${commerciaux.length} commerciaux, ${AGENCES.length} comptes agence)`);

  // --- 4. Préparation des PDV (positions, hiérarchie) ---------------------------
  // Prénoms et noms mélangés séparément : chaque vendeur a un prénom distinct,
  // donc aucun doublon de nom complet parmi les PDV.
  const prenomsMelanges = melanger(PRENOMS_VENDEURS);
  const nomsMelanges = melanger(NOMS_VENDEURS);
  let idxVendeur = 0;
  const nomVendeurSuivant = () => {
    const prenom = prenomsMelanges[idxVendeur % prenomsMelanges.length];
    const nom = nomsMelanges[(idxVendeur * 11) % nomsMelanges.length];
    idxVendeur++;
    return `${prenom} ${nom}`;
  };

  const prepares = PDV_SPECS.map(([enseigne, commune, quartier, statut, produitsNoms, scenario], i) => {
    const c = COMMUNES[commune];
    const [qLat, qLng, sousZone] = c.quartiers[quartier];
    const pos = bruitGps(qLat, qLng, 130);

    // Commercial de la commune, en alternance quand ils sont plusieurs.
    const candidats = commerciaux.filter((x) => x.communes.includes(commune));
    const agent = candidats[i % candidats.length];
    const sup = superviseurs[agent.sup];
    const brouillon = statut === 'brouillon';

    return {
      index: i, enseigne, commune, quartier, sousZone, statut, produitsNoms, scenario, brouillon,
      ville: c.ville, agenceCle: c.agence,
      lat: pos.lat, lng: pos.lng,
      agent, sup,
      chef: chefs[sup.chef]
    };
  });

  // --- 5. Zones geofence : un vrai polygone par commune ---------------------------
  console.log('\n▶ Création des zones geofence…');
  const zones = {};
  for (const [nomCommune, c] of Object.entries(COMMUNES)) {
    const membres = prepares.filter((p) => p.commune === nomCommune);
    if (membres.length === 0) continue;
    // Centre = barycentre des PDV de la commune (et non le centre-ville) : le cercle reste
    // serré autour des points de vente plutôt que de couvrir toute la commune.
    const cLat = membres.reduce((s, p) => s + p.lat, 0) / membres.length;
    const cLng = membres.reduce((s, p) => s + p.lng, 0) / membres.length;
    const maxDist = Math.max(...membres.map((p) => distanceEnMetres(cLat, cLng, p.lat, p.lng)));
    const rayon = Math.max(1500, Math.ceil((maxDist + 500) / 100) * 100);
    const cercle = turf.circle([cLng, cLat], rayon, { steps: 64, units: 'meters' });
    cercle.properties = { centre: [cLng, cLat], rayon };
    const zone = await GeofenceZone.create({
      nom_zone: `Zone ${nomCommune}`,
      type: 'cercle',
      coordonnees: cercle,
      rayon,
      cree_par: admin.id,
      statut: 'actif',
      couleur: c.couleur
    });
    zones[nomCommune] = { zone, centre: { lat: cLat, lng: cLng }, rayon };
  }
  const rayons = Object.values(zones).map((z) => z.rayon);
  console.log(`  ✔ ${Object.keys(zones).length} zones (polygones GeoJSON, rayon de ${Math.min(...rayons) / 1000} à ${Math.max(...rayons) / 1000} km)`);

  // --- 6. PDV + produits + positions + ventes -----------------------------------
  console.log('\n▶ Création des PDV, positions et ventes…');
  const pdvCrees = [];
  const toutesPositions = [];
  const toutesVentes = [];
  const lienProduits = [];
  const alertesData = [];
  let compteurOrdinaires = 0;

  for (const p of prepares) {
    const idTerminal = `and-${hexAleatoire(16)}`;
    const appareil = choisir(APPAREILS);
    const agent = p.agent.user;

    // Dates : les brouillons sont récents ; parmi les PDV actifs "ordinaires", quelques-uns
    // sont tagués aujourd'hui / cette semaine (alimente les compteurs jour/semaine du
    // dashboard) ; tous les autres (dont ceux qui ont une alerte) sont installés depuis
    // plus de 15 jours, donc avant leur première alerte.
    let installation;
    if (p.brouillon) {
      installation = il_y_a(entier(20, 26 * 60) * MIN);
    } else if (p.statut === 'actif' && !p.scenario) {
      const k = compteurOrdinaires++;
      if (k === 0) installation = il_y_a(entier(1, 10) * HEURE);
      else if (k % 5 === 0) installation = il_y_a(entre(2, 6) * JOUR);
      else installation = il_y_a(entre(15, 70) * JOUR);
    } else {
      installation = il_y_a(entre(15, 70) * JOUR);
    }

    // Fenêtre d'activité selon le statut
    let finActivite = MAINTENANT;
    let alerteSpec = null;
    const zoneInfo = zones[p.commune];
    const base = { lat: p.lat, lng: p.lng };
    let derive = null;

    switch (p.scenario) {
      case 'sortie_zone_suspendu': {
        const t = il_y_a(26 * HEURE);
        const lieu = pointHorsZone(zoneInfo, base.lat, base.lng, 300);
        finActivite = t;
        derive = { debut: new Date(t.getTime() - 25 * MIN), cible: lieu };
        alerteSpec = [{ type: 'sortie_zone', t, lieu, statut: 'traitee', notif: true, traite: true,
          commentaire: `${p.enseigne} a quitté sa zone géographique assignée (${zoneInfo.zone.nom_zone}). PDV suspendu automatiquement.`,
          traitement: 'Vendeur joint par téléphone : terminal emporté hors zone. PDV maintenu suspendu jusqu\'à régularisation.' }];
        break;
      }
      case 'deplacement_suspendu': {
        const t = il_y_a(50 * HEURE);
        const lieu = decaler(base.lat, base.lng, 1280, entre(0, 360));
        finActivite = t;
        derive = { debut: new Date(t.getTime() - 25 * MIN), cible: lieu };
        alerteSpec = [{ type: 'deplacement_anormal', t, lieu, statut: 'en_cours', notif: true, traite: false,
          commentaire: `${p.enseigne} détecté à plus de 500 m de sa position initiale. PDV suspendu, vérification en cours.` }];
        break;
      }
      case 'deplacement_en_cours': {
        const t = il_y_a(2 * HEURE);
        const lieu = decaler(base.lat, base.lng, 735, entre(0, 360));
        derive = { debut: new Date(t.getTime() - 20 * MIN), cible: lieu };
        alerteSpec = [{ type: 'deplacement_anormal', t, lieu, statut: 'non_traitee', notif: false, traite: false,
          commentaire: `Position GPS anormale détectée pour ${p.enseigne} (> 500 m de la position initiale).` }];
        break;
      }
      case 'sortie_puis_retour': {
        const t1 = il_y_a(72 * HEURE);
        const t2 = new Date(t1.getTime() + 80 * MIN);
        const dehors = pointHorsZone(zoneInfo, base.lat, base.lng, 200);
        const retour = bruitGps(base.lat, base.lng, 30);
        alerteSpec = [
          { type: 'sortie_zone', t: t1, lieu: dehors, statut: 'traitee', notif: true, traite: true,
            commentaire: `${p.enseigne} est sorti de ${zoneInfo.zone.nom_zone}.`,
            traitement: 'Déplacement ponctuel du vendeur (approvisionnement). Aucune action requise.' },
          { type: 'entree_zone', t: t2, lieu: retour, statut: 'traitee', notif: true, traite: true,
            commentaire: `${p.enseigne} est de retour dans ${zoneInfo.zone.nom_zone}.`,
            traitement: 'Retour en zone constaté, alerte clôturée.' }
        ];
        break;
      }
      case 'deplacement_ancien': {
        const t = il_y_a(10 * JOUR);
        const lieu = decaler(base.lat, base.lng, 640, entre(0, 360));
        alerteSpec = [{ type: 'deplacement_anormal', t, lieu, statut: 'traitee', notif: true, traite: true,
          commentaire: `${p.enseigne} détecté à plus de 500 m de sa position initiale.`,
          traitement: 'Écart lié à un déménagement temporaire du kiosque, confirmé par le vendeur.' }];
        break;
      }
      default:
        if (p.statut === 'inactif') finActivite = il_y_a(entre(3, 6) * JOUR);
    }

    // Objet PDV
    const concess = CONCESSIONNAIRES[p.agenceCle];
    const vendeur = p.brouillon ? null : nomVendeurSuivant();
    // Complétion sur le web : quelques heures à quelques jours après le tagging, mais jamais dans le futur.
    const delaiCompletion = Math.min(entre(0.5, 3) * JOUR, (MAINTENANT - installation) * 0.6);
    const dateCompletion = new Date(installation.getTime() + delaiCompletion);

    const positions = genererPositions(base, { debut: installation, fin: finActivite, derive });
    const derniere = positions[positions.length - 1];

    const donnees = filtrerPdv({
      id_terminal: idTerminal,
      id_unique: p.brouillon ? null : `CI-PDV-${String(p.index + 1).padStart(4, '0')}`,
      nom_pdv: p.brouillon ? `PDV (brouillon) ${idTerminal.slice(0, 8).toUpperCase()}` : p.enseigne,
      msisdn_responsable: p.brouillon ? null : creerTelephone(),
      latitude_creation: arrondir(p.lat),
      longitude_creation: arrondir(p.lng),
      date_installation_app: installation,
      date_creation: installation,
      statut: p.brouillon ? 'actif' : p.statut,
      statut_dossier: p.brouillon ? 'brouillon' : 'complet',
      matricule_agent: agent.matricule,
      date_completion: p.brouillon ? null : dateCompletion,
      complete_par: p.brouillon ? null : agent.id,
      zone_geofence_id: p.brouillon ? null : zoneInfo.zone.id,
      device_info: {
        platform: 'android', version: '2.0.0',
        marque: appareil.marque, modele: appareil.modele,
        accuracy: arrondir(entre(5, 25), 1),
        timestamp: installation.toISOString()
      },
      derniere_position_latitude: derniere.latitude,
      derniere_position_longitude: derniere.longitude,
      derniere_position_date: derniere.horodatage,
      concessionnaire_nom: p.brouillon ? null : concess.nom,
      vendeur_nom: vendeur,
      contact_vendeur: p.brouillon ? null : creerTelephone(),
      id_distributeur: p.brouillon ? null : concess.id,
      sous_zone: p.brouillon ? null : p.sousZone,
      type_terminal: `${appareil.marque} ${appareil.modele}`,
      pays: PAYS,
      ville: p.ville,
      commune: p.commune,
      quartier: p.quartier,
      agence_id: agences[p.agenceCle].id,
      commercial_id: agent.id,
      superviseur_id: p.brouillon ? null : p.sup.user.id,
      chef_zone_id: p.brouillon ? null : p.chef.id,
      cree_par: null
    });

    const pdv = await PDV.create(donnees);
    pdvCrees.push({ ...p, id: pdv.id });

    for (const nom of p.produitsNoms) lienProduits.push({ pdv_id: pdv.id, produit_id: produits[nom].id });
    for (const pos of positions) toutesPositions.push({ ...pos, pdv_id: pdv.id });

    // Ventes : uniquement les dossiers complets, et seulement tant que le PDV était actif.
    if (!p.brouillon) {
      const debutVentes = new Date(Math.max(installation.getTime(), MAINTENANT.getTime() - 30 * JOUR));
      const finVentes = p.statut === 'actif' ? MAINTENANT : finActivite;
      toutesVentes.push(
        ...genererVentes(
          { id: pdv.id, lat: p.lat, lng: p.lng, concessionnaire_nom: concess.nom, vendeur_nom: vendeur,
            contact_vendeur: donnees.contact_vendeur, ville: p.ville, commune: p.commune, quartier: p.quartier },
          p.produitsNoms, debutVentes, finVentes
        )
      );
    }

    // Alertes (avec coordonnées et distances calculées, pas inventées)
    if (alerteSpec) {
      for (const a of alerteSpec) {
        alertesData.push({
          pdv_id: pdv.id,
          // zone_id n'a de sens que pour les alertes de zone (pas pour un déplacement anormal)
          zone_id: a.type === 'deplacement_anormal' ? null : zoneInfo.zone.id,
          type_alerte: a.type,
          distance_metres: arrondir(distanceEnMetres(p.lat, p.lng, a.lieu.lat, a.lieu.lng), 2),
          latitude: arrondir(a.lieu.lat),
          longitude: arrondir(a.lieu.lng),
          horodatage: a.t,
          statut: a.statut,
          traitee_par: a.traite ? p.sup.user.id : null,
          date_traitement: a.traite ? new Date(a.t.getTime() + entre(1, 5) * HEURE) : null,
          commentaire: a.traitement ? `${a.commentaire} — ${a.traitement}` : a.commentaire,
          notification_envoyee: a.notif
        });
      }
    }
  }
  for (const lot of par(lienProduits, 500)) await PDVProduit.bulkCreate(lot);
  for (const lot of par(toutesPositions, 500)) await Position.bulkCreate(lot);
  for (const lot of par(toutesVentes, 500)) await Vente.bulkCreate(lot);
  await Alerte.bulkCreate(alertesData);

  const parStatut = (s) => pdvCrees.filter((p) => (s === 'brouillon' ? p.brouillon : !p.brouillon && p.statut === s)).length;
  console.log(`  ✔ ${pdvCrees.length} PDV : ${parStatut('actif')} actifs, ${parStatut('inactif')} inactifs, ${parStatut('suspendu')} suspendus, ${parStatut('brouillon')} brouillons à compléter`);
  console.log(`  ✔ ${lienProduits.length} liens PDV ↔ produits`);
  console.log(`  ✔ ${toutesPositions.length} positions GPS`);
  console.log(`  ✔ ${toutesVentes.length} ventes (FCFA)`);
  console.log(`  ✔ ${alertesData.length} alertes`);

  if (absentes.length > 0) {
    console.log(`\n⚠  Colonnes non écrites (absentes du modèle PDV ou de la table) : ${absentes.join(', ')}`);
    console.log('   Le contrôleur PDV les utilise (recherche, export, complétude) : ajoutez-les au modèle');
    console.log('   et à une migration, puis relancez ce seed pour les renseigner.');
  }

  // --- Récapitulatif ---------------------------------------------------------------
  console.log('\n✅ Seed terminé. Comptes de démonstration :');
  console.log('   admin        admin@trackingpdv.com                       / admin123');
  console.log(`   chef de zone ${Object.values(chefs)[0].email.padEnd(36)} / chefzone123`);
  console.log(`   superviseur  ${Object.values(superviseurs)[0].user.email.padEnd(36)} / superviseur123`);
  console.log(`   commercial   ${commerciaux[0].user.email.padEnd(36)} / commercial123   (matricule ${commerciaux[0].user.matricule})`);
  console.log(`   agence       ${comptesAgence[0].email.padEnd(36)} / agence123`);
  console.log('   Matricules mobiles : AGT001 … AGT012\n');
}

main()
  .catch((err) => {
    console.error('\n✖ Erreur pendant le seed :', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
