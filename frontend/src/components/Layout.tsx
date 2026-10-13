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
  LogOut,
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
    const moreW = kids[navItems.length]?.offsetWidth ?? 120;
    const avail = nav.clientWidth - 8; // marge de sécurité (onglet actif en gras)
    const rowWidth = (k: number) => widths.slice(0, k).reduce((sum, w) => sum + w + GAP, 0);
    let count = navItems.length;
    const allFit = rowWidth(navItems.length) + (hasSettings ? moreW : 0) <= avail;
    if (!allFit) {
      count = navItems.length;
      while (count > 0 && rowWidth(count) + moreW > avail) count -= 1;
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
      <header className="top-bar" ref={headerRef}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-wrap xl:flex-nowrap items-center gap-x-3">
          {/* Marque */}
          <Link to="/" className="order-1 flex items-center gap-3 text-white shrink-0 h-14 xl:h-16" aria-label="Tracking PDV, accueil">
            <BrandBadge size={44} />
            <span className="w-px h-[26px] bg-white/25 max-[359px]:hidden" />
            <span className="flex flex-col leading-[1.05]">
              <span className="font-display font-semibold text-[19px] max-[359px]:text-[16px] uppercase tracking-[0.1em] max-[359px]:tracking-[0.05em]">Tracking PDV</span>
              <span className="hidden 2xl:block text-[9.5px] font-normal uppercase tracking-[0.14em] text-white/65 mt-0.5">
                {INSTITUTION.sigle} · Suivi des points de vente
              </span>
            </span>
          </Link>

          {/* Navigation : onglets visibles + menu déroulant des éléments qui manquent de place */}
          <nav
            ref={navRef}
            className="order-4 xl:order-2 basis-full xl:basis-auto xl:flex-1 min-w-0 relative flex items-center gap-1 pb-2.5 pt-1.5 xl:py-0 xl:ml-4 border-t border-white/10 xl:border-0"
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
                  aria-label={isBurger ? 'Menu' : 'Paramètres'}
                  onPointerDown={(e) => (pointerType.current = e.pointerType)}
                  onClick={() => (pointerType.current === 'mouse' ? openMore() : setIsMoreOpen((o) => !o))}
                >
                  {isBurger ? (
                    <span className="hamb" data-open={isMoreOpen} aria-hidden="true"><i /><i /><i /></span>
                  ) : (
                    <Settings className="w-[15px] h-[15px]" />
                  )}
                  <span className="hidden sm:inline">{isBurger ? 'Menu' : 'Paramètres'}</span>
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
            className={`relative ${mobileSearch ? 'order-5 basis-full pb-3' : 'hidden'} xl:block xl:order-3 xl:basis-auto xl:pb-0`}
            ref={searchBoxRef}
          >
            <Search className={`w-4 h-4 text-white/70 absolute left-3.5 ${mobileSearch ? 'top-[calc(50%-6px)]' : 'top-1/2'} xl:top-1/2 -translate-y-1/2 pointer-events-none`} />
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
              className="w-full xl:w-32 min-[1400px]:w-48 2xl:w-60 h-[34px] pl-10 pr-3 text-[13px] rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60
                         focus:outline-none focus:bg-white focus:text-ink-900 focus:placeholder:text-ink-400 focus:border-white transition-all"
            />
            {isSearchOpen && debouncedQuery.length >= 2 && <SearchResults />}
          </div>

          {/* Compte */}
          <div className="order-2 xl:order-4 ml-auto xl:ml-0 h-14 xl:h-auto flex items-center gap-2 text-white xl:pl-3 xl:border-l xl:border-white/15 shrink-0">
            <button
              className="nav-round xl:hidden"
              aria-label="Rechercher"
              aria-expanded={mobileSearch}
              onClick={() => setMobileSearch((v) => !v)}
            >
              <Search className="w-4 h-4" />
            </button>
            <span className="hidden 2xl:flex flex-col leading-tight text-right">
              <b className="text-[12px] font-semibold">{user?.prenom} {user?.nom}</b>
              <small className="text-[10px] opacity-75">{roleLabel(user?.role)}</small>
            </span>
            <span
              className="w-[34px] h-[34px] rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[12px] font-semibold 2xl:hidden max-[359px]:hidden"
              title={`${user?.prenom ?? ''} ${user?.nom ?? ''} · ${roleLabel(user?.role)}`}
            >
              {initials}
            </span>
            <button onClick={logout} className="nav-round sm:hidden" aria-label="Déconnexion" title="Déconnexion">
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              className="hidden sm:inline-block px-3 py-[.3rem] rounded-full bg-transparent text-white border border-white/55 text-[12.5px] font-medium whitespace-nowrap transition-colors hover:bg-white hover:text-success-700 hover:border-white"
            >
              Déconnexion
            </button>
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
