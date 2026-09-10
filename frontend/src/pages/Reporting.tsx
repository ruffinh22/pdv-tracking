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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reporting</h1>
          <p className="text-gray-600 mt-1">Analyse et exportation des données</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </button>
      </div>

      {/* Filtres de période */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium">Période:</span>
          </div>
          
          <div className="flex space-x-2">
            {(['today', 'week', 'month', 'custom'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === 'today' ? 'Aujourd\'hui' : 
                 period === 'week' ? 'Cette semaine' : 
                 period === 'month' ? 'Ce mois' : 'Personnalisé'}
              </button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={customDateRange.debut}
                onChange={(e) => setCustomDateRange({ ...customDateRange, debut: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              />
              <span className="text-gray-500">à</span>
              <input
                type="date"
                value={customDateRange.fin}
                onChange={(e) => setCustomDateRange({ ...customDateRange, fin: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur de rapport */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { id: 'ventes', icon: ShoppingCart, label: 'Ventes', color: 'bg-blue-500' },
          { id: 'produits', icon: DollarSign, label: 'Produits', color: 'bg-green-500' },
          { id: 'zones', icon: MapPin, label: 'Zones', color: 'bg-purple-500' },
          { id: 'pdv', icon: Users, label: 'PDV', color: 'bg-orange-500' }
        ].map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id as any)}
            className={`card p-4 flex flex-col items-center justify-center transition-all hover:shadow-lg ${
              selectedReport === report.id ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <div className={`${report.color} p-3 rounded-full mb-3`}>
              <report.icon className="w-6 h-6 text-white" />
            </div>
            <span className="font-medium">{report.label}</span>
          </button>
        ))}
      </div>

      {/* Graphique principal */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-6">
          {selectedReport === 'ventes' ? 'Ventes par ville' :
           selectedReport === 'produits' ? 'Ventes par produit' :
           selectedReport === 'zones' ? 'Ventes par zone' :
           'Statistiques PDV'}
        </h2>
        
        <div className="h-96">
          {selectedReport === 'ventes' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ville" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="montant" fill="#3b82f6" name="Montant total" />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {selectedReport === 'produits' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="produit" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantite" fill="#22c55e" name="Quantité" />
                <Bar dataKey="montant" fill="#3b82f6" name="Montant" />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {selectedReport === 'zones' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zone" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" />
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
                  <Pie fill="#22c55e" dataKey="value" name="Actif" />
                  <Pie fill="#6b7280" dataKey="value" name="Inactif" />
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
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Données détaillées
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {selectedReport === 'ventes' && (
                  <>
                    <th className="text-left p-4">MSISDN</th>
                    <th className="text-left p-4">Date</th>
                    <th className="text-left p-4">Pays</th>
                    <th className="text-left p-4">Ville</th>
                    <th className="text-left p-4">Commune</th>
                    <th className="text-left p-4">Quartier</th>
                    <th className="text-left p-4">Montant</th>
                  </>
                )}
                {selectedReport === 'produits' && (
                  <>
                    <th className="text-left p-4">Produit</th>
                    <th className="text-left p-4">Quantité</th>
                    <th className="text-left p-4">Montant total</th>
                  </>
                )}
                {selectedReport === 'zones' && (
                  <>
                    <th className="text-left p-4">Zone</th>
                    <th className="text-left p-4">Nombre de ventes</th>
                  </>
                )}
                {selectedReport === 'pdv' && (
                  <>
                    <th className="text-left p-4">Nom PDV</th>
                    <th className="text-left p-4">Statut</th>
                    <th className="text-left p-4">Zone</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {selectedReport === 'ventes' && tableData().map((item: any, index: number) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-4">{item.msisdn}</td>
                  <td className="p-4">{item.date}</td>
                  <td className="p-4">{item.pays}</td>
                  <td className="p-4">{item.ville}</td>
                  <td className="p-4">{item.commune}</td>
                  <td className="p-4">{item.quartier}</td>
                  <td className="p-4 font-medium">{Number(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
              {selectedReport === 'produits' && chartData.map((item: any, index: number) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-4">{item.produit}</td>
                  <td className="p-4">{item.quantite}</td>
                  <td className="p-4 font-medium">{Number(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
              {selectedReport === 'zones' && chartData.map((item: any, index: number) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-4">{item.zone}</td>
                  <td className="p-4 font-medium">{item.count}</td>
                </tr>
              ))}
              {selectedReport === 'pdv' && chartData.map((item: any, index: number) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-4">{item.nom}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      item.statut === 'actif' ? 'bg-success-100 text-success-700' :
                      item.statut === 'inactif' ? 'bg-gray-100 text-gray-700' :
                      'bg-danger-100 text-danger-700'
                    }`}>
                      {item.statut}
                    </span>
                  </td>
                  <td className="p-4">{item.zone}</td>
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