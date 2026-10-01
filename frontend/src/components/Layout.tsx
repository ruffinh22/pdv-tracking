import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import DocumentTitle from './DocumentTitle';
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Users,
  LogOut,
  Menu,
  Activity,
  FileText,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
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
  produits: 'Catalogue de produits pour les ventes',
  geofence: 'Zones géographiques et assignations',
};

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  // Ouvert par défaut sur grand écran ; sur mobile/tablette le menu est un tiroir fermé.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [location.pathname]);

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

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = () => settingsItems.some((item) => item.to === location.pathname);

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

  const navLinkClasses = (active: boolean) =>
    `group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-[0.94rem] font-semibold transition-colors duration-150 ${
      active
        ? 'bg-white/[0.09] text-white ring-1 ring-inset ring-white/10'
        : 'text-brand-100 hover:bg-white/[0.06] hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Voile derrière le tiroir (mobile / tablette) */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[15] bg-ink-950/55 backdrop-blur-[2px]"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-20 transition-all duration-200 overflow-hidden shadow-2xl bg-brand-950 ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className={`relative w-64 h-full flex flex-col transition-opacity duration-150 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-success-600/15 blur-3xl" />
          {/* Liseré tricolore */}
          <div className="flag-stripe shrink-0"><span /><span /><span /></div>

          {/* Brand */}
          <div className="relative flex items-center gap-3 h-[72px] px-4 border-b border-white/10 shrink-0">
            <div className="bg-white rounded-xl px-2.5 py-2 shrink-0 shadow-lg ring-1 ring-white/20 flex items-center justify-center">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-8 w-auto max-w-[92px] object-contain" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-display text-base font-extrabold text-white tracking-tight truncate">Tracking PDV</p>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary-400 truncate">{roleLabel(user?.role)}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-4 pb-2 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-brand-300">Menu</p>
            <ul className="space-y-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className={navLinkClasses(isActive(to))}>
                    {isActive(to) && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary-500 shadow-[0_0_12px_rgba(255,130,0,.8)]" />
                    )}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive(to) ? 'text-primary-400' : 'text-brand-300 group-hover:text-primary-300'}`} />
                    {label}
                  </Link>
                </li>
              ))}

              {settingsItems.length > 0 && (
                <li className="pt-3">
                  <p className="px-4 pb-2 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-brand-300">Configuration</p>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`flex items-center justify-between w-full pl-4 pr-3 py-2.5 rounded-lg text-[0.94rem] font-semibold transition-colors ${
                      isSettingsActive() ? 'bg-white/[0.09] text-white' : 'text-brand-100 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Settings className={`w-[18px] h-[18px] ${isSettingsActive() ? 'text-primary-400' : 'text-brand-300'}`} />
                      Paramètres
                    </span>
                    {isSettingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {isSettingsOpen && (
                    <ul className="mt-1 ml-4 pl-4 space-y-1 border-l border-white/10">
                      {settingsItems.map(({ to, label, icon: Icon }) => (
                        <li key={to}>
                          <Link
                            to={to}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                              isActive(to)
                                ? 'bg-primary-500/20 text-primary-200 font-bold'
                                : 'text-brand-200 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          </nav>

          {/* User footer */}
          <div className="p-3 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-white/[0.07] ring-1 ring-white/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-sm font-extrabold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-xs font-medium text-brand-200 truncate">{roleLabel(user?.role)}</p>
              </div>
              <button
                onClick={logout}
                title="Déconnexion"
                aria-label="Se déconnecter"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:bg-danger-500/25 hover:text-danger-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <DocumentTitle title={currentPage.title} />

      {/* Topbar */}
      <header
        className={`fixed top-0 right-0 z-10 transition-all duration-200 shadow-sm left-0 ${
          isSidebarOpen ? 'lg:left-64' : 'lg:left-0'
        }`}
      >
        <div className="flag-stripe"><span /><span /><span /></div>
        <div className="flex items-center justify-between h-[64px] px-3 sm:px-6 gap-3 sm:gap-4 bg-white/85 backdrop-blur-xl border-b border-ink-200">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
              title="Basculer le menu"
              aria-label="Basculer le menu"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Fil d'Ariane" className="min-w-0 flex items-center gap-2 text-sm">
              <span className="hidden sm:inline font-bold text-ink-500">LONACI</span>
              <ChevronRight className="hidden sm:block w-4 h-4 text-ink-300 shrink-0" />
              <span className="font-display text-base font-extrabold text-ink-950 truncate">{currentPage.title}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden md:block" ref={searchBoxRef}>
              <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                placeholder="Rechercher un PDV, produit, agence..."
                className="w-56 lg:w-80 pl-10 pr-3 py-2.5 text-sm font-medium bg-ink-50 border border-ink-200 rounded-xl text-ink-900 placeholder:text-ink-500
                           focus:outline-none focus:shadow-ring focus:border-success-600 focus:bg-white transition-all"
              />

              {isSearchOpen && debouncedQuery.length >= 2 && (
                <div className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-xl border border-ink-200 shadow-popover py-2 z-[2000]">
                  {isSearching ? (
                    <div className="px-4 py-6 text-center text-sm text-ink-400">Recherche...</div>
                  ) : !hasResults ? (
                    <div className="px-4 py-6 text-center text-sm text-ink-400">
                      Aucun résultat pour « {debouncedQuery} »
                    </div>
                  ) : (
                    <>
                      {searchResults!.pdv.length > 0 && (
                        <div className="mb-1">
                          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                            Points de vente
                          </p>
                          {searchResults!.pdv.map((pdv: any) => (
                            <button
                              key={`pdv-${pdv.id}`}
                              onClick={() => goToResult(`/pdv/${pdv.id}`)}
                              className="w-full text-left px-4 py-2 text-sm text-ink-700 hover:bg-primary-50 flex items-center gap-2"
                            >
                              <MapPin className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                              <span className="truncate">{pdv.nom_pdv}</span>
                              <span className="text-xs text-ink-400 ml-auto shrink-0">{pdv.msisdn_responsable}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.produits.length > 0 && (
                        <div className="mb-1">
                          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                            Produits
                          </p>
                          {searchResults!.produits.map((p: any) => (
                            <button
                              key={`produit-${p.id}`}
                              onClick={() => goToResult('/produits')}
                              className="w-full text-left px-4 py-2 text-sm text-ink-700 hover:bg-primary-50 flex items-center gap-2"
                            >
                              <Package className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                              <span className="truncate">{p.nom_produit}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.agences.length > 0 && (
                        <div>
                          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                            Agences
                          </p>
                          {searchResults!.agences.map((a: any) => (
                            <button
                              key={`agence-${a.id}`}
                              onClick={() => goToResult('/agences')}
                              className="w-full text-left px-4 py-2 text-sm text-ink-700 hover:bg-primary-50 flex items-center gap-2"
                            >
                              <Building2 className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                              <span className="truncate">{a.nom_agence}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>


            <div className="h-6 w-px bg-ink-200 hidden sm:block" />

            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-md hover:bg-ink-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white ring-2 ring-primary-500 flex items-center justify-center text-sm font-extrabold">
                  {initials}
                </div>
                <div className="text-left hidden sm:block leading-tight">
                  <p className="text-sm font-bold text-ink-900">{user?.prenom} {user?.nom}</p>
                  <p className="text-xs font-semibold text-ink-600">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-ink-400" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-ink-200 shadow-popover py-1.5 z-20">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className={`pt-[72px] transition-all duration-200 ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}
      >
        {location.pathname === '/tracking' ? (
          <Outlet />
        ) : (
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
          >
            <Outlet />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Layout;