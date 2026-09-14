const { PDV, Vente, Alerte, Position, Produit, Agence, User, PDVProduit, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

// Types d'alertes considérées comme "instrus" : un PDV qui a quitté sa zone
// initiale, que ce soit une zone geofence dédiée ou le rayon de 500m par défaut.
const TYPES_ALERTES_INSTRUS = ['sortie_zone', 'deplacement_anormal'];

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
  async getKPIs(req, res) {
    try {
      const pdvActifs = await PDV.count({ where: { statut: 'actif' } });
      const ventesAujourdhui = await Vente.count({
        where: {
          horodatage: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      });
      const alertesActives = await Alerte.count({ where: { statut: 'non_traitee' } });

      res.json({
        pdv_actifs: pdvActifs,
        ventes_aujourdhui: ventesAujourdhui,
        alertes_actives: alertesActives
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des KPIs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Point 5 : nombre de PDV tagués et nombre de PDV inactifs, sur la cohorte
   * taguée jour / semaine / mois (ou 'all' pour la base complète).
   * GET /api/dashboard/pdv-stats?periode=jour|semaine|mois|all
   */
  async getPDVStats(req, res) {
    try {
      const periode = req.query.periode || 'jour';
      const debut = debutPeriode(periode);
      const where = debut ? { date_installation_app: { [Op.gte]: debut } } : {};

      const [tagues, actifs, inactifs, suspendus] = await Promise.all([
        PDV.count({ where }),
        PDV.count({ where: { ...where, statut: 'actif' } }),
        PDV.count({ where: { ...where, statut: 'inactif' } }),
        PDV.count({ where: { ...where, statut: 'suspendu' } })
      ]);

      res.json({ periode, tagues, actifs, inactifs, suspendus });
    } catch (error) {
      logger.error('Erreur lors du calcul des statistiques PDV:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Point 5 : nombre de PDV tagués par type de produit vendu, sur une période.
   * GET /api/dashboard/pdv-par-produit?periode=jour|semaine|mois|all
   */
  async getPDVParProduit(req, res) {
    try {
      const periode = req.query.periode || 'all';
      const debut = debutPeriode(periode);

      const produits = await Produit.findAll({
        where: { statut: 'actif' },
        include: [{
          model: PDV,
          as: 'pdvs',
          attributes: [],
          through: { attributes: [] },
          where: debut ? { date_installation_app: { [Op.gte]: debut } } : undefined,
          required: false
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
   * Point 5 : ratio de chaque type de produit vendu par rapport à la base
   * totale de PDV tagués. Ex : 50 PDV/100 vendent des bonbons => 50%.
   * GET /api/dashboard/ratio-produits?periode=jour|semaine|mois|all
   */
  async getRatioProduits(req, res) {
    try {
      const periode = req.query.periode || 'all';
      const debut = debutPeriode(periode);
      const wherePdv = debut ? { date_installation_app: { [Op.gte]: debut } } : {};

      const totalPdvTagues = await PDV.count({ where: wherePdv });

      const produits = await Produit.findAll({
        where: { statut: 'actif' },
        include: [{
          model: PDV,
          as: 'pdvs',
          attributes: [],
          through: { attributes: [] },
          where: debut ? wherePdv : undefined,
          required: false
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
   * Point 3 : analyses transverses de la base PDV par Ville, Commune,
   * Quartier, Commercial, Superviseur, Chef de zone ou Agence.
   * GET /api/dashboard/analyses?dimension=ville|commune|quartier|pays|agence|commercial|superviseur|chef_zone
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
      const where = debut ? { date_installation_app: { [Op.gte]: debut } } : {};

      const lignes = await PDV.findAll({
        where,
        attributes: [
          [col(config.champ), 'cle'],
          [fn('COUNT', col('PDV.id')), 'total'],
          [fn('SUM', literal(`CASE WHEN statut = 'actif' THEN 1 ELSE 0 END`)), 'actifs'],
          [fn('SUM', literal(`CASE WHEN statut = 'inactif' THEN 1 ELSE 0 END`)), 'inactifs']
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
        .map(l => ({
          label: config.modele ? (libelles[l.cle] || 'Inconnu') : l.cle,
          total: parseInt(l.total, 10) || 0,
          actifs: parseInt(l.actifs, 10) || 0,
          inactifs: parseInt(l.inactifs, 10) || 0
        }))
        .sort((a, b) => b.total - a.total);

      res.json({ dimension, libelle: config.libelle, periode, data: resultat });
    } catch (error) {
      logger.error('Erreur lors du calcul des analyses:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getVentesPeriode(req, res) {
    try {
      const { debut, fin } = req.query;
      const ventes = await Vente.findAll({
        where: {
          horodatage: { [Op.between]: [debut, fin] }
        },
        include: ['pdv'],
        order: [['horodatage', 'ASC']]
      });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getVentesParProduit(req, res) {
    try {
      const ventes = await Vente.findAll({
        attributes: [
          'produit',
          [fn('COUNT', col('id')), 'total'],
          [fn('SUM', col('montant')), 'montant_total']
        ],
        group: ['produit']
      });
      res.json(ventes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes par produit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getVentesParZone(req, res) {
    try {
      const ventes = await Vente.findAll({
        include: [{ model: PDV, as: 'pdv', include: ['zone'] }]
      });

      const ventesParZone = ventes.reduce((acc, vente) => {
        const zoneNom = vente.pdv.zone ? vente.pdv.zone.nom_zone : 'Non assigné';
        acc[zoneNom] = (acc[zoneNom] || 0) + 1;
        return acc;
      }, {});

      res.json(ventesParZone);
    } catch (error) {
      logger.error('Erreur lors de la récupération des ventes par zone:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getPDVActifs(req, res) {
    try {
      const pdvs = await PDV.findAll({
        where: { statut: 'actif' },
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
      const alertes = await Alerte.findAll({
        where: { statut: 'non_traitee' },
        include: ['pdv', 'zone'],
        order: [['horodatage', 'DESC']]
      });
      res.json(alertes);
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes actives:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getCouvertureGeographique(req, res) {
    try {
      const positions = await Position.findAll({ attributes: ['latitude', 'longitude'] });

      const couverture = {
        nombre_positions: positions.length,
        bbox: positions.length > 0 ? {
          min_lat: Math.min(...positions.map(p => p.latitude)),
          max_lat: Math.max(...positions.map(p => p.latitude)),
          min_lon: Math.min(...positions.map(p => p.longitude)),
          max_lon: Math.max(...positions.map(p => p.longitude))
        } : null
      };

      res.json(couverture);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la couverture:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Point 6 : liste des "instrus" - PDV ayant quitté leur zone/position
   * initiale (alerte sortie_zone ou déplacement > rayon autorisé).
   * GET /api/dashboard/instrus?statut=non_traitee|traitee|en_cours (optionnel)
   */
  async getInstrus(req, res) {
    try {
      const where = { type_alerte: { [Op.in]: TYPES_ALERTES_INSTRUS } };
      if (req.query.statut) {
        where.statut = req.query.statut;
      }

      const instrus = await Alerte.findAll({
        where,
        include: [
          {
            model: PDV,
            as: 'pdv',
            attributes: [
              'id', 'nom_pdv', 'msisdn_responsable', 'id_terminal',
              'latitude_creation', 'longitude_creation', 'ville', 'commune', 'quartier'
            ]
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
   * Point 6 : export Excel, à tout moment, des instrus (PDV ayant quitté
   * leur zone/position initiale).
   * GET /api/dashboard/instrus/export
   */
  async exportInstrusExcel(req, res) {
    try {
      const where = { type_alerte: { [Op.in]: TYPES_ALERTES_INSTRUS } };
      if (req.query.statut) {
        where.statut = req.query.statut;
      }

      const instrus = await Alerte.findAll({
        where,
        include: [
          { model: PDV, as: 'pdv' },
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

  async exportExcel(req, res) {
    try {
      const { debut, fin } = req.query;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tracking PDV';
      workbook.created = new Date();

      // Feuille Ventes
      const feuilleVentes = workbook.addWorksheet('Ventes');
      feuilleVentes.columns = [
        { header: 'MSISDN', key: 'msisdn', width: 15 },
        { header: 'PDV', key: 'pdv', width: 20 },
        { header: 'Produit', key: 'produit', width: 20 },
        { header: 'Concessionnaire', key: 'concessionnaire', width: 20 },
        { header: 'Vendeur', key: 'vendeur', width: 20 },
        { header: 'Contact', key: 'contact', width: 15 },
        { header: 'Montant', key: 'montant', width: 15 },
        { header: 'Pays', key: 'pays', width: 15 },
        { header: 'Ville', key: 'ville', width: 20 },
        { header: 'Commune', key: 'commune', width: 20 },
        { header: 'Quartier', key: 'quartier', width: 25 },
        { header: 'Date', key: 'date', width: 20 }
      ];

      const ventes = await Vente.findAll({
        where: debut && fin ? { horodatage: { [Op.between]: [debut, fin] } } : {},
        include: ['pdv']
      });

      ventes.forEach(vente => {
        feuilleVentes.addRow({
          msisdn: vente.pdv.msisdn_responsable || '',
          pdv: vente.pdv.nom_pdv,
          produit: vente.produit,
          concessionnaire: vente.nom_concessionnaire,
          vendeur: vente.nom_vendeur,
          contact: vente.contact_vendeur,
          montant: vente.montant || 0,
          pays: vente.pays || '',
          ville: vente.ville || '',
          commune: vente.commune || '',
          quartier: vente.quartier || '',
          date: vente.horodatage
        });
      });

      feuilleVentes.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      feuilleVentes.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      // Feuille PDV tagués (colonnes demandées: identité, hiérarchie, localisation, produits)
      const feuillePdv = workbook.addWorksheet('PDV tagués');
      feuillePdv.columns = [
        { header: 'ID_Terminal', key: 'id_terminal', width: 16 },
        { header: 'Type_Produit_vendu', key: 'produits', width: 30 },
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
        { header: 'Date tagging', key: 'date_tagging', width: 18 }
      ];

      const pdvs = await PDV.findAll({
        where: debut && fin ? { date_installation_app: { [Op.between]: [debut, fin] } } : {},
        include: [
          { model: Agence, as: 'agence' },
          { model: User, as: 'commercial', attributes: ['nom', 'prenom'] },
          { model: User, as: 'superviseur', attributes: ['nom', 'prenom'] },
          { model: User, as: 'chefZone', attributes: ['nom', 'prenom'] },
          { model: Produit, as: 'produits', attributes: ['nom_produit'], through: { attributes: [] } }
        ]
      });

      pdvs.forEach(pdv => {
        feuillePdv.addRow({
          id_terminal: pdv.id_terminal || pdv.msisdn_responsable,
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
          date_tagging: pdv.date_installation_app
        });
      });

      feuillePdv.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      feuillePdv.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06E00' } };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=tracking_pdv_export.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Erreur lors de l\'export Excel:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = dashboardController;
