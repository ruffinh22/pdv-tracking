import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import DocumentTitle from './DocumentTitle';
import InstitutionFooter from './InstitutionFooter';
import BrandBadge from './BrandBadge';
import OfficialBand from './OfficialBand';
import A11yFixes from './A11yFixes';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import InactivityGuard from './InactivityGuard';
import CommandPalette, { type PaletteItem } from './CommandPalette';
import { useThemeStore } from '../contexts/themeStore';
import PrintHeader, { PrintSignature } from './PrintHeader';
import { INSTITUTION } from '../config/institution';
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Users,
  LogOut,
  HelpCircle,
  Printer,
  Moon,
  Sun,
  Activity,
  FileText,
  Package,
  Settings,
  ChevronDown,
  Search,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../contexts/authContext';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pdvService } from '../services/pdvService';
import { produitService } from '../services/produitService';
import { agenceService } from '../services/agenceService';
import { PAGES, ROLE_DASHBOARD_SUBTITLE, canAccess, roleLabel } from '../config/permissions';

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { mode: themeMode, toggle: toggleTheme } = useThemeStore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [menuAlignLeft, setMenuAlignLeft] = useState(false);
  const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER);
  const moreRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number>();
  const pointerType = useRef<string>('mouse');

  useEffect(() => {
    setIsMoreOpen(false);
    setMobileSearch(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setIsMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMoreOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Ouverture au survol (souris) avec une courte tolérance de sortie ; au toucher : tap pour ouvrir/fermer.
  const openMore = () => {
    window.clearTimeout(closeTimer.current);
    setIsMoreOpen(true);
  };
  const scheduleCloseMore = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsMoreOpen(false), 220);
  };

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
  const hasSettings = settingsItems.length > 0;

  // Les onglets qui ne tiennent pas dans la largeur disponible passent dans le menu déroulant.
  const recomputeOverflow = useCallback(() => {
    const nav = navRef.current;
    const meas = measureRef.current;
    if (!nav || !meas) return;
    const GAP = 4;
    const kids = Array.from(meas.children) as HTMLElement[];
    const widths = kids.slice(0, navItems.length).map((k) => k.offsetWidth);
    const settingsW = kids[navItems.length]?.offsetWidth ?? 120;
    const burgerW = kids[navItems.length + 1]?.offsetWidth ?? 100;
    const avail = nav.clientWidth - 8; // marge de sécurité (onglet actif en gras)
    const rowWidth = (k: number) => widths.slice(0, k).reduce((sum, w) => sum + w + GAP, 0);
    let count = navItems.length;
    const allFit = rowWidth(navItems.length) + (hasSettings ? settingsW : 0) <= avail;
    if (!allFit) {
      count = navItems.length;
      while (count > 0 && rowWidth(count) + burgerW > avail) count -= 1;
      // Si la place ne permet qu'un onglet + le bouton (2 emplacements) : on ne garde que le hamburger, qui contient tout.
      if (count === 1) count = 0;
    }
    setVisibleCount((prev) => (prev === count ? prev : count));
  }, [navItems, hasSettings]);

  useLayoutEffect(() => {
    recomputeOverflow();
    const ro = new ResizeObserver(recomputeOverflow);
    if (navRef.current) ro.observe(navRef.current);
    document.fonts?.ready.then(recomputeOverflow).catch(() => undefined);
    return () => ro.disconnect();
  }, [recomputeOverflow]);

  // Hauteur réelle de l'en-tête exposée en variable CSS (la carte Tracking s'y cale).
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Si le bouton est trop près du bord gauche, le menu s'aligne à gauche au lieu de sortir de l'écran.
  useLayoutEffect(() => {
    if (!isMoreOpen || !moreRef.current) return;
    const r = moreRef.current.getBoundingClientRect();
    setMenuAlignLeft(r.right - 248 < 8);
  }, [isMoreOpen, visibleCount]);

  const shownItems = navItems.slice(0, visibleCount);
  const hiddenItems = navItems.slice(visibleCount);
  const showMore = hiddenItems.length > 0 || hasSettings;
  const moreActive = hiddenItems.some((i) => isActive(i.to)) || settingsItems.some((i) => isActive(i.to));
  const isBurger = hiddenItems.length > 0;

  // Palette de commandes (Ctrl/⌘ + K)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleExpire = useCallback(() => {
    logout();
    navigate('/session-expiree', { replace: true });
  }, [logout, navigate]);

  const paletteBase = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = [...navItems, ...settingsItems].map((it) => ({
      id: `page-${it.to}`,
      label: it.label,
      icon: it.icon,
      group: 'Pages',
      run: () => navigate(it.to),
    }));
    pages.push({ id: 'page-aide', label: 'Aide et informations', icon: HelpCircle, group: 'Pages', run: () => navigate('/aide') });
    const actions: PaletteItem[] = [
      { id: 'act-theme', label: themeMode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre', icon: themeMode === 'dark' ? Sun : Moon, group: 'Actions', run: toggleTheme },
      { id: 'act-print', label: 'Imprimer cette page / Enregistrer en PDF', icon: Printer, group: 'Actions', run: () => setTimeout(() => window.print(), 150) },
      { id: 'act-logout', label: 'Se déconnecter', icon: LogOut, group: 'Actions', run: logout },
    ];
    return [...pages, ...actions];
  }, [navItems, settingsItems, navigate, themeMode, toggleTheme, logout]);

  const currentPageMeta = useMemo(() => {
    const relativePath = location.pathname.replace(/^\/+/, '').split('/')[0];
    const page = PAGES.find((p) => p.path === relativePath);
    const roleKey = (user?.role as keyof typeof ROLE_DASHBOARD_SUBTITLE | undefined) ?? 'commercial';
    if (relativePath === 'aide') return { title: 'Aide et informations', subtitle: '' };
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

      {location.pathname !== '/tracking' && <OfficialBand />}

      {/* ---------- En-tête de navigation ---------- */}
      <header className="top-bar" ref={headerRef}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-nowrap items-center gap-x-3 h-14 xl:h-16">
          {/* Marque */}
          <Link to="/" className="flex items-center gap-3 text-white shrink-0 h-full" aria-label="Tracking PDV, accueil">
            <BrandBadge size={44} />
            <span className="hidden sm:block w-px h-[26px] bg-white/25" />
            <span className="hidden sm:flex flex-col leading-[1.05]">
              <span className="font-display font-semibold text-[19px] max-[359px]:text-[16px] uppercase tracking-[0.1em] max-[359px]:tracking-[0.05em]">Tracking PDV</span>
              <span className="hidden min-[1800px]:block text-[9.5px] font-normal uppercase tracking-[0.14em] text-white/65 mt-0.5">
                {INSTITUTION.sigle} · Suivi des points de vente
              </span>
            </span>
          </Link>

          {/* Navigation : onglets visibles + menu déroulant des éléments qui manquent de place */}
          <nav
            ref={navRef}
            className="flex-1 min-w-0 relative flex items-center gap-1 ml-1 sm:ml-2 xl:ml-4"
            aria-label="Navigation principale"
          >
            {/* Couche de mesure invisible : largeur réelle de chaque onglet */}
            <div ref={measureRef} aria-hidden="true" className="fixed top-0 -left-[9999px] flex gap-1 invisible pointer-events-none whitespace-nowrap">
              {navItems.map(({ to, label, icon: Icon }) => (
                <span key={to} className="nav-tab">
                  <Icon className="w-[15px] h-[15px]" />
                  {label}
                </span>
              ))}
              <span className="nav-tab">
                <span className="hamb"><i /><i /><i /></span>
                <span className="hidden sm:inline">Paramètres</span>
                <ChevronDown className="w-[11px] h-[11px]" />
              </span>
              <span className="nav-tab">
                <span className="hamb"><i /><i /><i /></span>
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown className="w-[11px] h-[11px]" />
              </span>
            </div>

            {shownItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={`nav-tab ${isActive(to) ? 'on' : ''}`} aria-current={isActive(to) ? 'page' : undefined}>
                <Icon className="w-[15px] h-[15px]" />
                {label}
              </Link>
            ))}

            {showMore && (
              <div
                className="relative"
                ref={moreRef}
                onPointerEnter={(e) => {
                  pointerType.current = e.pointerType;
                  if (e.pointerType === 'mouse') openMore();
                }}
                onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleCloseMore()}
              >
                <button
                  className={`nav-tab ${moreActive ? 'on' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={isMoreOpen}
                  aria-label={isBurger ? (visibleCount === 0 ? 'Menu' : 'Plus') : 'Paramètres'}
                  onPointerDown={(e) => (pointerType.current = e.pointerType)}
                  onClick={() => (pointerType.current === 'mouse' ? openMore() : setIsMoreOpen((o) => !o))}
                >
                  {isBurger ? (
                    <span className="hamb" data-open={isMoreOpen} aria-hidden="true"><i /><i /><i /></span>
                  ) : (
                    <Settings className="w-[15px] h-[15px]" />
                  )}
                  <span className="hidden sm:inline">{isBurger ? (visibleCount === 0 ? 'Menu' : 'Plus') : 'Paramètres'}</span>
                  <ChevronDown className={`w-[11px] h-[11px] opacity-70 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMoreOpen && (
                  <div className={`nav-drop ${menuAlignLeft ? 'nav-drop--left' : ''}`}>
                    <ul className="nav-menu" role="menu">
                      {hiddenItems.length > 0 && (
                        <>
                          <li className="nav-heading">Navigation</li>
                          {hiddenItems.map(({ to, label, icon: Icon }, i) => (
                            <li key={to} role="none">
                              <Link to={to} className={`nav-item ${isActive(to) ? 'on' : ''}`} role="menuitem" style={{ animationDelay: `${i * 28}ms` }}>
                                <Icon className="w-[15px] h-[15px] opacity-85" />
                                {label}
                              </Link>
                            </li>
                          ))}
                        </>
                      )}
                      {hasSettings && (
                        <>
                          <li className={`nav-heading ${hiddenItems.length > 0 ? 'nav-heading--sep' : ''}`}>Configuration</li>
                          {settingsItems.map(({ to, label, icon: Icon }, i) => (
                            <li key={to} role="none">
                              <Link to={to} className={`nav-item ${isActive(to) ? 'on' : ''}`} role="menuitem" style={{ animationDelay: `${(hiddenItems.length + i) * 28}ms` }}>
                                <Icon className="w-[15px] h-[15px] opacity-85" />
                                {label}
                              </Link>
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Recherche globale : champ sur grand écran, icône qui déploie le champ sur petit écran */}
          <div
            className={`${mobileSearch ? 'absolute left-0 right-0 top-full px-4 sm:px-6 py-2.5 bg-[var(--brand)] shadow-nav border-t border-white/15' : 'hidden'} xl:block xl:relative xl:p-0 xl:bg-transparent xl:shadow-none xl:border-0 xl:left-auto xl:right-auto xl:top-auto`}
            ref={searchBoxRef}
          >
            <Search className={`w-4 h-4 text-white/70 absolute ${mobileSearch ? 'left-[1.9rem] sm:left-[2.4rem]' : 'left-3.5'} xl:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]`} />
            <input
              type="text"
              value={searchQuery}
              autoFocus={mobileSearch}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                  setMobileSearch(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Rechercher…"
              aria-label="Recherche globale"
              className="w-full xl:w-32 min-[1400px]:w-48 h-[34px] pl-10 pr-3 text-[13px] rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60
                         focus:outline-none focus:bg-white focus:text-ink-900 focus:placeholder:text-ink-400 focus:border-white transition-all"
            />
            {isSearchOpen && debouncedQuery.length >= 2 && <SearchResults />}
          </div>

          {/* Compte */}
          <div className="flex items-center gap-2 text-white xl:pl-3 xl:border-l xl:border-white/15 shrink-0">
            <button
              className="nav-round xl:hidden"
              aria-label="Rechercher"
              aria-expanded={mobileSearch}
              onClick={() => setMobileSearch((v) => !v)}
            >
              <Search className="w-4 h-4" />
            </button>
            {canAccess(user?.role, 'alertes') && <NotificationBell />}
            <UserMenu
              nom={`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()}
              role={roleLabel(user?.role)}
              initiales={initials}
              onLogout={logout}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          </div>
        </div>
      </header>

      <DocumentTitle title={currentPage.title} />

      {/* ---------- Contenu ---------- */}
      <main id="main" className="flex-1 flex flex-col">
        <PrintHeader titre={currentPage.title} auteur={`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()} />
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} base={paletteBase} />
      <InactivityGuard actif={location.pathname !== '/tracking'} onExpire={handleExpire} />
      <A11yFixes />
      <PrintSignature />
      {location.pathname !== '/tracking' && <InstitutionFooter />}
    </div>
  );
};

export default Layout;
