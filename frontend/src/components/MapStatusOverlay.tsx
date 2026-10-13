import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Jusqu'ici, si le script Google Maps échouait à charger (clé manquante,
 * invalide, API non activée, facturation non activée côté Google Cloud,
 * restriction de domaine, réseau bloqué...), rien ne s'affichait : la carte
 * restait une simple zone vide, et seule la console navigateur contenait
 * l'erreur. Cet overlay rend le problème visible directement dans l'app, avec
 * le message d'erreur réel renvoyé par le chargeur.
 */
const MapStatusOverlay = ({ erreur }: { erreur: string | null }) => {
  if (!erreur) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white p-4">
      <div className="max-w-sm text-center">
        <AlertTriangle className="w-6 h-6 text-danger-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-ink-700">Carte indisponible</p>
        <p className="text-xs text-ink-500 mt-1">{erreur}</p>
      </div>
    </div>
  );
};

export default MapStatusOverlay;
