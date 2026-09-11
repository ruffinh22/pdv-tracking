import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar, DollarSign, ShoppingCart, MapPin, Users, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const Reporting = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customDateRange, setCustomDateRange] = useState({ debut: '', fin: '' });
  const [selectedReport, setSelectedReport] = useState<'ventes' | 'produits' | 'zones' | 'pdv'>('ventes');

  const { data: ventesPeriode } = useQuery({
    queryKey: ['ventesPeriode', selectedPeriod, customDateRange],
    queryFn: async () => {
      if (selectedPeriod === 'custom' && customDateRange.debut && customDateRange.fin) {
        return dashboardService.getVentesPeriode(customDateRange.debut, customDateRange.fin);
      }
      // Calculer les dates selon la période
      const now = new Date();
      let debut = '';
      let fin = now.toISOString();

      if (selectedPeriod === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        debut = today.toISOString();
      } else if (selectedPeriod === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        debut = weekAgo.toISOString();
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        debut = monthAgo.toISOString();
      }

      return dashboardService.getVentesPeriode(debut, fin);
    },
  });

  const { data: ventesParProduit } = useQuery({
    queryKey: ['ventesParProduit'],
    queryFn: dashboardService.getVentesParProduit,
  });

  const { data: ventesParZone } = useQuery({
    queryKey: ['ventesParZone'],
    queryFn: dashboardService.getVentesParZone,
  });

  const { data: pdvActifs } = useQuery({
    queryKey: ['pdvActifs'],
    queryFn: dashboardService.getPDVActifs,
  });

  const handleExportExcel = async () => {
    try {
      let debut = '';
      let fin = '';

      if (selectedPeriod === 'custom' && customDateRange.debut && customDateRange.fin) {
        debut = customDateRange.debut;
        fin = customDateRange.fin;
      } else {
        const now = new Date();
        if (selectedPeriod === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          debut = today.toISOString();
        } else if (selectedPeriod === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          debut = weekAgo.toISOString();
        } else if (selectedPeriod === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          debut = monthAgo.toISOString();
        }
        fin = now.toISOString();
      }

      const blob = await dashboardService.exportExcel(debut, fin);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_tracking_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export Excel réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
    }
  };

  const prepareChartData = () => {
    if (selectedReport === 'ventes' && ventesPeriode) {
      // Grouper par ville pour le graphique avec montants
      const groupedByVille = ventesPeriode.reduce((acc: any, vente: any) => {
        const ville = vente.ville || 'Non déterminé';
        acc[ville] = (acc[ville] || 0) + (vente.montant || 0);
        return acc;
      }, {});

      return Object.entries(groupedByVille).map(([ville, montant]) => ({
        ville,
        montant: Number(montant || 0)
      }));
    }
    
    if (selectedReport === 'produits' && ventesParProduit) {
      return ventesParProduit.map((item: any) => ({
        produit: item.produit,
        quantite: item.total,
        montant: Number(item.montant_total || 0)
      }));
    }
    
    if (selectedReport === 'zones' && ventesParZone) {
      return Object.entries(ventesParZone).map(([zone, count]) => ({
        zone,
        count: count as number
      }));
    }
    
    if (selectedReport === 'pdv' && pdvActifs) {
      return pdvActifs.map((pdv: any) => ({
        nom: pdv.nom_pdv,
        statut: pdv.statut,
        zone: pdv.zone?.nom_zone || 'Non assigné'
      }));
    }
    
    return [];
  };

  const chartData = prepareChartData();

  const tableData = () => {
    if (selectedReport === 'ventes' && ventesPeriode) {
      return ventesPeriode.map((vente: any) => ({
        msisdn: vente.pdv?.msisdn_responsable || 'Non déterminé',
        date: new Date(vente.horodatage).toLocaleDateString('fr-FR'),
        pays: vente.pays || 'Non déterminé',
        ville: vente.ville || 'Non déterminé',
        commune: vente.commune || 'Non déterminé',
        quartier: vente.quartier || 'Non déterminé',
        montant: Number(vente.montant || 0)
      }));
    }
    return chartData;
  };

  const reportOptions = [
    { id: 'ventes', icon: ShoppingCart, label: 'Ventes', iconBg: 'bg-primary-600' },
    { id: 'produits', icon: DollarSign, label: 'Produits', iconBg: 'bg-success-600' },
    { id: 'zones', icon: MapPin, label: 'Zones', iconBg: 'bg-purple-500' },
    { id: 'pdv', icon: Users, label: 'PDV', iconBg: 'bg-warning-500' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Reporting</h1>
          <p className="text-sm text-ink-500 mt-0.5">Analyse et exportation des données</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="btn btn-primary"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Filtres de période */}
      <div className="card !p-4">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-ink-700">
            <Calendar className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-medium">Période</span>
          </div>
          
          <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg">
            {(['today', 'week', 'month', 'custom'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {period === 'today' ? 'Aujourd\'hui' : 
                 period === 'week' ? 'Cette semaine' : 
                 period === 'month' ? 'Ce mois' : 'Personnalisé'}
              </button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateRange.debut}
                onChange={(e) => setCustomDateRange({ ...customDateRange, debut: e.target.value })}
                className="input py-1.5"
              />
              <span className="text-ink-400 text-sm">à</span>
              <input
                type="date"
                value={customDateRange.fin}
                onChange={(e) => setCustomDateRange({ ...customDateRange, fin: e.target.value })}
                className="input py-1.5"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur de rapport */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportOptions.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`card !p-4 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-popover ${
              selectedReport === report.id ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <div className={`${report.iconBg} p-3 rounded-full`}>
              <report.icon className="w-5 h-5 text-white" />
            </div>
            <span className="font-medium text-sm text-ink-800">{report.label}</span>
          </button>
        ))}
      </div>

      {/* Graphique principal */}
      <div className="panel !p-0">
        <div className="px-6 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold text-ink-900">
            {selectedReport === 'ventes' ? 'Ventes par ville' :
             selectedReport === 'produits' ? 'Ventes par produit' :
             selectedReport === 'zones' ? 'Ventes par zone' :
             'Statistiques PDV'}
          </h2>
        </div>
        
        <div className="h-96 p-6">
          {selectedReport === 'ventes' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                <XAxis dataKey="ville" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="montant" fill="#5641d6" name="Montant total" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {selectedReport === 'produits' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                <XAxis dataKey="produit" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantite" fill="#16a35a" name="Quantité" radius={[4, 4, 0, 0]} />
                <Bar dataKey="montant" fill="#5641d6" name="Montant" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {selectedReport === 'zones' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeef2" />
                <XAxis dataKey="zone" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {selectedReport === 'pdv' && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.reduce((acc: any, pdv: any) => {
                    const statut = pdv.statut;
                    acc[statut] = (acc[statut] || 0) + 1;
                    return acc;
                  }, {})}
                  dataKey="value"
                  name="Statut"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  <Pie fill="#16a35a" dataKey="value" name="Actif" />
                  <Pie fill="#9393a8" dataKey="value" name="Inactif" />
                  <Pie fill="#ef4444" dataKey="value" name="Suspendu" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tableau de données détaillées */}
      <div className="panel">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-ink-100">
          <FileText className="w-4 h-4 text-ink-400" />
          <h2 className="text-base font-semibold text-ink-900">Données détaillées</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {selectedReport === 'ventes' && (
                  <>
                    <th>MSISDN</th>
                    <th>Date</th>
                    <th>Pays</th>
                    <th>Ville</th>
                    <th>Commune</th>
                    <th>Quartier</th>
                    <th>Montant</th>
                  </>
                )}
                {selectedReport === 'produits' && (
                  <>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Montant total</th>
                  </>
                )}
                {selectedReport === 'zones' && (
                  <>
                    <th>Zone</th>
                    <th>Nombre de ventes</th>
                  </>
                )}
                {selectedReport === 'pdv' && (
                  <>
                    <th>Nom PDV</th>
                    <th>Statut</th>
                    <th>Zone</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {selectedReport === 'ventes' && tableData().map((item: any, index: number) => (
                <tr key={index}>
                  <td>{item.msisdn}</td>
                  <td>{item.date}</td>
                  <td>{item.pays}</td>
                  <td>{item.ville}</td>
                  <td>{item.commune}</td>
                  <td>{item.quartier}</td>
                  <td className="font-medium text-ink-900">{Number(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
              {selectedReport === 'produits' && chartData.map((item: any, index: number) => (
                <tr key={index}>
                  <td>{item.produit}</td>
                  <td>{item.quantite}</td>
                  <td className="font-medium text-ink-900">{Number(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
              {selectedReport === 'zones' && chartData.map((item: any, index: number) => (
                <tr key={index}>
                  <td>{item.zone}</td>
                  <td className="font-medium text-ink-900">{item.count}</td>
                </tr>
              ))}
              {selectedReport === 'pdv' && chartData.map((item: any, index: number) => (
                <tr key={index}>
                  <td>{item.nom}</td>
                  <td>
                    <span className={`badge ${
                      item.statut === 'actif' ? 'badge-success' :
                      item.statut === 'inactif' ? 'badge-neutral' :
                      'badge-danger'
                    }`}>
                      {item.statut}
                    </span>
                  </td>
                  <td>{item.zone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reporting;
