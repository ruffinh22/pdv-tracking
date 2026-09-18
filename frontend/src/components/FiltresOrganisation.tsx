import { useQuery } from '@tanstack/react-query';
import { Filter, X } from 'lucide-react';
import { userService } from '../services/userService';
import { agenceService } from '../services/agenceService';
import { ROLE_DIMENSIONS, Role } from '../config/permissions';

export interface ValeursFiltresOrganisation {
  commercial_id?: number;
  superviseur_id?: number;
  chef_zone_id?: number;
  agence_id?: number;
}

interface Props {
  role: Role;
  valeurs: ValeursFiltresOrganisation;
  onChange: (valeurs: ValeursFiltresOrganisation) => void;
  className?: string;
}

/**
 * Filtres transverses par agent commercial, chef de zone, superviseur et
 * agence — réutilisés sur le Dashboard et la page Reporting, et pris en
 * compte automatiquement par les exports Excel de ces deux pages (les mêmes
 * filtres sont simplement transmis à l'API).
 *
 * Chaque select n'est affiché que si la dimension a du sens pour le rôle
 * connecté (même logique que ROLE_DIMENSIONS utilisé pour l'analyse par
 * dimension) : un commercial n'a rien à filtrer "par commercial", il n'y en
 * a qu'un, lui-même. Le périmètre de données réel reste de toute façon
 * imposé côté API, ce filtre ne fait que le restreindre davantage.
 */
const FiltresOrganisation = ({ role, valeurs, onChange, className = '' }: Props) => {
  const autorise = (dimension: string) => ROLE_DIMENSIONS[role]?.includes(dimension) ?? false;

  const { data: commerciaux = [] } = useQuery({
    queryKey: ['users', 'commercial'],
    queryFn: () => userService.getUsersByRole('commercial'),
    enabled: autorise('commercial'),
  });

  const { data: superviseurs = [] } = useQuery({
    queryKey: ['users', 'superviseur'],
    queryFn: () => userService.getUsersByRole('superviseur'),
    enabled: autorise('superviseur'),
  });

  const { data: chefsZone = [] } = useQuery({
    queryKey: ['users', 'chef_zone'],
    queryFn: () => userService.getUsersByRole('chef_zone'),
    enabled: autorise('chef_zone'),
  });

  const { data: agences = [] } = useQuery({
    queryKey: ['agences', 'liste'],
    queryFn: () => agenceService.getAllAgencesList(),
    enabled: autorise('agence'),
  });

  const nombreActifs = Object.values(valeurs).filter((v) => v !== undefined && v !== null).length;

  const majChamp = (champ: keyof ValeursFiltresOrganisation, valeur: string) => {
    onChange({ ...valeurs, [champ]: valeur ? Number(valeur) : undefined });
  };

  if (!autorise('commercial') && !autorise('superviseur') && !autorise('chef_zone') && !autorise('agence')) {
    return null;
  }

  return (
    <div className={`flex items-center flex-wrap gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-ink-500 text-xs font-medium shrink-0">
        <Filter className="w-3.5 h-3.5" />
        Filtrer par
      </div>

      {autorise('agence') && (
        <select
          value={valeurs.agence_id ?? ''}
          onChange={(e) => majChamp('agence_id', e.target.value)}
          className="toolbar-select !py-1.5"
        >
          <option value="">Toutes les agences</option>
          {agences.map((a) => (
            <option key={a.id} value={a.id}>{a.nom_agence}</option>
          ))}
        </select>
      )}

      {autorise('chef_zone') && (
        <select
          value={valeurs.chef_zone_id ?? ''}
          onChange={(e) => majChamp('chef_zone_id', e.target.value)}
          className="toolbar-select !py-1.5"
        >
          <option value="">Tous les chefs de zone</option>
          {chefsZone.map((u) => (
            <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
          ))}
        </select>
      )}

      {autorise('superviseur') && (
        <select
          value={valeurs.superviseur_id ?? ''}
          onChange={(e) => majChamp('superviseur_id', e.target.value)}
          className="toolbar-select !py-1.5"
        >
          <option value="">Tous les superviseurs</option>
          {superviseurs.map((u) => (
            <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
          ))}
        </select>
      )}

      {autorise('commercial') && (
        <select
          value={valeurs.commercial_id ?? ''}
          onChange={(e) => majChamp('commercial_id', e.target.value)}
          className="toolbar-select !py-1.5"
        >
          <option value="">Tous les commerciaux</option>
          {commerciaux.map((u) => (
            <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
          ))}
        </select>
      )}

      {nombreActifs > 0 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="flex items-center gap-1 text-xs text-ink-500 hover:text-danger-600 font-medium px-2 py-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      )}
    </div>
  );
};

export default FiltresOrganisation;
