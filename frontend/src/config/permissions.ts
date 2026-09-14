/**
 * Source unique de vérité pour les "espaces" par rôle du back-office.
 *
 * Un seul endroit à modifier pour faire évoluer qui voit quoi : le menu
 * (Layout) et le garde-fou de navigation (RequireRole / App) lisent tous les
 * deux la même déclaration `PAGES`.
 *
 * Rappel de la hiérarchie de périmètre de données (appliquée côté API) :
 *   Chef de zone (sa zone) > Superviseur (son équipe) > Agence (son agence) > Commercial (lui-même)
 * L'admin n'a aucune restriction. Ce fichier ne gère que l'accès aux PAGES ;
 * le filtrage des DONNÉES à l'intérieur de chaque page est fait par l'API.
 */

export type Role = 'admin' | 'chef_zone' | 'superviseur' | 'agence' | 'commercial';

export const ALL_ROLES: Role[] = ['admin', 'chef_zone', 'superviseur', 'agence', 'commercial'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  chef_zone: 'Chef de zone',
  superviseur: 'Superviseur',
  agence: 'Agence',
  commercial: 'Commercial',
};

// Sous-titre du dashboard, adapté au périmètre de chaque espace.
export const ROLE_DASHBOARD_SUBTITLE: Record<Role, string> = {
  admin: "Vue d'ensemble de toute l'activité",
  chef_zone: 'Vue d\'ensemble de votre zone',
  superviseur: 'Vue d\'ensemble de votre équipe',
  agence: 'Vue d\'ensemble de votre agence',
  commercial: 'Vue d\'ensemble de votre activité',
};

// Options de la dimension d'analyse transverse du dashboard, restreintes aux
// niveaux de hiérarchie strictement au-dessus (ou au niveau) du rôle courant :
// un commercial n'a aucune raison de ventiler par "commercial" (ce serait lui
// tout seul), un chef de zone voit tout puisqu'il est le niveau le plus large.
export const ROLE_DIMENSIONS: Record<Role, string[]> = {
  admin: ['ville', 'commune', 'quartier', 'agence', 'commercial', 'superviseur', 'chef_zone'],
  chef_zone: ['ville', 'commune', 'quartier', 'agence', 'commercial', 'superviseur'],
  superviseur: ['ville', 'commune', 'quartier', 'agence', 'commercial'],
  agence: ['ville', 'commune', 'quartier', 'commercial'],
  commercial: ['ville', 'commune', 'quartier'],
};

export type NavSection = 'main' | 'settings';

export interface PageDef {
  /** Chemin de route relatif (sans slash initial) ; '' pour la racine "/". */
  path: string;
  label: string;
  section: NavSection;
  roles: Role[];
}

// Déclaration centrale des pages de l'espace back-office et des rôles
// autorisés à y accéder. C'est la SEULE source de vérité : le menu (Layout)
// et le garde-fou de route (RequireRole) sont tous deux dérivés de cette liste.
export const PAGES: PageDef[] = [
  { path: '', label: 'Dashboard', section: 'main', roles: ALL_ROLES },
  { path: 'pdv', label: 'Points de Vente', section: 'main', roles: ALL_ROLES },
  { path: 'tracking', label: 'Tracking', section: 'main', roles: ['admin', 'chef_zone', 'superviseur', 'agence'] },
  { path: 'alertes', label: 'Alertes', section: 'main', roles: ['admin', 'chef_zone', 'superviseur', 'agence'] },
  { path: 'reporting', label: 'Reporting', section: 'main', roles: ['admin', 'chef_zone', 'superviseur', 'agence'] },
  { path: 'users', label: 'Utilisateurs', section: 'settings', roles: ['admin'] },
  { path: 'agences', label: 'Agences', section: 'settings', roles: ['admin'] },
  { path: 'produits', label: 'Produits', section: 'settings', roles: ['admin'] },
  { path: 'geofence', label: 'Zones Geofence', section: 'settings', roles: ['admin'] },
];

/** true si le rôle donné a le droit d'accéder à la page (chemin relatif, sans slash initial). */
export function canAccess(role: string | undefined | null, path: string): boolean {
  const page = PAGES.find((p) => p.path === path);
  if (!page) return true; // page non déclarée ici (ex: pdv/:id) -> pas de restriction dédiée
  if (!role) return false;
  return page.roles.includes(role as Role);
}

export function roleLabel(role: string | undefined | null): string {
  if (!role) return '';
  return ROLE_LABELS[role as Role] ?? role;
}
