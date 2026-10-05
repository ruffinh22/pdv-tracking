import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { BRAND, CHART, CHART_SERIES, axisProps, tooltipProps } from '../lib/theme';
import CountUp from '../components/CountUp';
import AnalyseClassement from '../components/AnalyseClassement';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, BellOff, ChevronDown, Inbox } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { DashboardSkeleton } from '../components/Skeleton';
import {
  MapPin, AlertTriangle, Activity, Download, ArrowUpRight,
  Users2, UserX, PieChart as PieChartIcon, Navigation
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { dashboardService, telechargerBlob, Periode, Dimension } from '../services/dashboardService';
import { pdvService } from '../services/pdvService';
import LeafletMap from '../components/LeafletMap';
import FiltresOrganisation, { ValeursFiltresOrganisation } from '../components/FiltresOrganisation';
import toast from 'react-hot-toast';
import { useAuthStore } from '../contexts/authContext';
import { ROLE_DASHBOARD_SUBTITLE, ROLE_DIMENSIONS, Role } from '../config/permissions';

const KPI_CARDS = [
  {
    key: 'pdv_actifs',
    label: 'PDV Actifs',
    caption: 'Points de vente en activité',
    icon: MapPin,
    iconBg: 'bg-success-50 ring-1 ring-success-200',
    iconColor: 'text-success-600',
    tone: 'text-success-600',
  },
  {
    key: 'pdv_tagues_aujourdhui',
    label: "Tagués aujourd'hui",
    caption: 'Nouveaux PDV enrôlés',
    icon: Navigation,
    iconBg: 'bg-primary-50 ring-1 ring-primary-200',
    iconColor: 'text-primary-600',
    tone: 'text-primary-600',
  },
  {
    key: 'alertes_actives',
    label: 'Alertes Actives',
    caption: 'Nécessitent une action',
    icon: AlertTriangle,
    iconBg: 'bg-danger-50 ring-1 ring-danger-200',
    iconColor: 'text-danger-600',
    tone: 'text-danger-500',
  },
  {
    key: 'pdv_muets',
    label: 'Terminaux muets',
    caption: 'Sans remontée GPS récente',
    icon: Activity,
    iconBg: 'bg-ink-100 ring-1 ring-ink-200',
    iconColor: 'text-brand-700',
    tone: 'text-brand-600',
  },
];

const PERIODE_LABEL: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: '7 derniers jours',
  mois: '30 derniers jours',
  all: 'Depuis le début',
};

const ALL_DIMENSION_OPTIONS: { value: Dimension; label: string }[] = [
  { value: 'ville', label: 'Ville' },
  { value: 'commune', label: 'Commune' },
  { value: 'quartier', label: 'Quartier' },
  { value: 'agence', label: 'Agence' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'superviseur', label: 'Superviseur' },
  { value: 'chef_zone', label: 'Chef de zone' },
];

const PIE_COLORS = CHART_SERIES;

