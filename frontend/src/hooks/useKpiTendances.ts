import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService, type FiltrePeriode } from '../services/dashboardService';
import { useAuthStore } from '../contexts/authContext';
import { usePersistedState } from './usePersistedState';

export interface Tendance {
  serie: number[];
  delta: number;
  pct: number | null;
  suffix: string;
  /** « api » : série fournie par le serveur · « local » : relevés de cet appareil. */
  source: 'api' | 'local';
  titre: string;
}

const CLES_LOCALES = ['pdv_actifs', 'pdv_tagues_aujourdhui', 'alertes_actives', 'pdv_muets'] as const;
const JOUR_MS = 86_400_000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Tendances des cartes d'indicateurs.
 * - « PDV tagués » : vraie série journalière du serveur (reporting), fenêtre au choix (7 ou 30 jours)
 *   comparée à la fenêtre précédente de même durée.
 * - Autres indicateurs (pas d'historique côté serveur) : relevés quotidiens mémorisés sur cet appareil,
 *   comparés au dernier relevé d'un jour précédent. Uniquement hors filtres, pour rester comparables.
 */
export function useKpiTendances(valeurs: Record<string, number>, filtres: FiltrePeriode, pret: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const [fenetre, setFenetre] = usePersistedState<7 | 30>('dash:tendance', 7);
  const sansFiltre = !Object.values(filtres).some(Boolean);

  // --- Série serveur : PDV tagués par jour ---
  const bornes = useMemo(() => {
    const fin = new Date();
    fin.setHours(23, 59, 59, 0);
    const debut = new Date(fin.getTime() - (2 * fenetre - 1) * JOUR_MS);
    debut.setHours(0, 0, 0, 0);
    return { debut: debut.toISOString(), fin: fin.toISOString() };
  }, [fenetre]);

  const { data: reporting } = useQuery({
    queryKey: ['tendance-tagues', fenetre, filtres],
    queryFn: () => dashboardService.getReporting({ ...bornes, ...filtres }),
    enabled: pret,
    staleTime: 10 * 60_000,
    retry: false,
  });

  // --- Relevés locaux ---
  const cleStock = `kpi-hist:${userId ?? 'anon'}`;
  const [releves, setReleves] = useState<Record<string, Record<string, number>>>(() => {
    try { return JSON.parse(localStorage.getItem(cleStock) ?? '{}'); } catch { return {}; }
  });

  useEffect(() => {
    if (!pret || !sansFiltre) return;
    const aujourdhui = iso(new Date());
    setReleves((prev) => {
      const suivant = { ...prev, [aujourdhui]: Object.fromEntries(CLES_LOCALES.map((k) => [k, valeurs[k] ?? 0])) };
      const limite = iso(new Date(Date.now() - 45 * JOUR_MS));
      Object.keys(suivant).forEach((j) => j < limite && delete suivant[j]);
      try { localStorage.setItem(cleStock, JSON.stringify(suivant)); } catch { /* quota */ }
      return suivant;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, sansFiltre, ...CLES_LOCALES.map((k) => valeurs[k])]);

  const tendances = useMemo(() => {
    const res: Record<string, Tendance | undefined> = {};

    // Série serveur
    const courbe = reporting?.enrolement?.courbe;
    if (courbe) {
      const parJour = new Map(courbe.map((c) => [String(c.jour).slice(0, 10), Number(c.total) || 0]));
      const fin = new Date();
      const jours = Array.from({ length: 2 * fenetre }, (_, i) => iso(new Date(fin.getTime() - (2 * fenetre - 1 - i) * JOUR_MS)));
      const valeursJ = jours.map((j) => parParJour(parJour, j));
      const precedente = valeursJ.slice(0, fenetre).reduce((a, b) => a + b, 0);
      const courante = valeursJ.slice(fenetre).reduce((a, b) => a + b, 0);
      res.pdv_tagues_aujourdhui = {
        serie: valeursJ.slice(fenetre),
        delta: courante - precedente,
        pct: precedente > 0 ? ((courante - precedente) / precedente) * 100 : null,
        suffix: `${fenetre} j`,
        source: 'api',
        titre: `PDV tagués sur les ${fenetre} derniers jours (${courante.toLocaleString('fr-FR')}) comparés aux ${fenetre} jours précédents (${precedente.toLocaleString('fr-FR')}).`,
      };
    }

    // Relevés locaux (hors « tagués » si la série serveur est disponible)
    if (sansFiltre) {
      const aujourdhui = iso(new Date());
      const dates = Object.keys(releves).sort();
      const precedents = dates.filter((d) => d < aujourdhui);
      if (precedents.length > 0) {
        const refDate = precedents[precedents.length - 1];
        const fenetreDates = dates.slice(-fenetre);
        const [, mm, dd] = refDate.split('-');
        CLES_LOCALES.forEach((k) => {
          if (res[k]) return;
          const actuel = releves[aujourdhui]?.[k];
          const avant = releves[refDate]?.[k];
          if (actuel === undefined || avant === undefined) return;
          res[k] = {
            serie: fenetreDates.map((d) => releves[d]?.[k] ?? 0),
            delta: actuel - avant,
            pct: avant > 0 ? ((actuel - avant) / avant) * 100 : null,
            suffix: `${dd}/${mm}`,
            source: 'local',
            titre: `Comparé à votre dernier relevé sur cet appareil (${dd}/${mm}) : ${avant.toLocaleString('fr-FR')}.`,
          };
        });
      }
    }
    return res;
  }, [reporting, releves, fenetre, sansFiltre]);

  return { fenetre, setFenetre, tendances };
}

function parParJour(map: Map<string, number>, jour: string) {
  return map.get(jour) ?? 0;
}
