import { useEffect } from 'react';

let compteur = 0;

/**
 * Correctifs d'accessibilité appliqués en continu à l'interface :
 * 1. Les formes SVG des graphiques (Recharts, role="img" sans nom) sont marquées décoratives ;
 *    leurs données sont déjà disponibles en texte (légendes, tableaux).
 * 2. Les libellés de formulaire (<label>) sans attribut « for » sont reliés au champ qui les suit,
 *    pour que les lecteurs d'écran annoncent le nom de chaque champ.
 */
export default function A11yFixes() {
  useEffect(() => {
    const decorer = () => {
      document.querySelectorAll<SVGElement>('svg [role="img"]:not([aria-label]):not([aria-hidden])').forEach((el) => {
        if (!el.querySelector('title')) el.setAttribute('aria-hidden', 'true');
      });
    };

    const relierLibelles = () => {
      document.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach((label) => {
        if (label.querySelector('input, select, textarea')) return; // champ imbriqué : déjà associé
        // Premier champ rencontré après le libellé, dans le même bloc.
        let champ: Element | null = null;
        let frere: Element | null = label.nextElementSibling;
        while (frere && !champ) {
          champ = frere.matches('input, select, textarea') ? frere : frere.querySelector('input, select, textarea');
          frere = frere.nextElementSibling;
        }
        if (!champ || (champ as HTMLInputElement).type === 'hidden') return;
        if (!champ.id) champ.id = `champ-auto-${++compteur}`;
        label.htmlFor = champ.id;
      });
      // Liste déroulante sans nom : on reprend le libellé du bloc, à défaut l'option par défaut.
      document.querySelectorAll<HTMLSelectElement>('select:not([aria-label]):not([aria-labelledby])').forEach((sel) => {
        if (sel.id && document.querySelector(`label[for="${sel.id}"]`)) return;
        if (sel.closest('label')) return;
        const texte = sel.parentElement?.querySelector('label')?.textContent?.trim() || sel.options[0]?.text?.trim();
        if (texte) sel.setAttribute('aria-label', texte.replace(/[*:]+$/, '').trim());
      });
    };

    let tache = 0;
    const corriger = () => {
      cancelAnimationFrame(tache);
      tache = requestAnimationFrame(() => {
        decorer();
        relierLibelles();
      });
    };
    corriger();
    const obs = new MutationObserver(corriger);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(tache);
    };
  }, []);
  return null;
}
