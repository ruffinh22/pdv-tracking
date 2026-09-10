import { useQuery } from '@tanstack/react-query';
import { MapPin, ShoppingCart, AlertTriangle, Activity, Download } from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import { pdvService } from '../services/pdvService';
import LeafletMap from '../components/LeafletMap';
import toast from 'react-hot-toast';

const Dashboard = () => {
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

  const { data: allPDVs } = useQuery({
    queryKey: ['pdvs'],
    queryFn: pdvService.getAllPDVs,
  });

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          onClick={handleExportExcel}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">PDV Actifs</p>
              <p className="text-3xl font-bold text-primary-600">{kpis?.pdv_actifs || 0}</p>
            </div>
            <MapPin className="w-12 h-12 text-primary-200" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ventes Aujourd'hui</p>
              <p className="text-3xl font-bold text-success-600">{kpis?.ventes_aujourdhui || 0}</p>
            </div>
            <ShoppingCart className="w-12 h-12 text-success-200" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertes Actives</p>
              <p className="text-3xl font-bold text-danger-600">{kpis?.alertes_actives || 0}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-danger-200" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total PDV</p>
              <p className="text-3xl font-bold text-warning-600">{pdvActifs?.length || 0}</p>
            </div>
            <Activity className="w-12 h-12 text-warning-200" />
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Carte en temps réel</h2>
        <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
          {allPDVs && allPDVs.length > 0 ? (
            <LeafletMap pdvs={allPDVs} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">Aucun PDV avec position GPS disponible</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Alertes récentes</h2>
        {alertesActives && alertesActives.length > 0 ? (
          <div className="space-y-3">
            {alertesActives.slice(0, 5).map((alerte: any) => (
              <div key={alerte.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{alerte.type_alerte}</p>
                  <p className="text-sm text-gray-600">{alerte.description}</p>
                  <p className="text-xs text-gray-500">{new Date(alerte.horodatage).toLocaleString()}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-danger-100 text-danger-700 rounded">
                  {alerte.statut}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Aucune alerte récente</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
