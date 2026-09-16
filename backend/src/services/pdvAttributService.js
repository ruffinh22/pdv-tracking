const { PdvAttribut, PdvAttributValeur } = require('../models');

/**
 * Sérialise une valeur saisie vers la colonne TEXT de stockage, en fonction du
 * type déclaré par l'admin. Le stockage est volontairement en texte : le
 * schéma étant piloté à l'exécution, on ne peut pas créer de colonnes typées.
 */
function serialiser(type, valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  switch (type) {
    case 'liste_multiple':
      return JSON.stringify(Array.isArray(valeur) ? valeur : [valeur]);
    case 'booleen':
      return valeur === true || valeur === 'true' || valeur === 1 || valeur === '1' ? '1' : '0';
    case 'nombre':
      return String(Number(valeur));
    default:
      return String(valeur);
  }
}

/** Opération inverse de `serialiser`, pour renvoyer des valeurs typées à l'API. */
function deserialiser(type, brut) {
  if (brut === null || brut === undefined) return null;
  switch (type) {
    case 'liste_multiple':
      try {
        return JSON.parse(brut);
      } catch {
        return [];
      }
    case 'booleen':
      return brut === '1';
    case 'nombre': {
      const n = Number(brut);
      return Number.isNaN(n) ? null : n;
    }
    default:
      return brut;
  }
}

/** true si la valeur compte comme "renseignée" pour un attribut obligatoire. */
function estRenseignee(type, valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return false;
  if (type === 'liste_multiple') return Array.isArray(valeur) && valeur.length > 0;
  return true;
}

/**
 * Enregistre les valeurs d'attributs d'un PDV.
 *
 * `valeursParCode` est un objet { code_attribut: valeur } — c'est le format le
 * plus naturel côté formulaire web, et il reste stable même si l'admin
 * renomme le libellé d'un attribut.
 *
 * Retourne la liste des libellés d'attributs obligatoires encore manquants,
 * ce qui permet à l'appelant de décider si le dossier peut passer en "complet".
 */
async function enregistrerValeurs(pdvId, valeursParCode, options = {}) {
  const definitions = await PdvAttribut.findAll({ where: { actif: true } });
  const parCode = new Map(definitions.map((d) => [d.code, d]));

  if (valeursParCode && typeof valeursParCode === 'object') {
    for (const [code, valeur] of Object.entries(valeursParCode)) {
      const def = parCode.get(code);
      // Un code inconnu (attribut supprimé/désactivé entre-temps) est ignoré
      // silencieusement plutôt que de faire échouer tout l'enregistrement.
      if (!def) continue;

      const brut = serialiser(def.type, valeur);
      const existante = await PdvAttributValeur.findOne({
        where: { pdv_id: pdvId, attribut_id: def.id },
        transaction: options.transaction
      });

      if (existante) {
        await existante.update({ valeur: brut }, { transaction: options.transaction });
      } else {
        await PdvAttributValeur.create(
          { pdv_id: pdvId, attribut_id: def.id, valeur: brut },
          { transaction: options.transaction }
        );
      }
    }
  }

  return manquants(pdvId, definitions, options);
}

/** Libellés des attributs obligatoires non renseignés pour ce PDV. */
async function manquants(pdvId, definitions = null, options = {}) {
  const defs = definitions || (await PdvAttribut.findAll({ where: { actif: true } }));
  const obligatoires = defs.filter((d) => d.obligatoire);
  if (obligatoires.length === 0) return [];

  const valeurs = await PdvAttributValeur.findAll({
    where: { pdv_id: pdvId },
    transaction: options.transaction
  });
  const parAttribut = new Map(valeurs.map((v) => [v.attribut_id, v.valeur]));

  return obligatoires
    .filter((d) => !estRenseignee(d.type, deserialiser(d.type, parAttribut.get(d.id) ?? null)))
    .map((d) => d.libelle);
}

/**
 * Charge les attributs d'un PDV sous une forme directement exploitable par le
 * formulaire web : la définition complète (libellé, type, options...) et la
 * valeur courante, y compris pour les attributs jamais renseignés.
 */
async function chargerPourPDV(pdvId) {
  const [definitions, valeurs] = await Promise.all([
    PdvAttribut.findAll({ where: { actif: true }, order: [['ordre', 'ASC'], ['id', 'ASC']] }),
    PdvAttributValeur.findAll({ where: { pdv_id: pdvId } })
  ]);

  const parAttribut = new Map(valeurs.map((v) => [v.attribut_id, v.valeur]));

  return definitions.map((d) => ({
    id: d.id,
    code: d.code,
    libelle: d.libelle,
    type: d.type,
    options: d.options || [],
    obligatoire: d.obligatoire,
    groupe: d.groupe,
    aide: d.aide,
    ordre: d.ordre,
    valeur: deserialiser(d.type, parAttribut.get(d.id) ?? null)
  }));
}

/**
 * Rend une valeur déjà désérialisée sous forme de texte lisible pour l'export
 * CSV — pas le même besoin que le formulaire web, qui veut des types natifs.
 */
function formaterPourExport(type, valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (type === 'liste_multiple') return Array.isArray(valeur) ? valeur.join('; ') : '';
  if (type === 'booleen') return valeur ? 'Oui' : 'Non';
  return String(valeur);
}

/**
 * Attributs actifs, dans l'ordre d'affichage du formulaire. Utilisé par
 * l'export CSV pour dériver une colonne par attribut sans toucher au
 * contrôleur à chaque nouvel attribut créé par l'admin.
 */
async function getActifsOrdonnes() {
  return PdvAttribut.findAll({ where: { actif: true }, order: [['ordre', 'ASC'], ['id', 'ASC']] });
}

/**
 * Valeurs de tous les attributs `definitions` pour l'ensemble des PDV
 * `pdvIds`, déjà formatées en texte, sous forme
 * Map<pdv_id, Map<code_attribut, texte>> — une seule requête plutôt qu'une
 * par PDV, pour ne pas plomber un export de plusieurs milliers de lignes.
 */
async function valeursPourExport(pdvIds, definitions) {
  const parPdv = new Map(pdvIds.map((id) => [id, new Map()]));
  if (pdvIds.length === 0 || definitions.length === 0) return parPdv;

  const parId = new Map(definitions.map((d) => [d.id, d]));
  const valeurs = await PdvAttributValeur.findAll({
    where: {
      pdv_id: pdvIds,
      attribut_id: definitions.map((d) => d.id)
    }
  });

  for (const v of valeurs) {
    const def = parId.get(v.attribut_id);
    if (!def) continue;
    const texte = formaterPourExport(def.type, deserialiser(def.type, v.valeur));
    parPdv.get(v.pdv_id)?.set(def.code, texte);
  }

  return parPdv;
}

module.exports = {
  serialiser,
  deserialiser,
  estRenseignee,
  formaterPourExport,
  enregistrerValeurs,
  manquants,
  chargerPourPDV,
  getActifsOrdonnes,
  valeursPourExport
};
