import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Command, HelpCircle, LogOut, Moon, Printer, RotateCcw, Sun } from 'lucide-react';
import { useAuthStore } from '../contexts/authContext';
import { useThemeStore } from '../contexts/themeStore';

interface Props {
  nom: string;
  role: string;
  initiales: string;
  onLogout: () => void;
  onOpenPalette: () => void;
}

/** Menu du compte : thème clair/sombre, raccourcis, aide, impression, déconnexion. */
export default function UserMenu({ nom, role, initiales, onLogout, onOpenPalette }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { mode, toggle } = useThemeStore();
  const userId = useAuthStore((st) => st.user?.id);

  const formater = (cle: string) => {
    try {
      const v = userId ? localStorage.getItem(`${cle}:${userId}`) : null;
      if (!v) return null;
      const d = new Date(v);
      return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch { return null; }
  };
  const sessionDepuis = open ? formater('login:last') : null;
  const precedente = open ? formater('login:prev') : null;

  const reinitialiserPreferences = () => {
    const prefixe = `prefs:${userId ?? 'anon'}:`;
    Object.keys(localStorage).filter((k) => k.startsWith(prefixe)).forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const item = 'nav-item w-[calc(100%-12px)] text-left';

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-full pr-1 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu du compte de ${nom}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="w-[34px] h-[34px] rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[12px] font-semibold hover:bg-white/25 transition-colors">
          {initiales}
        </span>
      </button>

      {open && (
        <div className="nav-drop">
          <ul className="nav-menu" role="menu" style={{ minWidth: 250 }}>
            <li className="px-4 pt-2 pb-2.5 border-b border-white/10 mb-1">
              <b className="block text-[13px] text-white font-semibold truncate">{nom}</b>
              <small className="text-[11.5px] text-white/60">{role}</small>
              {(sessionDepuis || precedente) && (
                <div className="mt-2 space-y-0.5 text-[10.5px] leading-snug text-white/50" title="Relevé effectué sur cet appareil">
                  {sessionDepuis && <p>Session ouverte le {sessionDepuis}</p>}
                  {precedente && <p>Connexion précédente le {precedente}</p>}
                </div>
              )}
            </li>
            <li role="none">
              <button role="menuitemcheckbox" aria-checked={mode === 'dark'} className={item} onClick={toggle}>
                {mode === 'dark' ? <Sun className="w-[15px] h-[15px]" /> : <Moon className="w-[15px] h-[15px]" />}
                {mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              </button>
            </li>
            <li role="none">
              <button role="menuitem" className={item} onClick={() => { setOpen(false); onOpenPalette(); }}>
                <Command className="w-[15px] h-[15px]" />
                Recherche rapide
                <kbd className="ml-auto text-[10.5px] text-white/50 border border-white/20 rounded px-1.5 py-px">Ctrl K</kbd>
              </button>
            </li>
            <li role="none">
              <Link to="/aide" role="menuitem" className={item} onClick={() => setOpen(false)}>
                <HelpCircle className="w-[15px] h-[15px]" />
                Aide et informations
              </Link>
            </li>
            <li role="none">
              <button role="menuitem" className={item} onClick={() => { setOpen(false); setTimeout(() => window.print(), 150); }}>
                <Printer className="w-[15px] h-[15px]" />
                Imprimer cette page
              </button>
            </li>
            <li role="none">
              <button role="menuitem" className={item} onClick={reinitialiserPreferences}>
                <RotateCcw className="w-[15px] h-[15px]" />
                Réinitialiser mes filtres
              </button>
            </li>
            <li role="none" className="mt-1 pt-1 border-t border-white/10">
              <button role="menuitem" className={`${item} !text-[#ff9b9b]`} onClick={onLogout}>
                <LogOut className="w-[15px] h-[15px]" />
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
