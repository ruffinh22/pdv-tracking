const { PDV, Vente, Alerte, Position } = require('../models');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

const dashboardController = {
  async getKPIs(req, res) {
    try {
      const pdvActifs = await PDV.count({ where: { statut: 'actif' } });
      const ventesAujourdhui = await Vente.count({
        where: {
          horodatage: {
            [require('sequelize').Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
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

  async getVentesPeriode(req, res) {
    try {
      const { debut, fin } = req.query;
      const ventes = await Vente.findAll({
        where: {
          horodatage: {
            [require('sequelize').Op.between]: [debut, fin]
          }
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
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
          [require('sequelize').fn('SUM', require('sequelize').col('montant')), 'montant_total']
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
        include: [{
          model: PDV,
          as: 'pdv',
          include: ['zone']
        }]
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
      const positions = await Position.findAll({
        attributes: ['latitude', 'longitude']
      });

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
        where: debut && fin ? {
          horodatage: {
            [require('sequelize').Op.between]: [debut, fin]
          }
        } : {},
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

      // Style de l'en-tête
      feuilleVentes.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      feuilleVentes.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

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
