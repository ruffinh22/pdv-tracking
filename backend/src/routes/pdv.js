const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const pdvController = require('../controllers/pdvController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
// `msisdn_responsable` n'est plus obligatoire : un PDV est désormais identifié
// par son `id_terminal` (enrôlement mobile), le numéro du responsable étant
// une information de fiche renseignée plus tard, si elle est connue.
const createPDVValidation = [
  body('nom_pdv').notEmpty().withMessage('Le nom du PDV est requis'),
  body('latitude_creation').isFloat().withMessage('Latitude invalide'),
  body('longitude_creation').isFloat().withMessage('Longitude invalide')
];

const enrollValidation = [
  body('matricule').notEmpty().withMessage('Le numéro matricule est requis'),
  body('terminal_id').notEmpty().withMessage("L'identifiant du terminal est requis"),
  body('latitude').isFloat().withMessage('Latitude invalide'),
  body('longitude').isFloat().withMessage('Longitude invalide')
];

// --- Routes publiques pour l'application mobile -------------------------
// Pas de JWT ici : le terminal installé au PDV n'a pas de session utilisateur.
// L'identification repose sur le couple matricule agent + id terminal.
router.post('/mobile/enroll', enrollValidation, pdvController.mobileEnroll);
router.get('/mobile/matricule/:matricule', pdvController.mobileVerifierMatricule);

// Compatibilité avec les versions de l'app déjà installées sur le terrain
router.post('/mobile/upsert', pdvController.mobileUpsert);
router.post('/mobile/register', pdvController.mobileRegister);
router.post('/mobile/login', pdvController.mobileLogin);

// --- Routes protégées (back-office) -------------------------------------
router.post('/', authMiddleware, createPDVValidation, pdvController.createPDV);
router.get('/', authMiddleware, pdvController.getAllPDVs);
router.get('/:id', authMiddleware, pdvController.getPDVById);
router.put('/:id', authMiddleware, pdvController.updatePDV);
// Complétion d'un dossier enrôlé depuis le mobile (agent commercial)
router.put('/:id/completer', authMiddleware, pdvController.completerPDV);
router.put('/:id/produits', authMiddleware, pdvController.updatePDVProduits);
router.delete('/:id', authMiddleware, pdvController.deletePDV);
router.get('/:id/positions', authMiddleware, pdvController.getPDVPositions);
// Synthèse du déplacement du terminal sur une période (distance, eloignement)
router.get('/:id/trajet', authMiddleware, pdvController.getPDVTrajet);
router.get('/:id/ventes', authMiddleware, pdvController.getPDVVentes);
router.get('/:id/alertes', authMiddleware, pdvController.getPDVAlertes);

module.exports = router;
