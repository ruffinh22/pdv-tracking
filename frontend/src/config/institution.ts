/**
 * Identité institutionnelle affichée dans l'en-tête et le pied de page.
 * Modifiez ces valeurs ici : aucune autre édition n'est nécessaire.
 */
export const INSTITUTION = {
  nom: 'Loterie Nationale de Côte d’Ivoire',
  sigle: 'LONACI',
  systeme: 'Système de suivi des points de vente',
  /** Laissez vide ('') pour masquer la mention dans le pied de page. */
  republique: 'République de Côte d’Ivoire',
  devise: 'Union · Discipline · Travail',
  mention: 'Accès réservé au personnel autorisé. Les données affichées sont confidentielles.',
  version: 'v1.0',
} as const;

/** Rubrique affichée dans le fil d'Ariane, selon la route. */
export const RUBRIQUES: Record<string, string> = {
  '/pdv': 'Exploitation',
  '/tracking': 'Exploitation',
  '/alertes': 'Exploitation',
  '/geofence': 'Exploitation',
  '/reporting': 'Pilotage',
  '/users': 'Administration',
  '/agences': 'Administration',
  '/produits': 'Administration',
  '/pdv-attributs': 'Administration',
};
