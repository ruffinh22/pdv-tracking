const { PDV, Alerte, Position, Produit, Agence, User, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const { pdvScope, withScope } = require('../utils/scope');

/**
 * Ce contrôleur ne traite PLUS de ventes / montants / chiffre d'affaires.
 * Le produit est un outil de TAGGING et de SUIVI TERRAIN de points de vente :
 * le reporting porte donc sur ce que le système mesure réellement —
 *   - l'enrôlement (combien de PDV tagués, par qui, où, quand),
 *   - la qualité des dossiers (brouillon vs complet),
 *   - l'activité GPS (PDV qui remontent encore des positions, PDV muets),
 *   - la conformité (sorties de zone = "instrus").
 */

/** Inclusion PDV scopée, prête à l'emploi pour les requêtes Alerte/Position du dashboard. */
function pdvScopedInclude(user, extra = {}) {
  const scope = pdvScope(user);
  const scoped = Object.keys(scope).length > 0;
  return { model: PDV, as: 'pdv', attributes: [], where: scoped ? scope : undefined, required: scoped, ...extra };
}

// Types d'alertes considérées comme "instrus" : un PDV qui a quitté sa zone
// initiale, que ce soit une zone geofence dédiée ou le rayon de 500m par défaut.
const TYPES_ALERTES_INSTRUS = ['sortie_zone', 'deplacement_anormal'];

/** Nombre d'heures sans remontée GPS au-delà duquel un PDV est considéré "muet". */
const SEUIL_INACTIVITE_HEURES = 48;

/**
 * Calcule la borne de début pour une période glissante donnée.
 * jour = depuis minuit aujourd'hui, semaine = 7 derniers jours, mois = 30 derniers jours.
 */
function debutPeriode(periode) {
  const now = new Date();
  if (periode === 'jour') {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    return debut;
  }
  if (periode === 'semaine') {
    const debut = new Date();
    debut.setDate(debut.getDate() - 7);
    return debut;
  }
  if (periode === 'mois') {
    const debut = new Date();
    debut.setMonth(debut.getMonth() - 1);
    return debut;
  }
  return null; // 'all' ou valeur inconnue -> pas de borne
}

/**
 * Résout un intervalle [debut, fin] à partir soit de dates explicites
 * (?debut=&fin=), soit d'un raccourci de période (?periode=jour|semaine|mois|all).
 * Renvoie `debut: null` pour "depuis le début".
 */
function resoudreIntervalle(query) {
  if (query.debut && query.fin) {
    return { debut: new Date(query.debut), fin: new Date(query.fin), periode: 'custom' };
  }
  const periode = query.periode || 'mois';
  return { debut: debutPeriode(periode), fin: new Date(), periode };
}

/** Clé "AAAA-MM-JJ" locale d'une date, pour les regroupements par jour. */
function cleJour(date) {
  const d = new Date(date);
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/**
 * Regroupe une liste d'objets par la valeur d'un champ et renvoie un tableau
 * trié par effectif décroissant. Les valeurs vides sont rassemblées sous
 * `libelleVide` plutôt que silencieusement perdues : un quartier non renseigné
 * est une information de qualité de données, pas un néant.
 */
function grouperPar(lignes, accesseur, libelleVide = 'Non renseigné') {
  const compteur = new Map();
  for (const ligne of lignes) {
    const brut = accesseur(ligne);
    const cle = brut === null || brut === undefined || brut === '' ? libelleVide : String(brut);
    compteur.set(cle, (compteur.get(cle) || 0) + 1);
  }
  return Array.from(compteur.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

// Dimensions autorisées pour les analyses transverses du dashboard
const DIMENSIONS = {
  ville: { champ: 'ville', libelle: 'Ville' },
  commune: { champ: 'commune', libelle: 'Commune' },
  quartier: { champ: 'quartier', libelle: 'Quartier' },
  pays: { champ: 'pays', libelle: 'Pays' },
  agence: { champ: 'agence_id', libelle: 'Agence', modele: Agence, champNom: 'nom_agence' },
  commercial: { champ: 'commercial_id', libelle: 'Commercial', modele: User },
  superviseur: { champ: 'superviseur_id', libelle: 'Superviseur', modele: User },
  chef_zone: { champ: 'chef_zone_id', libelle: 'Chef de zone', modele: User }
};

const dashboardController = {
  /**
   * KPIs d'en-tête. Recentrés sur le tagging et le suivi terrain : plus aucun
   * compteur de ventes, qui ne correspondait à rien de mesuré par le produit.
   */
  async getKPIs(req, res) {
    try {
      const scope = pdvScope(req.user);
      const minuit = new Date(new Date().setHours(0, 0, 0, 0));
      const seuilMuet = new Date(Date.now() - SEUIL_INACTIVITE_HEURES * 3600 * 1000);

      const [totalPdv, pdvActifs, taguesAujourdhui, dossiersBrouillon, alertesActives, pdvVus24h] =
        await Promise.all([
          PDV.count({ where: withScope({}, scope) }),
          PDV.count({ where: withScope({ statut: 'actif' }, scope) }),
          PDV.count({ where: withScope({ date_installation_app: { [Op.gte]: minuit } }, scope) }),
          PDV.count({ where: withScope({ statut_dossier: 'brouillon' }, scope) }),
          Alerte.count({ where: { statut: 'non_traitee' }, include: [pdvScopedInclude(req.user)] }),
          PDV.count({
            where: withScope(
              { derniere_position_date: { [Op.gte]: new Date(Date.now() - 24 * 3600 * 1000) } },
              scope
            )
          })
        ]);

      const pdvMuets = await PDV.count({
        where: withScope(
          {
            [Op.or]: [
              { derniere_position_date: null },
              { derniere_position_date: { [Op.lt]: seuilMuet } }
            ]
          },
          scope
        )
      });

      res.json({
        total_pdv: totalPdv,
        pdv_actifs: pdvActifs,
        pdv_tagues_aujourdhui: taguesAujourdhui,
        dossiers_brouillon: dossiersBrouillon,
        alertes_actives: alertesActives,
        pdv_vus_24h: pdvVus24h,
        pdv_muets: pdvMuets,
        seuil_inactivite_heures: SEUIL_INACTIVITE_HEURES
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des KPIs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PDV tagués / actifs / inactifs / suspendus sur la cohorte taguée
   * jour / semaine / mois (ou 'all' pour la base complète).
   * GET /api/dashboard/pdv-stats?periode=jour|semaine|mois|all
   */
  async getPDVStats(req, res) {
    try {
      const periode = req.query.periode || 'jour';
      const debut = debutPeriode(periode);
      const scope = pdvScope(req.user);
      const base = debut ? { date_installation_app: { [Op.gte]: debut } } : {};

      const [tagues, actifs, inactifs, suspendus, complets, brouillons] = await Promise.all([
        PDV.count({ where: withScope(base, scope) }),
        PDV.count({ where: withScope({ ...base, statut: 'actif' }, scope) }),
        PDV.count({ where: withScope({ ...base, statut: 'inactif' }, scope) }),
        PDV.count({ where: withScope({ ...base, statut: 'suspendu' }, scope) }),
        PDV.count({ where: withScope({ ...base, statut_dossier: 'complet' }, scope) }),
        PDV.count({ where: withScope({ ...base, statut_dossier: 'brouillon' }, scope) })
      ]);

      res.json({ periode, tagues, actifs, inactifs, suspendus, complets, brouillons });
    } catch (error) {
      logger.error('Erreur lors du calcul des statistiques PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Nombre de PDV tagués par type de produit référencé sur leur fiche.
   * (Le produit sert ici de typologie de PDV, pas d'objet de vente.)
   * GET /api/dashboard/pdv-par-produit?periode=jour|semaine|mois|all
   */
  async getPDVParProduit(req, res) {
    try {
      const periode = req.query.periode || 'all';
      const debut = debutPeriode(periode);
      const scope = pdvScope(req.user);
      const wherePdv = withScope(debut ? { date_installation_app: { [Op.gte]: debut } } : {}, scope);

      const produits = await Produit.findAll({
        where: { statut: 'actif' },
        include: [{
          model: PDV,
          as: 'pdvs',
          attributes: [],
          through: { attributes: [] },
          where: Object.keys(wherePdv).length > 0 ? wherePdv : undefined,
          required: Object.keys(scope).length > 0
        }],
        attributes: [
          'id',
          'nom_produit',
          [fn('COUNT', col('pdvs.id')), 'total_pdv']
        ],
        group: ['Produit.id'],
        order: [[literal('total_pdv'), 'DESC']]
      });

      res.json(produits.map(p => ({
        produit_id: p.id,
        produit: p.nom_produit,
        total_pdv: parseInt(p.get('total_pdv'), 10) || 0
      })));
    } catch (error) {
      logger.error('Erreur lors du calcul des PDV par produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Ratio de chaque type de produit par rapport à la base totale de PDV tagués.
   * Ex : 50 PDV/100 référencent des bonbons => 50%.
   * GET /api/dashboard/ratio-produits?periode=jour|semaine|mois|all
   */
  async getRatioProduits(req, res) {
    try {
      const periode = req.query.periode || 'all';
      const debut = debutPeriode(periode);
      const scope = pdvScope(req.user);
      const wherePdv = withScope(debut ? { date_installation_app: { [Op.gte]: debut } } : {}, scope);

      const totalPdvTagues = await PDV.count({ where: wherePdv });

      const produits = await Produit.findAll({
        where: { statut: 'actif' },
        include: [{
          model: PDV,
          as: 'pdvs',
          attributes: [],
          through: { attributes: [] },
          where: Object.keys(wherePdv).length > 0 ? wherePdv : undefined,
          required: Object.keys(scope).length > 0
        }],
        attributes: [
          'id',
          'nom_produit',
          [fn('COUNT', col('pdvs.id')), 'total_pdv']
        ],
        group: ['Produit.id']
      });

      const resultat = produits.map(p => {
        const total = parseInt(p.get('total_pdv'), 10) || 0;
        return {
          produit_id: p.id,
          produit: p.nom_produit,
          total_pdv: total,
          pourcentage: totalPdvTagues > 0 ? Number(((total / totalPdvTagues) * 100).toFixed(1)) : 0
        };
      }).sort((a, b) => b.total_pdv - a.total_pdv);

      res.json({ total_pdv_tagues: totalPdvTagues, produits: resultat });
    } catch (error) {
      logger.error('Erreur lors du calcul du ratio produits:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Analyses transverses de la base PDV par Ville, Commune, Quartier,
   * Commercial, Superviseur, Chef de zone ou Agence.
   * GET /api/dashboard/analyses?dimension=ville|...&periode=jour|semaine|mois|all
   */
  async getAnalyses(req, res) {
    try {
      const { dimension } = req.query;
      const config = DIMENSIONS[dimension];
      if (!config) {
        return res.status(400).json({
          error: `Dimension invalide. Valeurs possibles: ${Object.keys(DIMENSIONS).join(', ')}`
        });
      }

      const periode = req.query.periode || 'all';
      const debut = debutPeriode(periode);
      const scope = pdvScope(req.user);
      const where = withScope(debut ? { date_installation_app: { [Op.gte]: debut } } : {}, scope);

      const lignes = await PDV.findAll({
        where,
        attributes: [
          [col(config.champ), 'cle'],
          [fn('COUNT', col('PDV.id')), 'total'],
          [fn('SUM', literal(`CASE WHEN statut = 'actif' THEN 1 ELSE 0 END`)), 'actifs'],
          [fn('SUM', literal(`CASE WHEN statut = 'inactif' THEN 1 ELSE 0 END`)), 'inactifs'],
          [fn('SUM', literal(`CASE WHEN statut_dossier = 'complet' THEN 1 ELSE 0 END`)), 'complets']
        ],
        group: [config.champ],
        raw: true
      });

      // Pour les dimensions basées sur une référence (agence/commercial/...),
      // on résout les libellés lisibles à partir des IDs regroupés.
      let libelles = {};
      if (config.modele) {
        const ids = lignes.map(l => l.cle).filter(v => v !== null && v !== undefined);
        if (ids.length > 0) {
          const refs = await config.modele.findAll({ where: { id: ids } });
          refs.forEach(r => {
            libelles[r.id] = config.champNom ? r[config.champNom] : `${r.prenom} ${r.nom}`;
          });
        }
      }

      const resultat = lignes
        .filter(l => l.cle !== null && l.cle !== undefined && l.cle !== '')
        .map(l => {
          const total = parseInt(l.total, 10) || 0;
          const complets = parseInt(l.complets, 10) || 0;
          return {
            label: config.modele ? (libelles[l.cle] || 'Inconnu') : l.cle,
            total,
            actifs: parseInt(l.actifs, 10) || 0,
            inactifs: parseInt(l.inactifs, 10) || 0,
            complets,
            taux_completion: total > 0 ? Number(((complets / total) * 100).toFixed(1)) : 0
          };
        })
        .sort((a, b) => b.total - a.total);

      res.json({ dimension, libelle: config.libelle, periode, data: resultat });
    } catch (error) {
      logger.error('Erreur lors du calcul des analyses:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Synthèse de reporting : tout ce dont la page Reporting a besoin en UN seul
   * appel, sur un intervalle donné. Un seul aller-retour plutôt que sept, et
   * surtout des chiffres qui se recoupent (même intervalle, même périmètre) —
   * c'est ce qui manquait quand chaque bloc interrogeait sa propre route avec
   * ses propres bornes.
   *
   * GET /api/dashboard/reporting?periode=jour|semaine|mois|all
   * GET /api/dashboard/reporting?debut=ISO&fin=ISO
   */
  async getReportingSynthese(req, res) {
    try {
      const { debut, fin, periode } = resoudreIntervalle(req.query);
      const scope = pdvScope(req.user);
      const maintenant = Date.now();
      const seuilMuet = new Date(maintenant - SEUIL_INACTIVITE_HEURES * 3600 * 1000);

      const whereIntervalle = debut
        ? { date_installation_app: { [Op.between]: [debut, fin] } }
        : {};

      // --- Cohorte taguée sur l'intervalle ---------------------------------
      const cohorte = await PDV.findAll({
        where: withScope(whereIntervalle, scope),
        attributes: [
          'id', 'id_terminal', 'nom_pdv', 'statut', 'statut_dossier',
          'date_installation_app', 'derniere_position_date',
          'pays', 'ville', 'commune', 'quartier',
          'agence_id', 'commercial_id', 'superviseur_id', 'chef_zone_id',
          'matricule_agent'
        ],
        include: [
          { model: Agence, as: 'agence', attributes: ['id', 'nom_agence'], required: false },
          { model: User, as: 'commercial', attributes: ['id', 'nom', 'prenom'], required: false },
          { model: User, as: 'superviseur', attributes: ['id', 'nom', 'prenom'], required: false }
        ],
        order: [['date_installation_app', 'DESC']]
      });

      // --- Base totale (hors intervalle) pour mettre la cohorte en contexte --
      const baseTotale = await PDV.count({ where: withScope({}, scope) });

      // --- Courbe de tagging jour par jour ---------------------------------
      const parJour = new Map();
      for (const pdv of cohorte) {
        const cle = cleJour(pdv.date_installation_app);
        parJour.set(cle, (parJour.get(cle) || 0) + 1);
      }
      const courbeTagging = Array.from(parJour.entries())
        .map(([jour, total]) => ({ jour, total }))
        .sort((a, b) => (a.jour < b.jour ? -1 : 1));

      // --- Qualité des dossiers --------------------------------------------
      const complets = cohorte.filter(p => p.statut_dossier === 'complet').length;
      const brouillons = cohorte.length - complets;

      // --- Activité GPS : un PDV "vivant" a remonté une position récemment --
      const vus24h = cohorte.filter(
        p => p.derniere_position_date && new Date(p.derniere_position_date).getTime() >= maintenant - 24 * 3600 * 1000
      ).length;
      const muets = cohorte.filter(
        p => !p.derniere_position_date || new Date(p.derniere_position_date) < seuilMuet
      ).length;
      const jamaisVus = cohorte.filter(p => !p.derniere_position_date).length;

      // --- Volume de positions remontées sur l'intervalle -------------------
      const wherePositions = debut ? { horodatage: { [Op.between]: [debut, fin] } } : {};
      const totalPositions = await Position.count({
        where: wherePositions,
        include: [pdvScopedInclude(req.user)]
      });

      // --- Alertes de l'intervalle, ventilées -------------------------------
      const whereAlertes = debut ? { horodatage: { [Op.between]: [debut, fin] } } : {};
      const alertes = await Alerte.findAll({
        where: whereAlertes,
        attributes: ['id', 'type_alerte', 'statut', 'distance_metres', 'horodatage', 'pdv_id'],
        include: [{
          model: PDV,
          as: 'pdv',
          attributes: ['id', 'nom_pdv', 'id_terminal', 'ville', 'commune'],
          where: Object.keys(scope).length > 0 ? scope : undefined,
          required: Object.keys(scope).length > 0
        }],
        order: [['horodatage', 'DESC']]
      });

      const instrus = alertes.filter(a => TYPES_ALERTES_INSTRUS.includes(a.type_alerte));
      const pdvInstrus = new Set(instrus.map(a => a.pdv_id));
      const distances = instrus
        .map(a => Number(a.distance_metres))
        .filter(d => Number.isFinite(d) && d > 0);

      res.json({
        periode,
        intervalle: { debut: debut ? debut.toISOString() : null, fin: fin.toISOString() },
        seuil_inactivite_heures: SEUIL_INACTIVITE_HEURES,

        enrolement: {
          base_totale: baseTotale,
          tagues_periode: cohorte.length,
          part_de_la_base: baseTotale > 0 ? Number(((cohorte.length / baseTotale) * 100).toFixed(1)) : 0,
          actifs: cohorte.filter(p => p.statut === 'actif').length,
          inactifs: cohorte.filter(p => p.statut === 'inactif').length,
          suspendus: cohorte.filter(p => p.statut === 'suspendu').length,
          courbe: courbeTagging
        },

        qualite_dossiers: {
          complets,
          brouillons,
          taux_completion: cohorte.length > 0 ? Number(((complets / cohorte.length) * 100).toFixed(1)) : 0
        },

        activite_terrain: {
          positions_remontees: totalPositions,
          pdv_vus_24h: vus24h,
          pdv_muets: muets,
          jamais_vus: jamaisVus,
          taux_couverture: cohorte.length > 0 ? Number((((cohorte.length - muets) / cohorte.length) * 100).toFixed(1)) : 0
        },

        conformite: {
          total_alertes: alertes.length,
          instrus: instrus.length,
          pdv_concernes: pdvInstrus.size,
          taux_instrus: cohorte.length > 0 ? Number(((pdvInstrus.size / cohorte.length) * 100).toFixed(1)) : 0,
          non_traitees: alertes.filter(a => a.statut === 'non_traitee').length,
          en_cours: alertes.filter(a => a.statut === 'en_cours').length,
          traitees: alertes.filter(a => a.statut === 'traitee').length,
          distance_moyenne_m: distances.length > 0
            ? Math.round(distances.reduce((s, d) => s + d, 0) / distances.length)
            : 0,
          distance_max_m: distances.length > 0 ? Math.round(Math.max(...distances)) : 0,
          par_type: grouperPar(alertes, a => a.type_alerte)
        },

        repartition: {
          ville: grouperPar(cohorte, p => p.ville).slice(0, 12),
          commune: grouperPar(cohorte, p => p.commune).slice(0, 12),
          quartier: grouperPar(cohorte, p => p.quartier).slice(0, 12),
          agence: grouperPar(cohorte, p => p.agence && p.agence.nom_agence).slice(0, 12),
          commercial: grouperPar(
            cohorte,
            p => (p.commercial ? `${p.commercial.prenom} ${p.commercial.nom}` : null)
          ).slice(0, 12),
          superviseur: grouperPar(
            cohorte,
            p => (p.superviseur ? `${p.superviseur.prenom} ${p.superviseur.nom}` : null)
          ).slice(0, 12)
        },

        // Détail exploitable directement dans le tableau de la page Reporting,
        // borné pour ne pas envoyer toute la base dans une réponse JSON.
        detail: cohorte.slice(0, 500).map(p => ({
          id: p.id,
          id_terminal: p.id_terminal,
          nom_pdv: p.nom_pdv,
          statut: p.statut,
          statut_dossier: p.statut_dossier,
          date_tagging: p.date_installation_app,
          derniere_position_date: p.derniere_position_date,
          muet: !p.derniere_position_date || new Date(p.derniere_position_date) < seuilMuet,
          instru: pdvInstrus.has(p.id),
          pays: p.pays,
          ville: p.ville,
          commune: p.commune,
          quartier: p.quartier,
          agence: p.agence ? p.agence.nom_agence : null,
          commercial: p.commercial ? `${p.commercial.prenom} ${p.commercial.nom}` : null,
          superviseur: p.superviseur ? `${p.superviseur.prenom} ${p.superviseur.nom}` : null,
          matricule_agent: p.matricule_agent
        })),
        detail_tronque: cohorte.length > 500
      });
    } catch (error) {
      logger.error('Erreur lors du calcul de la synthèse de reporting:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVActifs(req, res) {
    try {
      const scope = pdvScope(req.user);
      const pdvs = await PDV.findAll({
        where: withScope({ statut: 'actif' }, scope),
        include: ['zone']
      });
      res.json(pdvs);
    } catch (error) {
      logger.error('Erreur lors de la récupération des PDV actifs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getAlertesActives(req, res) {
    try {
      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;
      const alertes = await Alerte.findAll({
        where: { statut: 'non_traitee' },
        include: [
          { model: PDV, as: 'pdv', where: scoped ? scope : undefined, required: scoped },
          'zone'
        ],
        order: [['horodatage', 'DESC']],
        limit: 50
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes actives:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Couverture géographique : emprise des positions remontées + volumétrie.
   * La bbox est calculée en SQL (MIN/MAX) au lieu de charger toutes les
   * positions en mémoire — la table positions grossit de plusieurs lignes par
   * PDV et par heure, la charger entièrement finissait par saturer le process.
   */
  async getCouvertureGeographique(req, res) {
    try {
      const { debut, fin } = resoudreIntervalle(req.query);
      const where = debut ? { horodatage: { [Op.between]: [debut, fin] } } : {};

      const ligne = await Position.findOne({
        where,
        attributes: [
          [fn('COUNT', col('Position.id')), 'nombre_positions'],
          [fn('MIN', col('latitude')), 'min_lat'],
          [fn('MAX', col('latitude')), 'max_lat'],
          [fn('MIN', col('longitude')), 'min_lon'],
          [fn('MAX', col('longitude')), 'max_lon'],
          [fn('COUNT', fn('DISTINCT', col('pdv_id'))), 'pdv_couverts']
        ],
        include: [pdvScopedInclude(req.user)],
        raw: true
      });

      const nombre = parseInt(ligne && ligne.nombre_positions, 10) || 0;

      res.json({
        nombre_positions: nombre,
        pdv_couverts: parseInt(ligne && ligne.pdv_couverts, 10) || 0,
        bbox: nombre > 0 ? {
          min_lat: Number(ligne.min_lat),
          max_lat: Number(ligne.max_lat),
          min_lon: Number(ligne.min_lon),
          max_lon: Number(ligne.max_lon)
        } : null
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération de la couverture:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Instrus : PDV ayant quitté leur zone/position initiale (alerte
   * sortie_zone ou déplacement > rayon autorisé).
   * GET /api/dashboard/instrus?statut=non_traitee|traitee|en_cours (optionnel)
   */
  async getInstrus(req, res) {
    try {
      const where = { type_alerte: { [Op.in]: TYPES_ALERTES_INSTRUS } };
      if (req.query.statut) {
        where.statut = req.query.statut;
      }
      const { debut, fin } = resoudreIntervalle(req.query);
      if (debut) {
        where.horodatage = { [Op.between]: [debut, fin] };
      }

      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;

      const instrus = await Alerte.findAll({
        where,
        include: [
          {
            model: PDV,
            as: 'pdv',
            attributes: [
              'id', 'nom_pdv', 'msisdn_responsable', 'id_terminal',
              'latitude_creation', 'longitude_creation', 'ville', 'commune', 'quartier'
            ],
            // Les instrus étaient jusqu'ici renvoyés sans filtre de périmètre :
            // un commercial voyait les sorties de zone de toute la base.
            where: scoped ? scope : undefined,
            required: scoped
          },
          'zone'
        ],
        order: [['horodatage', 'DESC']]
      });

      res.json(instrus);
    } catch (error) {
      logger.error('Erreur lors de la récupération des instrus:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Export Excel des instrus (PDV ayant quitté leur zone/position initiale).
   * GET /api/dashboard/instrus/export
   */
  async exportInstrusExcel(req, res) {
    try {
      const where = { type_alerte: { [Op.in]: TYPES_ALERTES_INSTRUS } };
      if (req.query.statut) {
        where.statut = req.query.statut;
      }
      const { debut, fin } = resoudreIntervalle(req.query);
      if (debut) {
        where.horodatage = { [Op.between]: [debut, fin] };
      }

      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;

      const instrus = await Alerte.findAll({
        where,
        include: [
          { model: PDV, as: 'pdv', where: scoped ? scope : undefined, required: scoped },
          'zone'
        ],
        order: [['horodatage', 'DESC']]
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tracking PDV';
      workbook.created = new Date();

      const feuille = workbook.addWorksheet('Instrus');
      feuille.columns = [
        { header: 'ID Terminal', key: 'id_terminal', width: 18 },
        { header: 'PDV', key: 'pdv', width: 22 },
        { header: 'MSISDN', key: 'msisdn', width: 16 },
        { header: 'Type alerte', key: 'type', width: 18 },
        { header: 'Zone', key: 'zone', width: 20 },
        { header: 'Distance (m)', key: 'distance', width: 14 },
        { header: 'Position initiale', key: 'position_initiale', width: 24 },
        { header: 'Position au moment de l\'alerte', key: 'position_alerte', width: 28 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Statut', key: 'statut', width: 14 },
        { header: 'Commentaire', key: 'commentaire', width: 30 }
      ];

      instrus.forEach(alerte => {
        feuille.addRow({
          id_terminal: alerte.pdv?.id_terminal || alerte.pdv?.msisdn_responsable || '',
          pdv: alerte.pdv?.nom_pdv || '',
          msisdn: alerte.pdv?.msisdn_responsable || '',
          type: alerte.type_alerte === 'sortie_zone' ? 'Sortie de zone' : 'Déplacement anormal (>500m)',
          zone: alerte.zone?.nom_zone || '-',
          distance: alerte.distance_metres || '',
          position_initiale: alerte.pdv
            ? `${alerte.pdv.latitude_creation}, ${alerte.pdv.longitude_creation}`
            : '',
          position_alerte: `${alerte.latitude}, ${alerte.longitude}`,
          date: alerte.horodatage,
          statut: alerte.statut,
          commentaire: alerte.commentaire || ''
        });
      });

      feuille.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      feuille.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB93333' } };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=instrus_${new Date().toISOString().split('T')[0]}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Erreur lors de l\'export des instrus:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Export Excel du reporting : 3 feuilles — Synthèse (les indicateurs de la
   * page), PDV tagués (le détail de la cohorte), Instrus (la conformité).
   * Aucune colonne de montant : le produit ne mesure pas de ventes.
   */
  async exportExcel(req, res) {
    try {
      const { debut, fin, periode } = resoudreIntervalle(req.query);
      const scope = pdvScope(req.user);
      const scoped = Object.keys(scope).length > 0;
      const maintenant = Date.now();
      const seuilMuet = new Date(maintenant - SEUIL_INACTIVITE_HEURES * 3600 * 1000);

      const wherePdv = debut ? { date_installation_app: { [Op.between]: [debut, fin] } } : {};

      const pdvs = await PDV.findAll({
        where: withScope(wherePdv, scope),
        include: [
          { model: Agence, as: 'agence', required: false },
          { model: User, as: 'commercial', attributes: ['nom', 'prenom'], required: false },
          { model: User, as: 'superviseur', attributes: ['nom', 'prenom'], required: false },
          { model: User, as: 'chefZone', attributes: ['nom', 'prenom'], required: false },
          { model: Produit, as: 'produits', attributes: ['nom_produit'], through: { attributes: [] }, required: false }
        ],
        order: [['date_installation_app', 'DESC']]
      });

      const whereAlertes = debut ? { horodatage: { [Op.between]: [debut, fin] } } : {};
      const alertes = await Alerte.findAll({
        where: { ...whereAlertes, type_alerte: { [Op.in]: TYPES_ALERTES_INSTRUS } },
        include: [
          { model: PDV, as: 'pdv', where: scoped ? scope : undefined, required: scoped },
          'zone'
        ],
        order: [['horodatage', 'DESC']]
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tracking PDV';
      workbook.created = new Date();

      const enTete = (feuille, couleur) => {
        feuille.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        feuille.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: couleur } };
        feuille.views = [{ state: 'frozen', ySplit: 1 }];
      };

      // --- Feuille 1 : Synthèse --------------------------------------------
      const muets = pdvs.filter(p => !p.derniere_position_date || new Date(p.derniere_position_date) < seuilMuet).length;
      const complets = pdvs.filter(p => p.statut_dossier === 'complet').length;
      const pdvInstrus = new Set(alertes.map(a => a.pdv_id));

      const synthese = workbook.addWorksheet('Synthèse');
      synthese.columns = [
        { header: 'Indicateur', key: 'indicateur', width: 42 },
        { header: 'Valeur', key: 'valeur', width: 18 }
      ];
      [
        ['Période', debut ? `${debut.toLocaleDateString('fr-FR')} → ${fin.toLocaleDateString('fr-FR')}` : `Depuis le début (${periode})`],
        ['PDV tagués sur la période', pdvs.length],
        ['— dont actifs', pdvs.filter(p => p.statut === 'actif').length],
        ['— dont inactifs', pdvs.filter(p => p.statut === 'inactif').length],
        ['— dont suspendus', pdvs.filter(p => p.statut === 'suspendu').length],
        ['Dossiers complets', complets],
        ['Dossiers en brouillon', pdvs.length - complets],
        ['Taux de complétion des dossiers (%)', pdvs.length ? Number(((complets / pdvs.length) * 100).toFixed(1)) : 0],
        [`PDV sans remontée GPS depuis ${SEUIL_INACTIVITE_HEURES}h`, muets],
        ['Taux de couverture terrain (%)', pdvs.length ? Number((((pdvs.length - muets) / pdvs.length) * 100).toFixed(1)) : 0],
        ['Alertes de sortie de zone (instrus)', alertes.length],
        ['PDV concernés par une sortie de zone', pdvInstrus.size],
        ['Instrus non traitées', alertes.filter(a => a.statut === 'non_traitee').length]
      ].forEach(([indicateur, valeur]) => synthese.addRow({ indicateur, valeur }));
      enTete(synthese, 'FFE06E00');

      // --- Feuille 2 : PDV tagués ------------------------------------------
      const feuillePdv = workbook.addWorksheet('PDV tagués');
      feuillePdv.columns = [
        { header: 'ID_Terminal', key: 'id_terminal', width: 18 },
        { header: 'Nom_PDV', key: 'nom_pdv', width: 22 },
        { header: 'Type_Produit_référencé', key: 'produits', width: 30 },
        { header: 'Concessionnaire_nom', key: 'concessionnaire_nom', width: 20 },
        { header: 'Vendeur_nom', key: 'vendeur_nom', width: 20 },
        { header: 'Contact_vendeur', key: 'contact_vendeur', width: 16 },
        { header: 'Agence_nom', key: 'agence_nom', width: 18 },
        { header: 'Commercial_nom', key: 'commercial_nom', width: 20 },
        { header: 'Superviseur_nom', key: 'superviseur_nom', width: 20 },
        { header: 'Chef_zone_nom', key: 'chef_zone_nom', width: 20 },
        { header: 'Pays', key: 'pays', width: 14 },
        { header: 'Ville', key: 'ville', width: 16 },
        { header: 'Commune', key: 'commune', width: 16 },
        { header: 'Quartier', key: 'quartier', width: 18 },
        { header: 'Statut', key: 'statut', width: 12 },
        { header: 'Dossier', key: 'statut_dossier', width: 12 },
        { header: 'Date tagging', key: 'date_tagging', width: 20 },
        { header: 'Dernière position', key: 'derniere_position', width: 20 },
        { header: 'Suivi GPS', key: 'suivi', width: 14 }
      ];

      pdvs.forEach(pdv => {
        const muet = !pdv.derniere_position_date || new Date(pdv.derniere_position_date) < seuilMuet;
        feuillePdv.addRow({
          id_terminal: pdv.id_terminal || pdv.msisdn_responsable || '',
          nom_pdv: pdv.nom_pdv,
          produits: (pdv.produits || []).map(p => p.nom_produit).join(', '),
          concessionnaire_nom: pdv.concessionnaire_nom || '',
          vendeur_nom: pdv.vendeur_nom || '',
          contact_vendeur: pdv.contact_vendeur || '',
          agence_nom: pdv.agence?.nom_agence || '',
          commercial_nom: pdv.commercial ? `${pdv.commercial.prenom} ${pdv.commercial.nom}` : '',
          superviseur_nom: pdv.superviseur ? `${pdv.superviseur.prenom} ${pdv.superviseur.nom}` : '',
          chef_zone_nom: pdv.chefZone ? `${pdv.chefZone.prenom} ${pdv.chefZone.nom}` : '',
          pays: pdv.pays || '',
          ville: pdv.ville || '',
          commune: pdv.commune || '',
          quartier: pdv.quartier || '',
          statut: pdv.statut,
          statut_dossier: pdv.statut_dossier,
          date_tagging: pdv.date_installation_app,
          derniere_position: pdv.derniere_position_date || '',
          suivi: muet ? `Muet (>${SEUIL_INACTIVITE_HEURES}h)` : 'Actif'
        });
      });
      enTete(feuillePdv, 'FFE06E00');

      // --- Feuille 3 : Instrus ---------------------------------------------
      const feuilleInstrus = workbook.addWorksheet('Instrus');
      feuilleInstrus.columns = [
        { header: 'ID Terminal', key: 'id_terminal', width: 18 },
        { header: 'PDV', key: 'pdv', width: 22 },
        { header: 'Type alerte', key: 'type', width: 20 },
        { header: 'Zone', key: 'zone', width: 20 },
        { header: 'Distance (m)', key: 'distance', width: 14 },
        { header: 'Ville', key: 'ville', width: 16 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Statut', key: 'statut', width: 14 }
      ];
      alertes.forEach(alerte => {
        feuilleInstrus.addRow({
          id_terminal: alerte.pdv?.id_terminal || '',
          pdv: alerte.pdv?.nom_pdv || '',
          type: alerte.type_alerte === 'sortie_zone' ? 'Sortie de zone' : 'Déplacement anormal',
          zone: alerte.zone?.nom_zone || '-',
          distance: alerte.distance_metres || '',
          ville: alerte.pdv?.ville || '',
          date: alerte.horodatage,
          statut: alerte.statut
        });
      });
      enTete(feuilleInstrus, 'FFB93333');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reporting_tracking_pdv_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Erreur lors de l\'export Excel:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = dashboardController;
