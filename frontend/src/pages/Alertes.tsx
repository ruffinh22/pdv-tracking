import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, MapPin, Calendar, Filter } from 'lucide-react';
import { alerteService } from '../services/alerteService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const Alertes = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'non_traitee' | 'traitee'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: alertesResponse, isLoading } = useQuery({
    queryKey: ['alertes', filter, currentPage, itemsPerPage],
    queryFn: async () => {
      const allAlertes = await alerteService.getAllAlertes(currentPage, itemsPerPage);
      const alertes = allAlertes.data || [];
      if (filter === 'all') return { ...allAlertes, data: alertes };
      return { ...allAlertes, data: alertes.filter(a => a.statut === filter) };
    },
  });

  const alertes = alertesResponse?.data || [];
  const pagination = alertesResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const traiterMutation = useMutation({
    mutationFn: alerteService.traiterAlerte,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertes'] });
      toast.success('Alerte traitée avec succès');
    },
    onError: () => {
      toast.error('Erreur lors du traitement de l\'alerte');
    }
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleTraiter = (id: number) => {
    traiterMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Alertes</h1>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="p-2 border rounded"
          >
            <option value="all">Toutes</option>
            <option value="non_traitee">Non traitées</option>
            <option value="traitee">Traitées</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {alertes?.map((alerte) => (
          <div key={alerte.id} className={`card ${alerte.statut === 'non_traitee' ? 'border-l-4 border-l-danger-500' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <AlertTriangle className={`w-5 h-5 mr-2 ${alerte.statut === 'non_traitee' ? 'text-danger-600' : 'text-gray-400'}`} />
                  <h3 className="font-semibold">{alerte.type_alerte}</h3>
                  <span className={`ml-3 px-2 py-1 text-xs rounded ${
                    alerte.statut === 'non_traitee' ? 'bg-danger-100 text-danger-700' : 'bg-success-100 text-success-700'
                  }`}>
                    {alerte.statut === 'non_traitee' ? 'Non traitée' : 'Traité'}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-3">{alerte.description}</p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(alerte.horodatage).toLocaleString()}
                  </div>
                  {alerte.pdv && (
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {alerte.pdv.nom_pdv}
                    </div>
                  )}
                </div>
              </div>
              
              {alerte.statut === 'non_traitee' && (
                <button
                  onClick={() => handleTraiter(alerte.id)}
                  className="flex items-center px-3 py-2 bg-success-600 text-white rounded hover:bg-success-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Traiter
                </button>
              )}
            </div>
          </div>
        ))}
        
        {alertes?.length === 0 && (
          <div className="card text-center py-8">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucune alerte trouvée</p>
          </div>
        )}

        {alertes?.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
    </div>
  );
};

export default Alertes;
