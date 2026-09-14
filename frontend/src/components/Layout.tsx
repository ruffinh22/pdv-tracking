import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Bell,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    if (relativePath === '') {
      return { title: 'Dashboard', subtitle: ROLE_DASHBOARD_SUBTITLE[(user?.role as any) ?? 'commercial'] };
    }
    return {
      title: page?.label ?? 'Tracking PDV',
      subtitle: PAGE_SUBTITLE[relativePath] ?? '',
    };
  }, [location.pathname, user?.role]);

  const currentPage = currentPageMeta;

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'U';

  const navLinkClasses = (active: boolean) =>
    `group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
      active
        ? 'bg-white/10 text-white'
        : 'text-ink-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-20 transition-all duration-200 overflow-hidden shadow-2xl bg-ink-950 ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className={`w-64 h-full flex flex-col transition-opacity duration-150 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Liseré tricolore */}
          <div className="flag-stripe shrink-0"><span /><span /><span /></div>

          {/* Brand */}
          <div className="flex items-center gap-3 h-16 px-5 border-b border-white/10 shrink-0">
            <div className="bg-white rounded-md px-2 py-1.5 shrink-0 shadow-sm">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-6 w-auto" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold text-white tracking-tight truncate">Tracking PDV</p>
              <p className="text-xs text-ink-400 truncate">Espace {roleLabel(user?.role)}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Menu</p>
            <ul className="space-y-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className={navLinkClasses(isActive(to))}>
                    {isActive(to) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-primary-500" />
                    )}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive(to) ? 'text-primary-400' : ''}`} />
                    {label}
                  </Link>
                </li>
              ))}

              {settingsItems.length > 0 && (
                <li className="pt-3">
                  <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Configuration</p>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`flex items-center justify-between w-full pl-4 pr-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isSettingsActive() ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Settings className={`w-[18px] h-[18px] ${isSettingsActive() ? 'text-primary-400' : ''}`} />
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
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-ink-400 hover:bg-white/5 hover:text-white'
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
            <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-white/5">
              <div className="w-9 h-9 rounded-md bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-ink-400 truncate">{roleLabel(user?.role)}</p>
              </div>
              <button
                onClick={logout}
                title="Déconnexion"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header
        className={`fixed top-0 right-0 z-10 transition-all duration-200 shadow-sm ${
          isSidebarOpen ? 'left-64' : 'left-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 gap-4 bg-white border-b border-ink-200">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
              title="Basculer le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-ink-900 truncate">{currentPage.title}</h1>
              {currentPage.subtitle && (
                <p className="text-xs text-ink-500 truncate hidden sm:block">{currentPage.subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden md:block" ref={searchBoxRef}>
              <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                className="w-56 lg:w-72 pl-9 pr-3 py-2 text-sm bg-ink-50 border border-ink-200 rounded-md text-ink-800 placeholder:text-ink-400
                           focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-400 focus:bg-white transition-colors"
              />

              {isSearchOpen && debouncedQuery.length >= 2 && (
                <div className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-lg border border-ink-200 shadow-popover py-2 z-[2000]">
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

            <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors" title="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-white" />
            </button>

            <div className="h-6 w-px bg-ink-200 hidden sm:block" />

            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-md hover:bg-ink-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="text-left hidden sm:block leading-tight">
                  <p className="text-sm font-medium text-ink-800">{user?.prenom} {user?.nom}</p>
                  <p className="text-xs text-ink-500">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-ink-400" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-ink-200 shadow-popover py-1.5 z-20">
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
        className={`pt-16 transition-all duration-200 ${isSidebarOpen ? 'pl-64' : 'pl-0'}`}
      >
        {location.pathname === '/tracking' ? (
          <Outlet />
        ) : (
          <div className="p-6 lg:p-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;