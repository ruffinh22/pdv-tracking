const { PDV, Position, Vente, Alerte, Produit, Agence, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const geocodingService = require('../services/geocodingService');
const pdvAttributService = require('../services/pdvAttributService');
const pdvChampFixeService = require('../services/pdvChampFixeService');
const { distanceEnMetres } = require('../utils/geoUtils');
const { pdvScope, withScope, peutAccederAuPDV } = require('../utils/scope');

// Préfixe du nom provisoire attribué au dossier lors de l'enrôlement mobile,
// en attendant que l'agent saisisse la vraie enseigne depuis le web. Exporté
// pour que le contrôle de complétude et le front s'appuient sur la même règle
// plutôt que sur deux chaînes recopiées.
const PREFIXE_NOM_BROUILLON = 'PDV (brouillon)';

const estNomProvisoire = (nom) =>
  !nom || String(nom).trim() === '' || String(nom).startsWith(PREFIXE_NOM_BROUILLON);

/**
 * Liste les informations manquantes d'un dossier PDV : champs fixes de la
 * fiche, produits vendus, puis attributs personnalisés obligatoires définis
 * par l'admin. Un dossier ne passe en "complet" que si cette liste est vide —
 * le calcul est fait côté serveur pour rester la source de vérité, quel que
 * soit le client.
 *
 * La liste des champs fixes à vérifier n'est plus câblée en dur : elle vient
 * de `pdv_champs_fixes`, administrable depuis Paramètres > Champs PDV. Un
 * admin peut donc décider qu'un champ du mapping standard (Vendeur, Sous-zone,
 * Pays…) n'est plus obligatoire, voire le masquer complètement du formulaire —
 * au prix, assumé, de lignes incomplètes dans l'export CSV partenaire.
 */
async function informationsManquantes(pdv) {
  const champsFixes = await pdvChampFixeService.getObligatoiresVisibles();
  const manquants = [];

  for (const { code, libelle } of champsFixes) {
    // "nom_pdv" et "produits" ne se lisent pas comme une simple colonne vide :
    // le premier a toujours une valeur (le nom provisoire posé à
    // l'enrôlement), le second est une relation, pas une colonne.
    if (code === 'nom_pdv') {
      if (estNomProvisoire(pdv.nom_pdv)) manquants.push(libelle);
      continue;
    }
    if (code === 'produits') {
      const nbProduits = await pdv.countProduits();
      if (nbProduits === 0) manquants.push(libelle);
      continue;
    }
    const valeur = pdv[code];
    if (valeur === null || valeur === undefined || String(valeur).trim() === '') {
      manquants.push(libelle);
    }
  }

  const attributsManquants = await pdvAttributService.manquants(pdv.id);
  return [...manquants, ...attributsManquants];
}

/**
 * Dérive la colonne "Type_Terminal" du mapping standard à partir des
 * informations d'appareil remontées par l'app mobile.
 *
 * Le fichier de mapping attend un modèle d'appareil (« TS10 », « Z100 »), pas
 * une famille : on privilégie donc le modèle réel remonté par le téléphone
 * (« SM-A135F », « iPhone 12 »), et on ne retombe sur le système
 * d'exploitation que si le modèle est indisponible — cas des anciennes
 * versions de l'app, qui n'envoient que la plateforme. Reste modifiable depuis
 * le web si l'agence utilise sa propre nomenclature.
 */
function deriverTypeTerminal(deviceInfo) {
  const modele = String(deviceInfo?.modele || deviceInfo?.model || '').trim();
  if (modele) {
    const marque = String(deviceInfo?.marque || deviceInfo?.brand || '').trim();
    // « Samsung SM-A135F » plutôt que « SM-A135F » seul, sauf quand le modèle
    // porte déjà la marque (« iPhone 12 » chez Apple).
    return marque && !modele.toLowerCase().startsWith(marque.toLowerCase())
      ? `${marque} ${modele}`.slice(0, 50)
      : modele.slice(0, 50);
  }

  const plateforme = String(deviceInfo?.platform || '').toLowerCase();
  if (plateforme === 'android') return 'Smartphone Android';
  if (plateforme === 'ios') return 'Smartphone iOS';
  return null;
}

/**
 * Pour les rôles à périmètre restreint, force automatiquement le champ de
 * hiérarchie correspondant sur le PDV créé/modifié afin qu'un utilisateur ne
 * puisse jamais taguer un PDV en dehors de son propre espace (ex: un
 * commercial ne peut pas s'assigner un PDV à un autre commercial).
 */
function appliquerProprietaire(user, payload) {
  if (!user) return payload;
  if (user.role === 'commercial') return { ...payload, commercial_id: user.userId };
  if (user.role === 'agence') return { ...payload, agence_id: user.agence_id || null };
  if (user.role === 'superviseur') return { ...payload, superviseur_id: user.userId };
  if (user.role === 'chef_zone') return { ...payload, chef_zone_id: user.userId };
  return payload;
}

// Inclusions standard pour renvoyer un PDV complet (hiérarchie + produits tagués)
const INCLUDE_PDV_COMPLET = [
  'zone',
  { model: Agence, as: 'agence' },
  { model: User, as: 'commercial', attributes: ['id', 'nom', 'prenom'] },
  { model: User, as: 'superviseur', attributes: ['id', 'nom', 'prenom'] },
  { model: User, as: 'chefZone', attributes: ['id', 'nom', 'prenom'] },
  { model: Produit, as: 'produits', attributes: ['id', 'nom_produit'], through: { attributes: [] } }
];

/**
 * Associe la liste de produits vendus (choix multiples) à un PDV.
 * `produitsIds` peut être un tableau d'IDs ou de noms de produits.
 */
async function synchroniserProduits(pdv, produitsIds) {
  if (!Array.isArray(produitsIds)) return;

  let ids = produitsIds;
  // Tolère l'envoi de noms de produits plutôt que d'IDs
  if (ids.length > 0 && typeof ids[0] === 'string' && isNaN(Number(ids[0]))) {
    const produits = await Produit.findAll({ where: { nom_produit: ids } });
    ids = produits.map(p => p.id);
  }

  await pdv.setProduits(ids);
}

/**
 * Complète automatiquement pays/ville/commune/quartier par géocodage inverse
 * lorsque ces champs ne sont pas fournis explicitement.
 *
 * Le géocodage dépend d'un service externe : il peut échouer au moment précis
 * de l'enrôlement (réseau, quota, coordonnées en pleine brousse). L'échec n'est
 * jamais bloquant — le dossier est créé quand même — mais les champs
 * géographiques restent alors vides. C'est la raison d'être de
 * `regeocoderPDV` : rejouer l'opération depuis le back-office sans avoir à
 * renvoyer quelqu'un sur le terrain.
 */
async function completerLocalisation(payload) {
  if (payload.pays || payload.ville) {
    return payload; // Renseigné manuellement, on ne l'écrase pas
  }
  if (!payload.latitude_creation || !payload.longitude_creation) {
    return payload;
  }
  try {
    const info = await geocodingService.reverseGeocode(payload.latitude_creation, payload.longitude_creation);
    return {
      ...payload,
      pays: info.pays || payload.pays,
      ville: info.ville || payload.ville,
      commune: info.commune || payload.commune,
      quartier: info.quartier || payload.quartier
    };
  } catch (error) {
    logger.error('Géocodage automatique du PDV impossible:', error);
    return payload;
  }
}

const pdvController = {
  // Routes mobiles sans auth
  /**
   * Upsert en un seul aller-retour réseau : évite le pattern "login qui échoue
   * puis register" qui coûtait 2 requêtes séquentielles à chaque création de
   * compte (le principal facteur de lenteur perçue à l'onboarding). Renvoie le
   * PDV existant s'il y en a un pour ce msisdn, sinon en crée un nouveau.
   */
  /**
   * Enrôlement d'un PDV depuis l'app mobile.
   *
   * L'agent commercial saisit son matricule sur le terminal installé au point
   * de vente et appuie sur "Se connecter". L'app envoie ici trois choses : le
   * matricule, l'identifiant unique du terminal (généré et persisté par l'app,
   * voir mobile/src/lib/terminalId.ts) et les coordonnées GPS relevées sur
   * place. Le serveur crée alors un dossier PDV à l'état "brouillon", rattaché
   * à l'agent, que celui-ci complètera ensuite depuis le back-office.
   *
   * L'opération est idempotente sur `id_terminal` : relancer la connexion
   * depuis le même appareil retombe toujours sur le même dossier, ce qui évite
   * les doublons si l'agent réessaie après une coupure réseau.
   */
  async mobileEnroll(req, res) {
    try {
      const { matricule, terminal_id, latitude, longitude, device_info, nom_pdv } = req.body;

      if (!matricule || !String(matricule).trim()) {
        return res.status(400).json({ error: 'Le numéro matricule est requis' });
      }
      if (!terminal_id) {
        return res.status(400).json({ error: "L'identifiant du terminal est requis" });
      }
      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        return res.status(400).json({
          error: 'Position GPS requise. Activez la localisation puis réessayez.'
        });
      }

      // Le matricule est la seule chose que l'agent tape : on le compare sans
      // tenir compte de la casse ni des espaces parasites, sources d'erreurs
      // fréquentes sur un clavier de téléphone en extérieur.
      const matriculeNormalise = String(matricule).trim().toUpperCase();
      const agent = await User.findOne({
        where: sequelize.where(
          sequelize.fn('UPPER', sequelize.col('matricule')),
          matriculeNormalise
        )
      });

      if (!agent) {
        return res.status(404).json({ error: 'Matricule inconnu. Vérifiez votre numéro matricule.' });
      }
      if (agent.statut !== 'actif') {
        return res.status(403).json({ error: 'Ce compte agent est désactivé.' });
      }

      const positionDuJour = {
        derniere_position_latitude: latitude,
        derniere_position_longitude: longitude,
        derniere_position_date: new Date()
      };

      // Terminal déjà enrôlé : on rafraîchit sa position et on renvoie le
      // dossier existant, sans jamais écraser les informations déjà saisies
      // par l'agent depuis le web.
      const existant = await PDV.findOne({ where: { id_terminal: terminal_id } });
      if (existant) {
        await existant.update(positionDuJour);
        return res.json({
          ...existant.toJSON(),
          _existing: true,
          agent: { id: agent.id, nom: agent.nom, prenom: agent.prenom, matricule: agent.matricule }
        });
      }

      const payload = await completerLocalisation({
        // Nom provisoire, lisible dans la liste des brouillons du back-office
        // en attendant que l'agent saisisse le vrai nom de l'enseigne. Le
        // préfixe est reconnu par `estNomProvisoire` : tant qu'il est là, le
        // dossier ne peut pas basculer en "complet".
        nom_pdv: nom_pdv || `${PREFIXE_NOM_BROUILLON} ${String(terminal_id).slice(0, 8).toUpperCase()}`,
        id_terminal: terminal_id,
        // Colonne "Type_Terminal" du mapping standard : dérivée du système
        // d'exploitation remonté par l'app, faute d'une nomenclature métier
        // encore définie. Reste modifiable depuis le web si besoin.
        type_terminal: deriverTypeTerminal(device_info),
        matricule_agent: agent.matricule,
        commercial_id: agent.id,
        // L'agence de rattachement de l'agent sert de valeur par défaut quand
        // elle est connue : une information de moins à ressaisir sur le web.
        agence_id: agent.agence_id || null,
        latitude_creation: latitude,
        longitude_creation: longitude,
        statut: 'actif',
        statut_dossier: 'brouillon',
        device_info,
        ...positionDuJour
      });

      let pdv;
      try {
        pdv = await PDV.create(payload);
      } catch (error) {
        // Deux requêtes d'enrôlement parties en parallèle (double appui sur
        // "Se connecter", rejeu après un timeout réseau) passent toutes les
        // deux le test d'existence ci-dessus avant qu'aucune n'ait écrit.
        // L'index unique sur `id_terminal` tranche : le perdant récupère le
        // dossier du gagnant au lieu de renvoyer une erreur 500 à l'agent.
        if (error?.name === 'SequelizeUniqueConstraintError') {
          const concurrent = await PDV.findOne({ where: { id_terminal: terminal_id } });
          if (concurrent) {
            await concurrent.update(positionDuJour);
            return res.json({
              ...concurrent.toJSON(),
              _existing: true,
              agent: { id: agent.id, nom: agent.nom, prenom: agent.prenom, matricule: agent.matricule }
            });
          }
        }
        throw error;
      }

      logger.info(
        `PDV enrôlé en brouillon depuis le mobile: terminal ${terminal_id} par ${agent.matricule}`
      );

      res.status(201).json({
        ...pdv.toJSON(),
        _existing: false,
        agent: { id: agent.id, nom: agent.nom, prenom: agent.prenom, matricule: agent.matricule }
      });
    } catch (error) {
      logger.error("Erreur lors de l'enrôlement mobile du PDV:", error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Ancien point d'entrée mobile, conservé pour les versions de l'app déjà
   * déployées sur le terrain : il délègue à l'enrôlement ci-dessus quand un
   * matricule est fourni, et retombe sinon sur l'identification par terminal
   * seul. À supprimer une fois le parc mis à jour.
   */
  async mobileUpsert(req, res) {
    if (req.body && req.body.matricule) {
      return pdvController.mobileEnroll(req, res);
    }

    try {
      const { nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, device_info } = req.body;

      if (!msisdn_responsable) {
        return res.status(400).json({ error: 'msisdn_responsable requis' });
      }

      const existingPDV = await PDV.findOne({
        where: { [Op.or]: [{ msisdn_responsable }, { id_terminal: msisdn_responsable }] }
      });
      if (existingPDV) {
        return res.json({ ...existingPDV.toJSON(), _existing: true });
      }

      const payload = await completerLocalisation({
        nom_pdv: nom_pdv || `PDV ${msisdn_responsable}`,
        id_terminal: msisdn_responsable,
        latitude_creation,
        longitude_creation,
        statut: 'actif',
        statut_dossier: 'brouillon',
        device_info,
        derniere_position_latitude: latitude_creation,
        derniere_position_longitude: longitude_creation,
        derniere_position_date: new Date(),
      });

      const pdv = await PDV.create(payload);
      logger.info(`Nouveau PDV mobile enregistré: ${pdv.nom_pdv} (${msisdn_responsable})`);
      res.status(201).json({ ...pdv.toJSON(), _existing: false });
    } catch (error) {
      logger.error("Erreur lors de l'upsert mobile du PDV:", error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Vérifie un matricule avant même l'enrôlement, pour que l'app mobile puisse
   * dire "Bonjour Jean Dupont" (ou signaler une faute de frappe) dès la saisie,
   * plutôt qu'après avoir attendu le relevé GPS.
   */
  async mobileVerifierMatricule(req, res) {
    try {
      const matricule = String(req.params.matricule || '').trim().toUpperCase();
      if (!matricule) {
        return res.status(400).json({ error: 'Matricule requis' });
      }

      const agent = await User.findOne({
        where: sequelize.where(sequelize.fn('UPPER', sequelize.col('matricule')), matricule),
        attributes: ['id', 'nom', 'prenom', 'matricule', 'statut']
      });

      if (!agent || agent.statut !== 'actif') {
        return res.status(404).json({ error: 'Matricule inconnu' });
      }

      res.json({ id: agent.id, nom: agent.nom, prenom: agent.prenom, matricule: agent.matricule });
    } catch (error) {
      logger.error('Erreur lors de la vérification du matricule:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileRegister(req, res) {
    try {
      const { nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, device_info } = req.body;

      // Vérifier si le MSISDN existe déjà
      const existingPDV = await PDV.findOne({ where: { msisdn_responsable } });
      if (existingPDV) {
        return res.status(400).json({ error: 'Ce MSISDN est déjà enregistré' });
      }

      const payload = await completerLocalisation({
        nom_pdv: nom_pdv || `PDV ${msisdn_responsable}`,
        msisdn_responsable,
        latitude_creation,
        longitude_creation,
        statut: 'actif',
        device_info,
        derniere_position_latitude: latitude_creation,
        derniere_position_longitude: longitude_creation,
        derniere_position_date: new Date()
      });

      const pdv = await PDV.create(payload);

      logger.info(`Nouveau PDV mobile enregistré: ${pdv.nom_pdv} (${msisdn_responsable})`);
      res.status(201).json(pdv);
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement mobile du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async mobileLogin(req, res) {
    try {
      const { msisdn } = req.body;

      const pdv = await PDV.findOne({ where: { msisdn_responsable: msisdn } });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }

      res.json(pdv);
    } catch (error) {
      logger.error('Erreur lors de la connexion mobile:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createPDV(req, res) {
    const t = await sequelize.transaction();
    try {
      const { produits_ids, attributs, ...pdvData } = req.body;
      const payload = await completerLocalisation(appliquerProprietaire(req.user, pdvData));

      const pdv = await PDV.create(payload, { transaction: t });
      await t.commit();

      if (produits_ids) {
        await synchroniserProduits(pdv, produits_ids);
      }
      if (attributs) {
        await pdvAttributService.enregistrerValeurs(pdv.id, attributs);
      }

      // Un PDV saisi directement depuis le back-office est en général complet
      // dès sa création : on applique la même règle de calcul que partout
      // ailleurs plutôt que de le laisser artificiellement en brouillon.
      const manquants = await informationsManquantes(pdv);
      if (manquants.length === 0) {
        await pdv.update({
          statut_dossier: 'complet',
          date_completion: new Date(),
          complete_par: req.user?.userId || null
        });
      }

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });

      logger.info(`Nouveau PDV créé: ${pdv.nom_pdv}`);
      res.status(201).json(pdvComplet);
    } catch (error) {
      // `finished` n'est pas positionné par toutes les versions de Sequelize :
      // on tente le rollback et on ignore l'échec si la transaction est déjà close.
      await t.rollback().catch(() => {});
      logger.error('Erreur lors de la création du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAllPDVs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Filtres utilisés notamment par les analyses du dashboard
      const {
        statut, statut_dossier, ville, commune, quartier, pays,
        agence_id, commercial_id, superviseur_id, chef_zone_id, produit_id,
        sous_zone, search
      } = req.query;

      const where = {};
      if (statut) where.statut = statut;
      // Permet au back-office d'isoler la file des dossiers à compléter
      // (?statut_dossier=brouillon), qui est le point d'entrée quotidien de
      // l'agent commercial après une tournée d'installation.
      if (statut_dossier) where.statut_dossier = statut_dossier;
      if (ville) where.ville = ville;
      if (commune) where.commune = commune;
      if (quartier) where.quartier = quartier;
      if (pays) where.pays = pays;
      if (agence_id) where.agence_id = agence_id;
      if (commercial_id) where.commercial_id = commercial_id;
      if (superviseur_id) where.superviseur_id = superviseur_id;
      if (chef_zone_id) where.chef_zone_id = chef_zone_id;
      if (sous_zone) where.sous_zone = sous_zone;
      if (search) {
        // La recherche couvre aussi les identifiants du mapping standard :
        // c'est par l'ID unique ou l'ID distributeur qu'un partenaire désigne
        // un point de vente quand il revient vers nous sur un dossier.
        where[Op.or] = [
          { nom_pdv: { [Op.like]: `%${search}%` } },
          { id_unique: { [Op.like]: `%${search}%` } },
          { msisdn_responsable: { [Op.like]: `%${search}%` } },
          { id_terminal: { [Op.like]: `%${search}%` } },
          { matricule_agent: { [Op.like]: `%${search}%` } },
          { vendeur_nom: { [Op.like]: `%${search}%` } },
          { contact_vendeur: { [Op.like]: `%${search}%` } },
          { sous_zone: { [Op.like]: `%${search}%` } },
          { id_distributeur: { [Op.like]: `%${search}%` } }
        ];
      }

      // Périmètre de données : chaque rôle ne voit que les PDV de son espace.
      const whereScoped = withScope(where, pdvScope(req.user));

      const include = [...INCLUDE_PDV_COMPLET, 'positions'];
      if (produit_id) {
        include[include.length - 2] = {
          model: Produit,
          as: 'produits',
          attributes: ['id', 'nom_produit'],
          through: { attributes: [] },
          where: { id: produit_id }
        };
      }

      const { count, rows: pdvs } = await PDV.findAndCountAll({
        where: whereScoped,
        include,
        limit,
        offset,
        distinct: true
      });

      res.json({
        data: pdvs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVById(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id, {
        include: [...INCLUDE_PDV_COMPLET, 'positions', 'ventes', 'alertes']
      });
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      // Le formulaire de complétion a besoin, en un seul appel : la fiche, les
      // champs personnalisés administrés par l'admin (avec leur valeur
      // courante) et ce qu'il reste à renseigner pour valider le dossier.
      const [attributs, manquants] = await Promise.all([
        pdvAttributService.chargerPourPDV(pdv.id),
        informationsManquantes(pdv)
      ]);

      res.json({ ...pdv.toJSON(), attributs_personnalises: attributs, informations_manquantes: manquants });
    } catch (error) {
      logger.error('Erreur lors de la récupération du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async updatePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const { produits_ids, attributs, statut_dossier, ...pdvData } = req.body;
      // Même verrou qu'à la création (voir appliquerProprietaire) : sans ça,
      // un commercial qui modifie un de ses PDV pourrait — via le payload
      // brut envoyé par le client — se retrouver avec un commercial_id
      // différent du sien, ou pire, réassigner le dossier à quelqu'un d'autre.
      await pdv.update(appliquerProprietaire(req.user, pdvData));

      if (produits_ids) {
        await synchroniserProduits(pdv, produits_ids);
      }
      if (attributs) {
        await pdvAttributService.enregistrerValeurs(pdv.id, attributs);
      }

      await pdv.reload();
      // `statut_dossier` n'est jamais pris tel quel depuis le client : il est
      // recalculé à partir de ce qui est réellement renseigné, pour qu'un
      // dossier ne puisse pas être marqué "complet" alors qu'il ne l'est pas.
      const manquants = await informationsManquantes(pdv);
      const nouvelEtat = manquants.length === 0 ? 'complet' : 'brouillon';
      if (nouvelEtat !== pdv.statut_dossier) {
        await pdv.update({
          statut_dossier: nouvelEtat,
          ...(nouvelEtat === 'complet'
            ? { date_completion: new Date(), complete_par: req.user?.userId || null }
            : { date_completion: null })
        });
      }

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });
      const attributsCharges = await pdvAttributService.chargerPourPDV(pdv.id);
      res.json({
        ...pdvComplet.toJSON(),
        attributs_personnalises: attributsCharges,
        informations_manquantes: manquants
      });
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Complétion d'un dossier de PDV enrôlé depuis le mobile.
   *
   * C'est l'action que réalise l'agent commercial depuis le back-office après
   * une tournée : il reprend le brouillon créé sur le terrain (terminal + GPS)
   * et renseigne le reste — nom et prénom du vendeur, agence de rattachement,
   * superviseur, produits vendus, et tous les champs personnalisés que
   * l'administrateur a définis.
   *
   * Même logique que updatePDV, avec une réponse explicite sur ce qui manque
   * encore : l'interface peut ainsi enregistrer un dossier partiellement
   * rempli (il reste en brouillon) sans perdre le travail de l'agent.
   */
  async completerPDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const { produits_ids, attributs, statut_dossier, id_terminal, ...pdvData } = req.body;

      // `id_terminal` est volontairement ignoré : il identifie l'appareil posé
      // sur le terrain et ne doit pas pouvoir être réécrit depuis le web.
      // Même verrou qu'à la création : un commercial qui complète son dossier
      // reste rattaché à lui-même, quoi qu'envoie le client — c'est ce qui
      // garantit que le dossier réapparaît bien dans "mes PDV" une fois
      // enregistré, même s'il avait été créé sans commercial_id.
      await pdv.update(appliquerProprietaire(req.user, pdvData));

      if (produits_ids) {
        await synchroniserProduits(pdv, produits_ids);
      }
      if (attributs) {
        await pdvAttributService.enregistrerValeurs(pdv.id, attributs);
      }

      await pdv.reload();
      const manquants = await informationsManquantes(pdv);
      const estComplet = manquants.length === 0;

      await pdv.update({
        statut_dossier: estComplet ? 'complet' : 'brouillon',
        date_completion: estComplet ? pdv.date_completion || new Date() : null,
        complete_par: estComplet ? pdv.complete_par || req.user?.userId || null : null
      });

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });
      const attributsCharges = await pdvAttributService.chargerPourPDV(pdv.id);

      logger.info(
        `Dossier PDV #${pdv.id} enregistré par l'utilisateur ${req.user?.userId} — état: ${estComplet ? 'complet' : 'brouillon'}`
      );

      res.json({
        ...pdvComplet.toJSON(),
        attributs_personnalises: attributsCharges,
        informations_manquantes: manquants
      });
    } catch (error) {
      logger.error('Erreur lors de la complétion du dossier PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Rejoue le géocodage inverse d'un dossier à partir des coordonnées relevées
   * à l'enrôlement, et renvoie les valeurs trouvées.
   *
   * L'enrôlement mobile tente déjà ce remplissage automatique, mais il dépend
   * d'un service externe qui peut être indisponible à cet instant précis. Sans
   * cette reprise, un dossier géocodé en échec obligeait l'agent à ressaisir
   * pays/ville/commune/quartier à la main alors que la position exacte du point
   * de vente est connue.
   *
   * Le résultat n'écrase jamais une saisie manuelle : les champs déjà
   * renseignés sont conservés, sauf demande explicite (`force: true`).
   */
  async regeocoderPDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      if (pdv.latitude_creation === null || pdv.longitude_creation === null) {
        return res.status(400).json({
          error: "Ce dossier n'a pas de coordonnées GPS d'enrôlement."
        });
      }

      let info;
      try {
        info = await geocodingService.reverseGeocode(
          pdv.latitude_creation,
          pdv.longitude_creation
        );
      } catch (error) {
        logger.error('Re-géocodage impossible pour le PDV %s:', pdv.id, error);
        return res.status(502).json({
          error: 'Le service de géolocalisation est momentanément indisponible. Réessayez ou saisissez les champs à la main.'
        });
      }

      const force = req.body?.force === true;
      const aRemplir = {};
      for (const champ of ['pays', 'ville', 'commune', 'quartier']) {
        const trouve = info?.[champ];
        if (!trouve) continue;
        const actuel = pdv[champ];
        if (force || actuel === null || actuel === undefined || String(actuel).trim() === '') {
          aRemplir[champ] = trouve;
        }
      }

      if (Object.keys(aRemplir).length === 0) {
        return res.json({
          ...pdv.toJSON(),
          champs_remplis: [],
          message: 'Aucun champ géographique supplémentaire n\'a pu être déduit de ces coordonnées.'
        });
      }

      await pdv.update(aRemplir);
      await pdv.reload();

      // La localisation fait partie des informations requises : remplir
      // pays/ville peut suffire à valider le dossier, on recalcule donc l'état.
      const manquants = await informationsManquantes(pdv);
      const nouvelEtat = manquants.length === 0 ? 'complet' : 'brouillon';
      if (nouvelEtat !== pdv.statut_dossier) {
        await pdv.update({
          statut_dossier: nouvelEtat,
          ...(nouvelEtat === 'complet'
            ? { date_completion: new Date(), complete_par: req.user?.userId || null }
            : { date_completion: null })
        });
      }

      res.json({
        ...pdv.toJSON(),
        champs_remplis: Object.keys(aRemplir),
        informations_manquantes: manquants
      });
    } catch (error) {
      logger.error('Erreur lors du re-géocodage du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Met à jour uniquement les produits vendus par un PDV (choix multiples)
  async updatePDVProduits(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const { produits_ids } = req.body;
      if (!Array.isArray(produits_ids)) {
        return res.status(400).json({ error: 'produits_ids doit être un tableau' });
      }

      await synchroniserProduits(pdv, produits_ids);

      const pdvComplet = await PDV.findByPk(pdv.id, { include: INCLUDE_PDV_COMPLET });
      res.json(pdvComplet);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour des produits du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async deletePDV(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      await pdv.destroy();
      res.json({ message: 'PDV supprimé avec succès' });
    } catch (error) {
      logger.error('Erreur lors de la suppression du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Historique de positions d'un PDV pour la carte de suivi.
   *
   * Le tracking remonte un point toutes les 30 secondes, soit ~2 880 points
   * par jour et par terminal : renvoyer l'historique complet sans borne
   * saturerait la réponse et la carte au bout de quelques jours. On borne donc
   * systématiquement par période (24 h glissantes par défaut) et on échantillonne
   * régulièrement au-delà d'un plafond de points, ce qui préserve la forme du
   * trajet tout en gardant une réponse de taille constante.
   *
   * Paramètres : ?debut=ISO &fin=ISO &limit=N (100..5000)
   */
  async getPDVPositions(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const fin = req.query.fin ? new Date(req.query.fin) : new Date();
      const debut = req.query.debut
        ? new Date(req.query.debut)
        : new Date(fin.getTime() - 24 * 60 * 60 * 1000);

      if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
        return res.status(400).json({ error: 'Période invalide' });
      }

      const plafond = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 100), 5000);

      // On compte d'abord pour décider du pas d'échantillonnage, plutôt que de
      // charger toutes les lignes en mémoire pour en jeter la majorité ensuite.
      const total = await Position.count({
        where: { pdv_id: pdv.id, horodatage: { [Op.between]: [debut, fin] } }
      });

      const positions = await Position.findAll({
        where: { pdv_id: pdv.id, horodatage: { [Op.between]: [debut, fin] } },
        order: [['horodatage', 'ASC']],
        attributes: ['id', 'latitude', 'longitude', 'precision', 'horodatage', 'source']
      });

      const pas = total > plafond ? Math.ceil(total / plafond) : 1;
      const echantillon = pas === 1 ? positions : positions.filter((_, i) => i % pas === 0);

      // Le dernier point est toujours conservé : c'est la position courante,
      // celle qui compte le plus sur une carte de suivi, et l'échantillonnage
      // régulier a de bonnes chances de la sauter.
      if (pas > 1 && positions.length > 0) {
        const dernier = positions[positions.length - 1];
        if (echantillon[echantillon.length - 1]?.id !== dernier.id) {
          echantillon.push(dernier);
        }
      }

      res.json({
        data: echantillon,
        periode: { debut, fin },
        total,
        retournes: echantillon.length,
        echantillonnage: pas
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des positions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Synthèse du déplacement d'un terminal sur une période : distance
   * parcourue, éloignement maximal du point d'ancrage, plage horaire couverte.
   *
   * Ces chiffres répondent à la question que se pose réellement un superviseur
   * en regardant la carte — « ce terminal est-il resté au point de vente ? » —
   * sans qu'il ait à interpréter lui-même un tracé.
   */
  async getPDVTrajet(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }

      const fin = req.query.fin ? new Date(req.query.fin) : new Date();
      const debut = req.query.debut
        ? new Date(req.query.debut)
        : new Date(fin.getTime() - 24 * 60 * 60 * 1000);

      const positions = await Position.findAll({
        where: { pdv_id: pdv.id, horodatage: { [Op.between]: [debut, fin] } },
        order: [['horodatage', 'ASC']],
        attributes: ['latitude', 'longitude', 'horodatage']
      });

      const ancrageLat = Number(pdv.latitude_creation);
      const ancrageLng = Number(pdv.longitude_creation);

      let distanceTotale = 0;
      let eloignementMax = 0;

      for (let i = 0; i < positions.length; i++) {
        const lat = Number(positions[i].latitude);
        const lng = Number(positions[i].longitude);

        if (i > 0) {
          const precedent = positions[i - 1];
          const saut = distanceEnMetres(
            Number(precedent.latitude),
            Number(precedent.longitude),
            lat,
            lng
          );
          // Un saut de plus de 2 km entre deux points espacés de 30 s
          // correspond à une dérive GPS, pas à un déplacement réel : l'inclure
          // gonflerait artificiellement la distance parcourue.
          if (saut < 2000) distanceTotale += saut;
        }

        const ecart = distanceEnMetres(ancrageLat, ancrageLng, lat, lng);
        if (ecart > eloignementMax) eloignementMax = ecart;
      }

      res.json({
        pdv_id: pdv.id,
        periode: { debut, fin },
        points: positions.length,
        distance_parcourue_m: Math.round(distanceTotale),
        eloignement_max_m: Math.round(eloignementMax),
        premiere_position: positions[0]?.horodatage || null,
        derniere_position: positions[positions.length - 1]?.horodatage || null,
        point_ancrage: { latitude: ancrageLat, longitude: ancrageLng }
      });
    } catch (error) {
      logger.error('Erreur lors du calcul du trajet du PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVVentes(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const ventes = await Vente.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVAlertes(req, res) {
    try {
      const pdv = await PDV.findByPk(req.params.id);
      if (!pdv) {
        return res.status(404).json({ error: 'PDV non trouvé' });
      }
      if (!peutAccederAuPDV(req.user, pdv)) {
        return res.status(403).json({ error: 'Ce PDV ne fait pas partie de votre périmètre' });
      }
      const alertes = await Alerte.findAll({
        where: { pdv_id: req.params.id },
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Export CSV au format du mapping standard partenaire (Template_mapping) :
   * ID_unique, Pays, Ville, Commune, Quartier, ID_Terminal, Type_Terminal,
   * Vendeur, Contact_vendeur, Produit_vendu, sous-zone, ID_Distrib,
   * Commercial, Agence, Superviseur, Chef_zone — dans cet ordre quand tout est
   * visible, sans colonne de prix.
   *
   * Les colonnes ne sont plus câblées en dur : chacune de celles listées
   * ci-dessus (sauf ID_unique, ID_Terminal et Commercial, qui ne correspondent
   * à aucun champ pilotable) est reliée à un `code` de `pdv_champs_fixes` et
   * disparaît de l'export si l'admin masque ce champ dans Paramètres > Champs
   * PDV — au lieu de partir vide comme avant. Ensuite, une colonne est ajoutée
   * automatiquement pour chaque attribut personnalisé actif, dans son ordre
   * d'affichage du formulaire : plus besoin de toucher ce fichier quand
   * l'admin crée, renomme ou désactive un attribut.
   *
   * Un PDV qui vend plusieurs produits donne une ligne par produit (même
   * logique que le fichier modèle) ; un PDV sans produit renseigné donne une
   * seule ligne avec la colonne Produit_vendu vide, pour ne pas le faire
   * disparaître de l'export.
   */
  async exportMapping(req, res) {
    try {
      // Par défaut, seuls les dossiers validés partent au partenaire : un
      // brouillon produirait une ligne à moitié vide, difficile à distinguer
      // d'une donnée réellement absente une fois le fichier sorti de la
      // plateforme. `?statut_dossier=tous` permet l'export exhaustif pour un
      // contrôle interne.
      const statutDemande = req.query.statut_dossier || 'complet';
      const where = withScope({}, pdvScope(req.user));
      if (statutDemande !== 'tous') {
        where.statut_dossier = statutDemande;
      }
      // Mêmes filtres que la liste, pour qu'un export corresponde à ce que
      // l'utilisateur a sous les yeux au moment où il clique.
      for (const champ of ['ville', 'commune', 'agence_id', 'commercial_id', 'superviseur_id', 'chef_zone_id', 'sous_zone']) {
        if (req.query[champ]) where[champ] = req.query[champ];
      }

      const pdvs = await PDV.findAll({
        where,
        include: [
          { model: Agence, as: 'agence', attributes: ['nom_agence'] },
          { model: User, as: 'commercial', attributes: ['nom', 'prenom'] },
          { model: User, as: 'superviseur', attributes: ['nom', 'prenom'] },
          { model: User, as: 'chefZone', attributes: ['nom', 'prenom'] },
          { model: Produit, as: 'produits', attributes: ['nom_produit'], through: { attributes: [] } }
        ],
        order: [['id', 'ASC']]
      });

      const nomComplet = (personne) => (personne ? `${personne.prenom} ${personne.nom}` : '');

      // Colonnes du mapping standard, chacune reliée à son `code` dans
      // pdv_champs_fixes — `code: null` pour les trois qui n'y figurent pas
      // (aucun réglage possible, toujours présentes). `valeur` lit le PDV déjà
      // chargé ; Produit_vendu est traité à part car il varie par ligne.
      const COLONNES_MAPPING = [
        { entete: 'ID_unique', code: null, valeur: (pdv) => pdv.id_unique || '' },
        { entete: 'Pays', code: 'pays', valeur: (pdv) => pdv.pays || '' },
        { entete: 'Ville', code: 'ville', valeur: (pdv) => pdv.ville || '' },
        { entete: 'Commune', code: 'commune', valeur: (pdv) => pdv.commune || '' },
        { entete: 'Quartier', code: 'quartier', valeur: (pdv) => pdv.quartier || '' },
        { entete: 'ID_Terminal', code: null, valeur: (pdv) => pdv.id_terminal || '' },
        { entete: 'Type_Terminal', code: 'type_terminal', valeur: (pdv) => pdv.type_terminal || '' },
        { entete: 'Vendeur', code: 'vendeur_nom', valeur: (pdv) => pdv.vendeur_nom || '' },
        { entete: 'Contact_vendeur', code: 'contact_vendeur', valeur: (pdv) => pdv.contact_vendeur || '' },
        { entete: 'Produit_vendu', code: 'produits', valeur: () => '' }, // complété par produit plus bas
        { entete: 'sous-zone', code: 'sous_zone', valeur: (pdv) => pdv.sous_zone || '' },
        { entete: 'ID_Distrib', code: 'id_distributeur', valeur: (pdv) => pdv.id_distributeur || '' },
        { entete: 'Commercial', code: null, valeur: (pdv) => nomComplet(pdv.commercial) },
        { entete: 'Agence', code: 'agence_id', valeur: (pdv) => pdv.agence?.nom_agence || '' },
        { entete: 'Superviseur', code: 'superviseur_id', valeur: (pdv) => nomComplet(pdv.superviseur) },
        { entete: 'Chef_zone', code: 'chef_zone_id', valeur: (pdv) => nomComplet(pdv.chefZone) }
      ];

      const champsFixes = await pdvChampFixeService.getAll();
      const champsVisibles = new Set(champsFixes.filter((c) => c.visible).map((c) => c.code));
      const colonnesMappingActives = COLONNES_MAPPING.filter(
        (c) => c.code === null || champsVisibles.has(c.code)
      );
      const indexProduitVendu = colonnesMappingActives.findIndex((c) => c.entete === 'Produit_vendu');

      // Une colonne par attribut personnalisé actif, dans l'ordre du
      // formulaire — c'est ce qui rend l'export auto-adaptatif : créer,
      // renommer ou désactiver un attribut dans Paramètres > Attributs
      // change l'export au prochain clic, sans toucher à ce contrôleur.
      const attributsActifs = await pdvAttributService.getActifsOrdonnes();
      const valeursAttributsParPdv = await pdvAttributService.valeursPourExport(
        pdvs.map((pdv) => pdv.id),
        attributsActifs
      );

      const ENTETES = [
        ...colonnesMappingActives.map((c) => c.entete),
        ...attributsActifs.map((a) => a.libelle)
      ];

      // Un champ contenant une virgule, un guillemet ou un retour à la ligne
      // doit être entre guillemets pour rester valide en CSV.
      const echapper = (valeur) => {
        const texte = valeur === null || valeur === undefined ? '' : String(valeur);
        return /[",\n;]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
      };

      const lignes = [ENTETES.map(echapper).join(',')];

      for (const pdv of pdvs) {
        const valeursAttributs = valeursAttributsParPdv.get(pdv.id) || new Map();
        const base = [
          ...colonnesMappingActives.map((c) => c.valeur(pdv)),
          ...attributsActifs.map((a) => valeursAttributs.get(a.code) || '')
        ];

        const produits = pdv.produits && pdv.produits.length > 0 ? pdv.produits : [null];
        for (const produit of produits) {
          const ligne = [...base];
          if (indexProduitVendu !== -1) {
            ligne[indexProduitVendu] = produit?.nom_produit || '';
          }
          lignes.push(ligne.map(echapper).join(','));
        }
      }

      const csv = '\uFEFF' + lignes.join('\r\n'); // BOM pour l'ouverture directe dans Excel
      const nomFichier = `export-pdv-mapping-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
      res.send(csv);
    } catch (error) {
      logger.error('Erreur lors de l\'export mapping des PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = pdvController;
// Exposé pour les tests et pour tout autre module qui aurait besoin de la même
// règle (un import de masse, par exemple) sans la redéfinir de son côté.
module.exports.PREFIXE_NOM_BROUILLON = PREFIXE_NOM_BROUILLON;