const Dashboard = () => {
  const { user } = useAuthStore();
  const role = (user?.role as Role) ?? 'commercial';

  // Options d'analyse transverse restreintes au périmètre du rôle connecté
  // (ex: un Commercial n'a pas de sens à se ventiler "par commercial").
  const DIMENSION_OPTIONS = useMemo(
    () => ALL_DIMENSION_OPTIONS.filter((d) => ROLE_DIMENSIONS[role]?.includes(d.value)),
    [role]
  );

  const [periode, setPeriode] = useState<Periode>('jour');
  const [produitsPeriode, setProduitsPeriode] = useState<Periode>('all');
  const [dimension, setDimension] = useState<Dimension>('ville');
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [instrusStatut, setInstrusStatut] = useState<string>('');

  // Filtres transverses (par agent commercial, chef de zone, superviseur,
  // agence) : appliqués à tous les blocs du dashboard ci-dessous, et repris
  // tels quels par l'export Excel.
  const [filtresOrg, setFiltresOrg] = useState<ValeursFiltresOrganisation>({});

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis', filtresOrg],
    queryFn: () => dashboardService.getKPIs(filtresOrg),
  });

  const { data: alertesActives } = useQuery({
    queryKey: ['alertesActives'],
    queryFn: dashboardService.getAlertesActives,
  });

  // NOTE: `pdvActifs` query removed — variable was unused and caused a
  // TypeScript build error. If needed later, re-add the query and use the data.

  const { data: allPDVsResponse } = useQuery({
    queryKey: ['pdvsAllForMap'],
    queryFn: () => pdvService.getAllPDVsNoPagination(),
  });

  // Point 5 : PDV tagués / actifs / inactifs sur une période
  const { data: pdvStats } = useQuery({
    queryKey: ['pdvStats', periode, filtresOrg],
    queryFn: () => dashboardService.getPDVStats(periode, filtresOrg),
    placeholderData: keepPreviousData,
  });

  // Point 5 : nombre de PDV tagués par type de produit
  const { data: pdvParProduit = [] } = useQuery({
    queryKey: ['pdvParProduit', produitsPeriode, filtresOrg],
    queryFn: () => dashboardService.getPDVParProduit(produitsPeriode, filtresOrg),
    placeholderData: keepPreviousData,
  });

  // Point 5 : ratio de chaque produit vs la base totale de PDV tagués
  const { data: ratioProduits } = useQuery({
    queryKey: ['ratioProduits', produitsPeriode, filtresOrg],
    queryFn: () => dashboardService.getRatioProduits(produitsPeriode, filtresOrg),
    placeholderData: keepPreviousData,
  });

  // Point 3 : analyses transverses par dimension
  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses', dimension, filtresOrg],
    queryFn: () => dashboardService.getAnalyses(dimension, 'all', filtresOrg),
    // Garde les données précédentes pendant le rechargement : changer de
    // dimension ne doit pas faire clignoter tout le bloc en "Chargement…".
    placeholderData: keepPreviousData,
  });

  // Point 6 : intrus (PDV ayant quitté leur zone/position initiale)
  const { data: instrus = [], isLoading: instrusLoading } = useQuery({
    queryKey: ['instrus', instrusStatut, filtresOrg],
    queryFn: () => dashboardService.getInstrus(instrusStatut || undefined, filtresOrg),
    placeholderData: keepPreviousData,
  });

  const allPDVs: any[] = allPDVsResponse?.data || [];

  const handleExportExcel = async () => {
    try {
      const blob = await dashboardService.exportExcel(filtresOrg);
      telechargerBlob(blob, `tracking_pdv_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export Excel réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
    }
  };

  // Point 6 : export à tout moment des intrus
  const handleExportInstrus = async () => {
    try {
      const blob = await dashboardService.exportInstrusExcel(instrusStatut || undefined, filtresOrg);
      telechargerBlob(blob, `intrus_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export des intrus réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export des intrus');
    }
  };

  const values: Record<string, number> = {
    pdv_actifs: kpis?.pdv_actifs || 0,
    pdv_tagues_aujourdhui: kpis?.pdv_tagues_aujourdhui || 0,
    alertes_actives: kpis?.alertes_actives || 0,
    pdv_muets: kpis?.pdv_muets || 0,
  };

  const produitsChartData = useMemo(() => {
    return (pdvParProduit || []).map((p: any) => ({ name: p.produit, total: p.total_pdv }));
  }, [pdvParProduit]);

  const columnsAnalyses: ColumnDef<any>[] = [
    {
      id: 'label',
      header: analyses?.libelle ?? 'Dimension',
      accessorFn: (l) => l.label,
      meta: { mobileTitle: true },
      cell: ({ getValue }) => <span className="font-bold text-ink-950">{getValue() as string}</span>,
    },
    { id: 'total', header: 'Total PDV', accessorFn: (l) => l.total, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-bold num">{(getValue() as number).toLocaleString('fr-FR')}</span> },
    { id: 'actifs', header: 'Actifs', accessorFn: (l) => l.actifs, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-bold text-success-700 num">{(getValue() as number).toLocaleString('fr-FR')}</span> },
    { id: 'inactifs', header: 'Inactifs', accessorFn: (l) => l.inactifs, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-semibold text-ink-600 num">{(getValue() as number).toLocaleString('fr-FR')}</span> },
  ];

  const columnsIntrus: ColumnDef<any>[] = [
    {
      id: 'pdv',
      header: 'PDV',
      accessorFn: (a) => a.pdv?.nom_pdv || '',
      meta: { mobileTitle: true },
      cell: ({ getValue }) => <span className="font-bold text-ink-950">{(getValue() as string) || '—'}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (a) => (a.type_alerte === 'sortie_zone' ? 'Sortie de zone' : 'Déplacement anormal'),
    },
    {
      id: 'distance',
      header: 'Distance',
      accessorFn: (a) => Number(a.distance_metres) || 0,
      cell: ({ row }) => (row.original.distance_metres ? `${Math.round(row.original.distance_metres)} m` : '—'),
    },
    {
      id: 'localisation',
      header: 'Localisation',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-ink-700">
          {[row.original.pdv?.quartier, row.original.pdv?.commune, row.original.pdv?.ville].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (a) => new Date(a.horodatage).getTime(),
      cell: ({ row }) => <span className="text-xs font-medium text-ink-600">{new Date(row.original.horodatage).toLocaleString('fr-FR')}</span>,
    },
    {
      id: 'statut',
      header: 'Statut',
      accessorFn: (a) => a.statut,
      cell: ({ row }) => (
        <span className={row.original.statut === 'non_traitee' ? 'badge badge-danger' : row.original.statut === 'en_cours' ? 'badge badge-warning' : 'badge badge-success'}>
          {row.original.statut}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={'Tableau de bord'}
        subtitle={<>{ROLE_DASHBOARD_SUBTITLE[role]} · Situation au{' '}
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>}
        actions={<><button onClick={handleExportExcel} className="btn btn-primary shrink-0">
          <Download className="w-4 h-4" />
          Export Excel
        </button></>}
      />

      {/* Filtres transverses : agent commercial, chef de zone, superviseur, agence */}
      <FiltresOrganisation role={role} valeurs={filtresOrg} onChange={setFiltresOrg} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {KPI_CARDS.map(({ key, label, caption, icon: Icon, iconBg, iconColor, tone }) => (
          <div key={key} title={caption} className={`group kpi-card flex items-center gap-3.5 px-4 py-3.5 ${tone}`}>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0 leading-none">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-500 truncate">{label}</p>
              <p className="font-display text-[1.75rem] font-extrabold text-ink-950 tracking-tight mt-1.5 num">
                <CountUp value={values[key]} />
              </p>
            </div>
            <div className="absolute left-0 inset-y-0 w-1 bg-current" />
          </div>
        ))}
      </div>

      {/* Point 5 : PDV tagués / inactifs par période */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <div>
            <h2>Statuts des PDV</h2>
            <p className="text-xs font-semibold text-ink-500 mt-0.5 pl-3.5">
              {PERIODE_LABEL[periode]} · statut de fiche, indépendant du GPS
            </p>
          </div>
          <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1">
            {(['jour', 'semaine', 'mois', 'all'] as Periode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  periode === p ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {p === 'all' ? 'Tout' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-ink-100 lg:divide-y-0 lg:divide-x">
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 border border-primary-100 shrink-0">
              <Users2 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none"><CountUp value={pdvStats?.tagues ?? 0} /></p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">PDV tagués</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-success-50 text-success-600 border border-success-100 shrink-0">
              <Activity className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none"><CountUp value={pdvStats?.actifs ?? 0} /></p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">Fiches actives</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-ink-100 text-ink-500 border border-ink-200 shrink-0">
              <UserX className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none"><CountUp value={pdvStats?.inactifs ?? 0} /></p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">Fiches inactives</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-danger-50 text-danger-600 border border-danger-100 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none"><CountUp value={pdvStats?.suspendus ?? 0} /></p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">Fiches suspendues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Point 5 : PDV par produit + ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel-pro">
          <div className="panel-pro-head">
            <h2>PDV tagués par produit</h2>
            <select
              value={produitsPeriode}
              onChange={(e) => setProduitsPeriode(e.target.value as Periode)}
              className="toolbar-select !py-1.5"
            >
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">7 derniers jours</option>
              <option value="mois">30 derniers jours</option>
              <option value="all">Tout</option>
            </select>
          </div>
          <div className="p-6 h-72">
            {produitsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produitsChartData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={110} {...axisProps} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="total" fill={BRAND.orange} radius={[0, 6, 6, 0]} name="PDV" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={BarChart3} message="Aucune donnée sur la période" hint="Élargissez la période ou retirez un filtre." />
            )}
          </div>
        </div>

        <div className="panel-pro">
          <div className="panel-pro-head">
            <h2 className="text-base font-semibold text-ink-900 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-ink-400" /> Ratio produit vs base taguée
            </h2>
            <span className="text-xs text-ink-400">{ratioProduits?.total_pdv_tagues ?? 0} PDV au total</span>
          </div>
          <div className="p-6">
            {ratioProduits && ratioProduits.produits.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ratioProduits.produits}
                        dataKey="total_pdv"
                        nameKey="produit"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {ratioProduits.produits.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipProps} formatter={(value: any, _name, props: any) => [`${value} PDV (${props.payload.pourcentage}%)`, props.payload.produit]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {ratioProduits.produits.map((p, idx) => (
                    <div key={p.produit_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-ink-700 truncate">{p.produit}</span>
                      </div>
                      <span className="text-ink-500 shrink-0 ml-2">{p.total_pdv} · {p.pourcentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-56"><EmptyState icon={BarChart3} message="Aucune donnée sur la période" /></div>
            )}
          </div>
        </div>
      </div>

      {/* Point 3 : analyses transverses */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <h2>Analyses par {DIMENSION_OPTIONS.find(d => d.value === dimension)?.label ?? DIMENSION_OPTIONS[0]?.label}</h2>
          {DIMENSION_OPTIONS.length > 1 && (
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as Dimension)}
              className="toolbar-select !py-1.5"
            >
              {DIMENSION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          )}
        </div>
        <AnalyseClassement
          data={analyses?.data ?? []}
          loading={analysesLoading}
          dimensionLabel={(DIMENSION_OPTIONS.find((d) => d.value === dimension)?.label ?? 'zone').toLowerCase()}
        />
        {analyses && analyses.data.length > 0 && (
          <div className="border-t border-ink-200">
            <button
              onClick={() => setDetailOuvert((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-3 text-[12px] font-bold text-ink-700 hover:bg-ink-50 transition-colors"
              aria-expanded={detailOuvert}
            >
              <span>{detailOuvert ? 'Masquer le détail' : 'Afficher le détail en tableau'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${detailOuvert ? 'rotate-180' : ''}`} />
            </button>
            {detailOuvert && (
              <DataTable
                data={analyses.data.slice(0, 15)}
                columns={columnsAnalyses}
                getRowId={(l) => l.label}
                minWidth={480}
              />
            )}
          </div>
        )}
      </div>

      {/* Point 1 & 6 : Intrus (PDV ayant quitté leur zone initiale) */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <div>
            <h2 className="text-base font-semibold text-ink-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-danger-500" /> Intrus — activité suspecte
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">PDV ayant quitté leur zone ou leur position initiale (&gt; 500m)</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={instrusStatut}
              onChange={(e) => setInstrusStatut(e.target.value)}
              className="toolbar-select !py-1.5"
            >
              <option value="">Tous les statuts</option>
              <option value="non_traitee">Non traitées</option>
              <option value="en_cours">En cours</option>
              <option value="traitee">Traitées</option>
            </select>
            <button onClick={handleExportInstrus} className="btn btn-secondary !py-1.5">
              <Download className="w-3.5 h-3.5" />
              Exporter
            </button>
          </div>
        </div>
        <DataTable
          data={instrus.slice(0, 20)}
          columns={columnsIntrus}
          loading={instrusLoading}
          getRowId={(a: any) => String(a.id)}
          minWidth={760}
          emptyMessage="Aucun intrus détecté"
          emptyIcon={<Inbox className="w-6 h-6" />}
        />
      </div>

      {/* Map Section */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <h2>Carte en temps réel</h2>
          <span className="text-xs text-ink-400">{allPDVs?.length || 0} point(s) géolocalisé(s)</span>
        </div>
        <div className="h-96 bg-ink-50">
          {allPDVs && allPDVs.length > 0 ? (
            <LeafletMap pdvs={allPDVs} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-ink-400 text-sm">Aucun PDV avec position GPS disponible</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <h2>Alertes récentes</h2>
          {/* <Link> et non <a href> : un <a> déclenche une navigation
              navigateur, donc un rechargement complet de l'application
              (re-téléchargement du bundle, perte du cache React Query,
              re-login visuel). <Link> reste dans le routeur. */}
          {alertesActives && alertesActives.length > 0 && (
            <Link to="/alertes" className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:text-primary-700">
              Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <div className="p-4">
          {alertesActives && alertesActives.length > 0 ? (
            <div className="space-y-1">
              {alertesActives.slice(0, 5).map((alerte: any) => (
                <div key={alerte.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-ink-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-danger-50 text-danger-600 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 text-sm truncate">{alerte.type_alerte}</p>
                      <p className="text-sm text-ink-500 truncate">{alerte.description}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{new Date(alerte.horodatage).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="badge badge-danger shrink-0">
                    {alerte.statut}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BellOff} message="Aucune alerte récente" hint="Tout est calme sur votre périmètre." />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
