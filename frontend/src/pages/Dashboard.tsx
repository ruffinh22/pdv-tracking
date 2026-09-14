import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, ShoppingCart, AlertTriangle, Activity, Download, ArrowUpRight,
  Users2, UserX, PieChart as PieChartIcon, Navigation
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { dashboardService, Periode, Dimension } from '../services/dashboardService';
import { pdvService } from '../services/pdvService';
import LeafletMap from '../components/LeafletMap';
import toast from 'react-hot-toast';
import { useAuthStore } from '../contexts/authContext';
import { ROLE_DASHBOARD_SUBTITLE, ROLE_DIMENSIONS, Role } from '../config/permissions';

const KPI_CARDS = [
  {
    key: 'pdv_actifs',
    label: 'PDV Actifs',
    caption: 'Points de vente en activité',
    icon: MapPin,
    accentBar: 'bg-primary-500',
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-600',
  },
  {
    key: 'ventes_aujourdhui',
    label: "Ventes Aujourd'hui",
    caption: 'Transactions enregistrées',
    icon: ShoppingCart,
    accentBar: 'bg-teal-500',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  {
    key: 'alertes_actives',
    label: 'Alertes Actives',
    caption: 'Nécessitent une action',
    icon: AlertTriangle,
    accentBar: 'bg-danger-500',
    iconBg: 'bg-danger-50',
    iconColor: 'text-danger-600',
  },
  {
    key: 'total_pdv',
    label: 'Total PDV',
    caption: 'Base complète référencée',
    icon: Activity,
    accentBar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
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

const PIE_COLORS = ['#e06e00', '#009a44', '#c98a00', '#d64545', '#3B82F6', '#795548', '#14B8A6', '#8f4500', '#00683a', '#6b6b78'];

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
  const [instrusStatut, setInstrusStatut] = useState<string>('');

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: dashboardService.getKPIs,
  });

  const { data: alertesActives } = useQuery({
    queryKey: ['alertesActives'],
    queryFn: dashboardService.getAlertesActives,
  });

  const { data: pdvActifs } = useQuery({
    queryKey: ['pdvActifs'],
    queryFn: dashboardService.getPDVActifs,
  });

  const { data: allPDVsResponse } = useQuery({
    queryKey: ['pdvsAllForMap'],
    queryFn: () => pdvService.getAllPDVsNoPagination(),
  });

  // Point 5 : PDV tagués / actifs / inactifs sur une période
  const { data: pdvStats } = useQuery({
    queryKey: ['pdvStats', periode],
    queryFn: () => dashboardService.getPDVStats(periode),
  });

  // Point 5 : nombre de PDV tagués par type de produit
  const { data: pdvParProduit = [] } = useQuery({
    queryKey: ['pdvParProduit', produitsPeriode],
    queryFn: () => dashboardService.getPDVParProduit(produitsPeriode),
  });

  // Point 5 : ratio de chaque produit vs la base totale de PDV tagués
  const { data: ratioProduits } = useQuery({
    queryKey: ['ratioProduits', produitsPeriode],
    queryFn: () => dashboardService.getRatioProduits(produitsPeriode),
  });

  // Point 3 : analyses transverses par dimension
  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses', dimension],
    queryFn: () => dashboardService.getAnalyses(dimension, 'all'),
  });

  // Point 6 : instrus (PDV ayant quitté leur zone/position initiale)
  const { data: instrus = [], isLoading: instrusLoading } = useQuery({
    queryKey: ['instrus', instrusStatut],
    queryFn: () => dashboardService.getInstrus(instrusStatut || undefined),
  });

  const allPDVs: any[] = allPDVsResponse?.data || [];

  const handleExportExcel = async () => {
    try {
      const blob = await dashboardService.exportExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tracking_pdv_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export Excel réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
    }
  };

  // Point 6 : export à tout moment des instrus
  const handleExportInstrus = async () => {
    try {
      const blob = await dashboardService.exportInstrusExcel(instrusStatut || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instrus_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export des instrus réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export des instrus');
    }
  };

  const values: Record<string, number> = {
    pdv_actifs: kpis?.pdv_actifs || 0,
    ventes_aujourdhui: kpis?.ventes_aujourdhui || 0,
    alertes_actives: kpis?.alertes_actives || 0,
    total_pdv: pdvActifs?.length || 0,
  };

  const analysesChartData = useMemo(() => {
    return (analyses?.data || []).slice(0, 10).map((l) => ({
      name: l.label.length > 16 ? `${l.label.slice(0, 16)}…` : l.label,
      Actifs: l.actifs,
      Inactifs: l.inactifs,
    }));
  }, [analyses]);

  const produitsChartData = useMemo(() => {
    return (pdvParProduit || []).map((p: any) => ({ name: p.produit, total: p.total_pdv }));
  }, [pdvParProduit]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-ink-400">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-ink-200">
        <div>
          <p className="text-sm font-medium text-ink-700">{ROLE_DASHBOARD_SUBTITLE[role]}</p>
          <p className="text-sm text-ink-500">
            Situation au {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={handleExportExcel} className="btn btn-primary shrink-0">
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map(({ key, label, caption, icon: Icon, accentBar, iconBg, iconColor }) => (
          <div
            key={key}
            className="group relative flex items-center gap-3 rounded-xl transition-all duration-200 p-3.5 kpi-card hover:shadow-lg hover:border-ink-300"
          >
            <div className={`absolute top-0 left-0 bottom-0 w-[3px] rounded-l-xl ${accentBar}`} />
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-ink-900 leading-none tracking-tight">{values[key]}</p>
              <p className="text-xs font-semibold text-ink-700 truncate mt-1">{label}</p>
              <p className="text-[11px] text-ink-400 truncate">{caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Point 5 : PDV tagués / inactifs par période */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Base PDV taguée</h2>
            <p className="text-xs text-ink-400 mt-0.5">{PERIODE_LABEL[periode]}</p>
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
              <p className="text-2xl font-bold text-ink-900 leading-none">{pdvStats?.tagues ?? 0}</p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">PDV tagués</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-success-50 text-success-600 border border-success-100 shrink-0">
              <Activity className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none">{pdvStats?.actifs ?? 0}</p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">PDV actifs</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-ink-100 text-ink-500 border border-ink-200 shrink-0">
              <UserX className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none">{pdvStats?.inactifs ?? 0}</p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">PDV inactifs</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-danger-50 text-danger-600 border border-danger-100 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-ink-900 leading-none">{pdvStats?.suspendus ?? 0}</p>
              <p className="text-xs text-ink-500 mt-1.5 truncate">PDV suspendus</p>
            </div>
          </div>
        </div>
      </div>

      {/* Point 5 : PDV par produit + ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel-pro">
          <div className="panel-pro-head">
            <h2 className="text-base font-semibold text-ink-900">PDV tagués par produit</h2>
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dadadf" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} axisLine={{ stroke: '#b9b9c2' }} tickLine={{ stroke: '#b9b9c2' }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} axisLine={{ stroke: '#b9b9c2' }} tickLine={{ stroke: '#b9b9c2' }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e06e00" radius={[0, 6, 6, 0]} name="PDV" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-ink-400 text-sm">Aucune donnée</div>
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
                      <Tooltip formatter={(value: any, _name, props: any) => [`${value} PDV (${props.payload.pourcentage}%)`, props.payload.produit]} />
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
              <div className="h-56 flex items-center justify-center text-ink-400 text-sm">Aucune donnée</div>
            )}
          </div>
        </div>
      </div>

      {/* Point 3 : analyses transverses */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <h2 className="text-base font-semibold text-ink-900">Analyses par {DIMENSION_OPTIONS.find(d => d.value === dimension)?.label ?? DIMENSION_OPTIONS[0]?.label}</h2>
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
        <div className="p-6 h-80">
          {analysesLoading ? (
            <div className="h-full flex items-center justify-center text-ink-400 text-sm">Chargement...</div>
          ) : analysesChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysesChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dadadf" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} axisLine={{ stroke: '#b9b9c2' }} tickLine={{ stroke: '#b9b9c2' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={{ stroke: '#b9b9c2' }} tickLine={{ stroke: '#b9b9c2' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Actifs" stackId="a" fill="#009a44" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Inactifs" stackId="a" fill="#dadadf" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-ink-400 text-sm">Aucune donnée pour cette dimension</div>
          )}
        </div>
        {analyses && analyses.data.length > 0 && (
          <div className="overflow-x-auto border-t border-ink-200">
            <table className="table">
              <thead>
                <tr>
                  <th>{analyses.libelle}</th>
                  <th>Total PDV</th>
                  <th>Actifs</th>
                  <th>Inactifs</th>
                </tr>
              </thead>
              <tbody>
                {analyses.data.slice(0, 15).map((l) => (
                  <tr key={l.label}>
                    <td className="font-medium text-ink-900">{l.label}</td>
                    <td className="text-ink-600">{l.total}</td>
                    <td className="text-ink-600">{l.actifs}</td>
                    <td className="text-ink-600">{l.inactifs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Point 1 & 6 : Instrus (PDV ayant quitté leur zone initiale) */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <div>
            <h2 className="text-base font-semibold text-ink-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-danger-500" /> Instrus — activité suspecte
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
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>PDV</th>
                <th>Type</th>
                <th>Distance</th>
                <th>Localisation</th>
                <th>Date</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {instrusLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-ink-400">Chargement...</td></tr>
              ) : instrus.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-ink-400">Aucun instrus détecté</td></tr>
              ) : (
                instrus.slice(0, 20).map((alerte: any) => (
                  <tr key={alerte.id}>
                    <td className="font-medium text-ink-900">{alerte.pdv?.nom_pdv || '—'}</td>
                    <td className="text-ink-600">
                      {alerte.type_alerte === 'sortie_zone' ? 'Sortie de zone' : 'Déplacement anormal'}
                    </td>
                    <td className="text-ink-600">{alerte.distance_metres ? `${Math.round(alerte.distance_metres)} m` : '—'}</td>
                    <td className="text-ink-600 text-xs">
                      {[alerte.pdv?.quartier, alerte.pdv?.commune, alerte.pdv?.ville].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="text-ink-500 text-xs">{new Date(alerte.horodatage).toLocaleString()}</td>
                    <td>
                      <span className={alerte.statut === 'non_traitee' ? 'badge badge-danger' : alerte.statut === 'en_cours' ? 'badge badge-warning' : 'badge badge-success'}>
                        {alerte.statut}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map Section */}
      <div className="panel-pro">
        <div className="panel-pro-head">
          <h2 className="text-base font-semibold text-ink-900">Carte en temps réel</h2>
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
          <h2 className="text-base font-semibold text-ink-900">Alertes récentes</h2>
          {alertesActives && alertesActives.length > 0 && (
            <a href="/alertes" className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:text-primary-700">
              Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
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
            <p className="text-ink-400 text-sm text-center py-6">Aucune alerte récente</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
