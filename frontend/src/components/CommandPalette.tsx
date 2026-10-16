import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CornerDownLeft, MapPin, Package, Search, type LucideIcon } from 'lucide-react';
import { pdvService } from '../services/pdvService';
import { produitService } from '../services/produitService';
import { agenceService } from '../services/agenceService';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: 'Pages' | 'Actions' | 'Points de vente' | 'Produits' | 'Agences';
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  base: PaletteItem[];
}

const sans = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Palette de commandes (Ctrl+K) : aller à une page, lancer une action, chercher un PDV. */
export default function CommandPalette({ open, onClose, base }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: distants } = useQuery({
    queryKey: ['palette-search', debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const n = sans(debounced);
      const [pdvRes, produits, agences] = await Promise.all([
        pdvService.getAllPDVs(1, 6, { search: debounced }),
        produitService.getProduitsList().catch(() => []),
        agenceService.getAllAgencesList().catch(() => []),
      ]);
      return {
        pdv: (pdvRes?.data ?? []) as any[],
        produits: ((Array.isArray(produits) ? produits : []) as any[]).filter((p) => sans(p.nom_produit ?? '').includes(n)).slice(0, 4),
        agences: ((Array.isArray(agences) ? agences : []) as any[]).filter((a) => sans(a.nom_agence ?? '').includes(n)).slice(0, 4),
      };
    },
  });

  const items = useMemo<PaletteItem[]>(() => {
    const n = sans(q.trim());
    const locaux = base.filter((i) => !n || sans(i.label).includes(n));
    const res: PaletteItem[] = [...locaux];
    if (distants && debounced.length >= 2) {
      const go = (path: string) => () => navigate(path);
      distants.pdv.forEach((p) => res.push({ id: `pdv-${p.id}`, label: p.nom_pdv, hint: p.msisdn_responsable, icon: MapPin, group: 'Points de vente', run: go(`/pdv/${p.id}`) }));
      distants.produits.forEach((p) => res.push({ id: `pr-${p.id}`, label: p.nom_produit, icon: Package, group: 'Produits', run: go('/produits') }));
      distants.agences.forEach((a) => res.push({ id: `ag-${a.id}`, label: a.nom_agence, icon: Building2, group: 'Agences', run: go('/agences') }));
    }
    return res;
  }, [base, q, distants, debounced, navigate]);

  useEffect(() => setIndex(0), [q, items.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const lancer = (i: PaletteItem | undefined) => {
    if (!i) return;
    onClose();
    setTimeout(i.run, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); lancer(items[index]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let dernierGroupe = '';

  return (
    <div className="fixed inset-0 z-[3500] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 pt-[12vh]" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Recherche rapide">
      <div className="w-full max-w-[580px] overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: 'var(--shadow-lg)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
          <Search className="h-[18px] w-[18px] text-success-600" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Aller à une page, chercher un PDV, une agence…"
            aria-label="Recherche rapide"
            className="flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="rounded border px-1.5 py-px text-[10.5px] text-ink-500" style={{ borderColor: 'var(--border-strong)' }}>Échap</kbd>
        </div>

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-2" role="listbox">
          {items.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-ink-400">Aucun résultat pour « {q} »</li>
          )}
          {items.map((it, i) => {
            const titre = it.group !== dernierGroupe;
            dernierGroupe = it.group;
            const Icon = it.icon;
            return (
              <li key={it.id} role="presentation">
                {titre && <div className="px-5 pb-1 pt-2.5 font-display text-[11.5px] font-semibold uppercase tracking-[0.16em] text-success-700">{it.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-idx={i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => lancer(it)}
                  className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors ${i === index ? 'bg-mist-100 text-ink-950' : 'text-ink-700'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${i === index ? 'text-success-600' : 'text-ink-400'}`} />
                  <span className="truncate font-medium">{it.label}</span>
                  {it.hint && <span className="ml-auto shrink-0 text-xs text-ink-400">{it.hint}</span>}
                  {i === index && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-400" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t px-5 py-2 text-[11px] text-ink-400" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <span><kbd className="font-sans">↑↓</kbd> naviguer</span>
          <span><kbd className="font-sans">Entrée</kbd> ouvrir</span>
          <span className="ml-auto">Ctrl K pour rouvrir</span>
        </div>
      </div>
    </div>
  );
}
