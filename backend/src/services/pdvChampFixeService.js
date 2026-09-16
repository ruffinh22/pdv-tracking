const { PdvChampFixe } = require('../models');

/**
 * Liste blanche des champs fixes pilotables. L'admin ne peut pas en créer un
 * nouveau via l'API : le `code` transmis à `mettreAJour` doit exister dans
 * cette liste, câblée avec le reste du produit (le formulaire de complétion,
 * le calcul de complétude, l'export mapping). Elle doit rester alignée avec
 * `CHAMPS_PAR_DEFAUT` de la migration de seed.
 */
const CODES_AUTORISES = new Set([
  'nom_pdv',
  'vendeur_nom',
  'contact_vendeur',
  'msisdn_responsable',
  'concessionnaire_nom',
  'statut',
  'agence_id',
  'superviseur_id',
  'chef_zone_id',
  'sous_zone',
  'id_distributeur',
  'type_terminal',
  'pays',
  'ville',
  'commune',
  'quartier',
  'produits'
]);

/** Tous les champs fixes, dans l'ordre de la fiche. Utilisé par la page d'admin et par le formulaire de complétion. */
async function getAll() {
  return PdvChampFixe.findAll({ order: [['id', 'ASC']] });
}

/**
 * Champs fixes obligatoires ET visibles : ce sont les seuls dont l'absence
 * doit bloquer le passage d'un dossier en "complet". Un champ masqué n'est
 * jamais compté ici, même si sa colonne `obligatoire` traîne encore à `true` —
 * en pratique `mettreAJour` empêche cette combinaison, cette double sécurité
 * ne coûte rien.
 */
async function getObligatoiresVisibles() {
  return PdvChampFixe.findAll({ where: { obligatoire: true, visible: true } });
}

/**
 * Met à jour le réglage d'un champ fixe : libellé, obligatoire, visible.
 *
 * Règle centrale, demandée explicitement : un champ masqué ne peut pas être
 * obligatoire — l'agent n'a aucun moyen de renseigner un champ qu'il ne voit
 * pas. Si la requête masque un champ, son caractère obligatoire est donc
 * forcé à `false`, quoi qu'ait envoyé l'appelant. C'est un ajustement
 * silencieux plutôt qu'un rejet : masquer un champ obligatoire est une
 * intention claire (« je ne veux plus de ce champ »), pas une erreur à
 * signaler.
 */
async function mettreAJour(code, { libelle, obligatoire, visible } = {}) {
  if (!CODES_AUTORISES.has(code)) {
    const erreur = new Error(`"${code}" n'est pas un champ fixe reconnu`);
    erreur.statusCode = 400;
    throw erreur;
  }

  const champ = await PdvChampFixe.findOne({ where: { code } });
  if (!champ) {
    const erreur = new Error(
      "Champ non trouvé en base — relancez le serveur pour rejouer la migration de seed"
    );
    erreur.statusCode = 404;
    throw erreur;
  }

  const visibleFinal = visible === undefined ? champ.visible : !!visible;
  const obligatoireFinal = !visibleFinal
    ? false
    : obligatoire === undefined
    ? champ.obligatoire
    : !!obligatoire;

  await champ.update({
    libelle: libelle === undefined || libelle === null || libelle === '' ? champ.libelle : libelle,
    visible: visibleFinal,
    obligatoire: obligatoireFinal
  });

  return champ;
}

module.exports = { CODES_AUTORISES, getAll, getObligatoiresVisibles, mettreAJour };
