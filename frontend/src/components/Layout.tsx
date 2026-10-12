import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import DocumentTitle from './DocumentTitle';
import InstitutionFooter from './InstitutionFooter';
import BrandBadge from './BrandBadge';
import { INSTITUTION } from '../config/institution';
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Users,
  Menu,
  X,
  Activity,
  FileText,
  Package,
  Settings,
  ChevronDown,
  Search,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../contexts/authContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pdvService } from '../services/pdvService';
import { produitService } from '../services/produitService';
import { agenceService } from '../services/agenceService';
import { PAGES, ROLE_DASHBOARD_SUBTITLE, roleLabel } from '../config/permissions';

// Icônes et sous-titres associés à chaque page déclarée dans permissions.ts.
// permissions.ts reste la seule source de vérité pour QUI a accès à QUOI ;
// ceci n'est que l'habillage visuel du menu.
const PAGE_ICON: Record<string, typeof LayoutDashboard> = {
  '': LayoutDashboard,
  pdv: MapPin,
  tracking: Activity,
  alertes: AlertTriangle,
  reporting: FileText,
  users: Users,
  agences: Building2,
  produits: Package,
  geofence: MapPin,
};

const PAGE_SUBTITLE: Record<string, string> = {
  pdv: 'Gérez vos points de vente',
  tracking: 'Localisation live de vos équipes',
  alertes: 'Notifications et anomalies terrain',
  reporting: 'Analyse et exportation des données',
  users: 'Gestion des comptes et rôles',
  agences: 'Référentiel des agences',
  produits: 'Catalogue des produits vendus par les PDV',
  geofence: 'Zones géographiques et assignations',
};

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isNavOpen, setIsNavOpen] = useState(false); // menu repliable (mobile / tablette)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsNavOpen(false);
    setIsSettingsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setIsSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // --- Recherche globale (header) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const q = debouncedQuery.toLowerCase();
      const [pdvRes, produits, agences] = await Promise.all([
        pdvService.getAllPDVs(1, 6, { search: debouncedQuery }),
        produitService.getProduitsList().catch(() => []),
        agenceService.getAllAgencesList().catch(() => []),
      ]);
      return {
        pdv: pdvRes?.data || [],
        produits: (Array.isArray(produits) ? produits : []).filter((p: any) =>
          p.nom_produit?.toLowerCase().includes(q)
        ).slice(0, 5),
        agences: (Array.isArray(agences) ? agences : []).filter((a: any) =>
          a.nom_agence?.toLowerCase().includes(q)
        ).slice(0, 5),
      };
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const hasResults =
    !!searchResults &&
    (searchResults.pdv.length > 0 || searchResults.produits.length > 0 || searchResults.agences.length > 0);

  const goToResult = (path: string) => {
    navigate(path);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  // Espace de l'utilisateur connecté : navigation et pages "Paramètres"
  // dérivées de permissions.ts selon son rôle. C'est ce qui construit
  // l'espace dédié à chaque rôle (Agence / Commercial / Superviseur / Chef
  // de zone / Admin) — chacun ne voit que ce que son rôle autorise.
  const { navItems, settingsItems } = useMemo(() => {
    const visible = PAGES.filter((p) => !user?.role || p.roles.includes(user.role as any));
    const toItem = (p: (typeof PAGES)[number]) => ({
      to: p.path ? `/${p.path}` : '/',
      label: p.label,
      icon: PAGE_ICON[p.path] ?? LayoutDashboard,
    });
    return {
      navItems: visible.filter((p) => p.section === 'main').map(toItem),
      settingsItems: visible.filter((p) => p.section === 'settings').map(toItem),
    };
  }, [user?.role]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');
  const isSettingsActive = () => settingsItems.some((item) => isActive(item.to));
  const activeSetting = settingsItems.find((item) => isActive(item.to));

  const currentPageMeta = useMemo(() => {
    const relativePath = location.pathname.replace(/^\/+/, '').split('/')[0];
    const page = PAGES.find((p) => p.path === relativePath);
    const roleKey = (user?.role as keyof typeof ROLE_DASHBOARD_SUBTITLE | undefined) ?? 'commercial';
    if (relativePath === '') {
      return { title: 'Tableau de bord', subtitle: ROLE_DASHBOARD_SUBTITLE[roleKey] };
    }
    return {
      title: page?.label ?? 'Tracking PDV',
      subtitle: PAGE_SUBTITLE[relativePath] ?? '',
    };
  }, [location.pathname, user?.role]);

  const currentPage = currentPageMeta;

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'U';

  const SearchResults = () => (
    <div className="absolute right-0 mt-2 w-[26rem] max-w-[90vw] max-h-96 overflow-y-auto bg-white rounded-2xl border border-mist-200 shadow-popover py-2 z-[2000] text-ink-800">
      {isSearching ? (
        <div className="px-4 py-6 text-center text-sm text-ink-400">Recherche…</div>
      ) : !hasResults ? (
        <div className="px-4 py-6 text-center text-sm text-ink-400">Aucun résultat pour « {debouncedQuery} »</div>
      ) : (
        <>
          {searchResults!.pdv.length > 0 && (
            <div className="mb-1">
              <p className="px-4 py-1 font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-success-700">Points de vente</p>
              {searchResults!.pdv.map((pdv: any) => (
                <button
                  key={`pdv-${pdv.id}`}
                  onClick={() => goToResult(`/pdv/${pdv.id}`)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-mist-100 flex items-center gap-2.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-success-600 shrink-0" />
                  <span className="truncate">{pdv.nom_pdv}</span>
                  <span className="text-xs text-ink-400 ml-auto shrink-0">{pdv.msisdn_responsable}</span>
                </button>
              ))}
            </div>
          )}
          {searchResults!.produits.length > 0 && (
            <div className="mb-1">
              <p className="px-4 py-1 font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-success-700">Produits</p>
              {searchResults!.produits.map((p: any) => (
                <button
                  key={`produit-${p.id}`}
                  onClick={() => goToResult('/produits')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-mist-100 flex items-center gap-2.5"
                >
                  <Package className="w-3.5 h-3.5 text-success-600 shrink-0" />
                  <span className="truncate">{p.nom_produit}</span>
                </button>
              ))}
            </div>
          )}
          {searchResults!.agences.length > 0 && (
            <div>
              <p className="px-4 py-1 font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-success-700">Agences</p>
              {searchResults!.agences.map((a: any) => (
                <button
                  key={`agence-${a.id}`}
                  onClick={() => goToResult('/agences')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-mist-100 flex items-center gap-2.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-success-600 shrink-0" />
                  <span className="truncate">{a.nom_agence}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <a
        href="#main"
        className="absolute left-[-999px] top-2 z-[100] rounded-full bg-success-600 px-3 py-2 text-white focus:left-2"
      >
        Aller au contenu
      </a>

      {/* ---------- En-tête de navigation ---------- */}
      <header className="top-bar">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-wrap xl:flex-nowrap items-center gap-x-3 min-h-16">
          <Link to="/" className="flex items-center gap-3 text-white shrink-0 h-16" aria-label="Tracking PDV, accueil">
            <BrandBadge size={46} />
            <span className="w-px h-[26px] bg-white/25" />
            <span className="flex flex-col leading-[1.05]">
              <span className="font-display font-semibold text-[19px] uppercase tracking-[0.1em]">Tracking PDV</span>
              <span className="hidden min-[1400px]:block text-[9.5px] font-normal uppercase tracking-[0.14em] text-white/65 mt-0.5">
                {INSTITUTION.sigle} · Suivi des points de vente
              </span>
            </span>
          </Link>

          <button
            className="xl:hidden ml-auto inline-flex items-center justify-center w-[38px] h-[34px] rounded-[10px] border border-white/40 text-white"
            aria-expanded={isNavOpen}
            aria-label="Menu"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            className={`${isNavOpen ? 'flex' : 'hidden'} xl:flex basis-full xl:basis-auto xl:flex-1 flex-col xl:flex-row items-stretch xl:items-center gap-3 pb-3 xl:pb-0 min-w-0`}
          >
            <nav className="flex flex-wrap xl:flex-nowrap items-center gap-1 xl:ml-4" aria-label="Navigation principale">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={`nav-tab ${isActive(to) ? 'on' : ''}`} aria-current={isActive(to) ? 'page' : undefined}>
                  <Icon className="w-[15px] h-[15px]" />
                  {label}
                </Link>
              ))}

              {settingsItems.length > 0 && (
                <div className="relative" ref={settingsRef}>
                  <button
                    className={`nav-tab ${isSettingsActive() ? 'on' : ''}`}
                    aria-haspopup="menu"
                    aria-expanded={isSettingsOpen}
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    <Settings className="w-[15px] h-[15px]" />
                    {activeSetting?.label ?? 'Paramètres'}
                    <ChevronDown className={`w-[11px] h-[11px] opacity-70 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isSettingsOpen && (
                    <ul className="nav-menu xl:left-0 xl:right-auto max-xl:static max-xl:mt-1.5" role="menu">
                      <li className="px-4 pt-1.5 pb-1 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                        Configuration
                      </li>
                      {settingsItems.map(({ to, label, icon: Icon }) => (
                        <li key={to} role="none">
                          <Link to={to} className={`nav-item ${isActive(to) ? 'on' : ''}`} role="menuitem">
                            <Icon className="w-[15px] h-[15px] opacity-85" />
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </nav>

            <div className="xl:ml-auto flex flex-wrap xl:flex-nowrap items-center gap-2.5 xl:pl-3 xl:border-l xl:border-white/15 shrink-0">
              {/* Recherche globale */}
              <div className="relative w-full sm:w-auto" ref={searchBoxRef}>
                <Search className="w-4 h-4 text-white/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Rechercher…"
                  aria-label="Recherche globale"
                  className="w-full sm:w-44 xl:w-32 min-[1400px]:w-48 2xl:w-60 h-[34px] pl-10 pr-3 text-[13px] rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60
                             focus:outline-none focus:bg-white focus:text-ink-900 focus:placeholder:text-ink-400 focus:border-white transition-all"
                />
                {isSearchOpen && debouncedQuery.length >= 2 && <SearchResults />}
              </div>

              <div className="flex items-center gap-2.5 text-white">
                <span className="hidden 2xl:flex flex-col leading-tight text-right">
                  <b className="text-[12px] font-semibold">{user?.prenom} {user?.nom}</b>
                  <small className="text-[10px] opacity-75">{roleLabel(user?.role)}</small>
                </span>
                <span
                  className="w-[34px] h-[34px] rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[12px] font-semibold 2xl:hidden"
                  title={`${user?.prenom ?? ''} ${user?.nom ?? ''} · ${roleLabel(user?.role)}`}
                >
                  {initials}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-[.3rem] rounded-full bg-transparent text-white border border-white/55 text-[12.5px] font-medium whitespace-nowrap transition-colors hover:bg-white hover:text-success-700 hover:border-white"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <DocumentTitle title={currentPage.title} />

      {/* ---------- Contenu ---------- */}
      <main id="main" className="flex-1 flex flex-col">
        {location.pathname === '/tracking' ? (
          <Outlet />
        ) : (
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 w-full px-4 sm:px-6 py-6 lg:py-7 max-w-[1600px] mx-auto"
          >
            <Outlet />
          </motion.div>
        )}
      </main>
      {location.pathname !== '/tracking' && <InstitutionFooter />}
    </div>
  );
};

export default Layout;
