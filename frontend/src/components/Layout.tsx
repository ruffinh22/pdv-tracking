import { Outlet, Link, useLocation } from 'react-router-dom';
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
  Radar,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../contexts/authContext';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pdv', label: 'Points de Vente', icon: MapPin },
  { to: '/tracking', label: 'Tracking', icon: Activity },
  { to: '/alertes', label: 'Alertes', icon: AlertTriangle },
  { to: '/reporting', label: 'Reporting', icon: FileText },
];

const SETTINGS_ITEMS = [
  { to: '/users', label: 'Utilisateurs', icon: Users },
  { to: '/agences', label: 'Agences', icon: Building2 },
  { to: '/produits', label: 'Produits', icon: Package },
  { to: '/geofence', label: 'Zones Geofence', icon: MapPin },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: "Vue d'ensemble de votre activité" },
  '/pdv': { title: 'Points de Vente', subtitle: 'Gérez vos points de vente' },
  '/tracking': { title: 'Suivi en temps réel', subtitle: 'Localisation live de vos équipes' },
  '/alertes': { title: 'Alertes', subtitle: 'Notifications et anomalies terrain' },
  '/reporting': { title: 'Reporting', subtitle: 'Analyse et exportation des données' },
  '/users': { title: 'Utilisateurs', subtitle: 'Gestion des comptes et rôles' },
  '/agences': { title: 'Agences', subtitle: 'Référentiel des agences' },
  '/produits': { title: 'Produits', subtitle: 'Catalogue de produits pour les ventes' },
  '/geofence': { title: 'Zones Geofence', subtitle: 'Zones géographiques et assignations' },
};

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = () =>
    ['/users', '/agences', '/produits', '/geofence'].includes(location.pathname);

  const currentPage = PAGE_TITLES[location.pathname] ?? {
    title: 'Tracking PDV',
    subtitle: '',
  };

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'U';

  const navLinkClasses = (active: boolean) =>
    `group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-50 text-primary-700'
        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-ink-100 z-20 transition-all duration-200 overflow-hidden ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className={`w-64 h-full flex flex-col transition-opacity duration-150 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Brand */}
          <div className="flex items-center gap-3 h-16 px-5 border-b border-ink-100 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-ink-900">Tracking PDV</p>
              <p className="text-xs text-ink-400">Administration</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className={navLinkClasses(isActive(to))}>
                    {isActive(to) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary-600" />
                    )}
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}

              <li className="pt-2">
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`flex items-center justify-between w-full pl-4 pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isSettingsActive() ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Settings className="w-[18px] h-[18px]" />
                    Paramètres
                  </span>
                  {isSettingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {isSettingsOpen && (
                  <ul className="mt-1 ml-4 pl-4 space-y-1 border-l border-ink-100">
                    {SETTINGS_ITEMS.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <Link
                          to={to}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive(to)
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
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
            </ul>
          </nav>

          {/* User footer */}
          <div className="p-3 border-t border-ink-100 shrink-0">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900 truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-ink-400 truncate capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                title="Déconnexion"
                className="btn-icon"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header
        className={`fixed top-0 right-0 h-16 bg-white border-b border-ink-100 z-10 flex items-center justify-between px-6 gap-4 transition-all duration-200 ${
          isSidebarOpen ? 'left-64' : 'left-0'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="btn-icon"
            title="Basculer le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink-900 truncate">{currentPage.title}</h1>
            {currentPage.subtitle && (
              <p className="text-xs text-ink-400 truncate hidden sm:block">{currentPage.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-56 lg:w-72 pl-9 pr-3 py-2 text-sm bg-ink-50 border border-transparent rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:bg-white focus:border-primary-300 transition-colors"
            />
          </div>

          <button className="btn-icon relative" title="Notifications">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-white" />
          </button>

          <div className="h-6 w-px bg-ink-100 hidden sm:block" />

          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg hover:bg-ink-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
              <div className="text-left hidden sm:block leading-tight">
                <p className="text-sm font-medium text-ink-900">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-ink-400 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-ink-400" />
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-ink-100 shadow-popover py-1.5 z-20">
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