import { useCallback, useState } from 'react';
import { useAuthStore } from '../contexts/authContext';

/**
 * useState dont la valeur est mémorisée dans le navigateur, par utilisateur.
 * Sert aux filtres : chacun retrouve ses réglages habituels à son retour.
 */
export function usePersistedState<T>(cle: string, defaut: T) {
  const userId = useAuthStore((s) => s.user?.id);
  const cleComplete = `prefs:${userId ?? 'anon'}:${cle}`;

  const [valeur, setValeur] = useState<T>(() => {
    try {
      const brut = localStorage.getItem(cleComplete);
      return brut === null ? defaut : (JSON.parse(brut) as T);
    } catch {
      return defaut;
    }
  });

  const definir = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValeur((prev) => {
        const suivant = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try { localStorage.setItem(cleComplete, JSON.stringify(suivant)); } catch { /* quota / mode privé */ }
        return suivant;
      });
    },
    [cleComplete]
  );

  return [valeur, definir] as const;
}
