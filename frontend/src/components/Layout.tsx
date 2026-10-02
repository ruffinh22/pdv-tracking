import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import DocumentTitle from './DocumentTitle';
import InstitutionFooter from './InstitutionFooter';
import { INSTITUTION } from '../config/institution';
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
  produits: 'Catalogue des produits vendus par les PDV',
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
    `group relative flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-[4px] text-[14px] font-semibold transition-colors duration-150 ${
      active
        ? 'bg-white text-success-700 shadow-sm'
        : 'text-ink-600 hover:bg-white/75 hover:text-ink-900'
    }`;

  return (
    <div className="min-h-screen bg-[#e9edea]">
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
        className={`fixed left-0 top-0 h-full z-20 transition-all duration-200 overflow-hidden bg-[color:var(--sidebar-bg)] border-r border-ink-200 ${
          isSidebarOpen ? 'w-56' : 'w-0'
        }`}
      >
        <div className={`relative w-56 h-full flex flex-col transition-opacity duration-150 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Liseré tricolore */}
          <div className="flag-stripe shrink-0"><span /><span /><span /></div>

          {/* Brand */}
          <div className="relative flex items-center gap-3 h-[68px] px-4 border-b border-ink-200 shrink-0">
            <div className="bg-white border border-ink-200 rounded-[4px] px-2 py-1.5 shrink-0 flex items-center justify-center">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-7 w-auto max-w-[84px] object-contain" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-display text-[15px] font-bold text-ink-900 truncate">Tracking PDV</p>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 truncate">{roleLabel(user?.role)}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">Menu</p>
            <ul className="space-y-0.5">
              {navItems.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className={navLinkClasses(isActive(to))}>
                    {isActive(to) && (
                      <span className="absolute -left-3 top-1 bottom-1 w-[3px] rounded-r bg-success-600" />
                    )}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive(to) ? 'text-success-600' : 'text-ink-400 group-hover:text-ink-700'}`} />
                    {label}
                  </Link>
                </li>
              ))}

              {settingsItems.length > 0 && (
                <li className="pt-3">
                  <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">Configuration</p>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`flex items-center justify-between w-full pl-3 pr-3 py-2.5 rounded-[4px] text-[14px] font-medium transition-colors ${
                      isSettingsActive() ? 'bg-white text-success-700 shadow-sm' : 'text-ink-600 hover:bg-white/75 hover:text-ink-900'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Settings className={`w-[18px] h-[18px] ${isSettingsActive() ? 'text-success-600' : 'text-ink-400'}`} />
                      Paramètres
                    </span>
                    {isSettingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {isSettingsOpen && (
                    <ul className="mt-1 ml-4 pl-4 space-y-1 border-l border-ink-300">
                      {settingsItems.map(({ to, label, icon: Icon }) => (
                        <li key={to}>
                          <Link
                            to={to}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-[4px] text-[13px] transition-colors ${
                              isActive(to)
                                ? 'bg-white text-success-700 font-semibold shadow-sm'
                                : 'text-ink-500 hover:bg-white/75 hover:text-ink-900'
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
          <div className="p-3 border-t border-ink-200 shrink-0">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-[4px] bg-success-600 text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink-900 truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-[11px] font-medium text-ink-500 truncate">{roleLabel(user?.role)}</p>
              </div>
              <button
                onClick={logout}
                title="Déconnexion"
                aria-label="Se déconnecter"
                className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] text-ink-500 hover:bg-white hover:text-danger-600 transition-colors"
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
        className={`fixed top-0 right-0 z-10 transition-all duration-200 left-0 bg-white shadow-[0_1px_3px_rgba(10,30,20,0.12)] ${
          isSidebarOpen ? 'lg:left-56' : 'lg:left-0'
        }`}
      >
        <div className="flag-stripe"><span /><span /><span /></div>
        <div className="flex items-center justify-between h-[64px] px-3 sm:px-6 gap-3 sm:gap-4 bg-white border-b border-ink-300">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[4px] border border-ink-200 text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
              title="Basculer le menu"
              aria-label="Basculer le menu"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 leading-tight">
              <p className="font-display text-[14px] font-bold text-success-600 truncate">{INSTITUTION.nom}</p>
              <p className="hidden sm:block text-[11px] font-semibold text-ink-500 truncate">{INSTITUTION.systeme}</p>
            </div>
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
                className="w-56 lg:w-80 pl-10 pr-3 py-2 text-sm font-medium bg-white border border-ink-300 rounded-[4px] text-ink-900 placeholder:text-ink-500
                           focus:outline-none focus:shadow-ring focus:border-success-600 transition-all"
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


            <div className="h-8 w-px bg-ink-200 hidden sm:block" />

            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-[4px] hover:bg-ink-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-[4px] bg-success-600 text-white flex items-center justify-center text-[13px] font-semibold">
                  {initials}
                </div>
                <div className="text-left hidden sm:block leading-tight">
                  <p className="text-[13px] font-semibold text-ink-900">{user?.prenom} {user?.nom}</p>
                  <p className="text-[11px] font-medium text-ink-500">{roleLabel(user?.role)}</p>
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
        className={`pt-[76px] min-h-screen flex flex-col transition-all duration-200 ${isSidebarOpen ? 'lg:pl-56' : 'lg:pl-0'}`}
      >
        {location.pathname === '/tracking' ? (
          <Outlet />
        ) : (
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
          >
            <Outlet />
          </motion.div>
        )}
        {location.pathname !== '/tracking' && <InstitutionFooter />}
      </main>
    </div>
  );
};

export default Layout;