import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, MapPin, Calendar, Filter } from 'lucide-react';
import { alerteService, Alerte } from '../services/alerteService';
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
      const alertes: Alerte[] = allAlertes.data || [];
      if (filter === 'all') return { ...allAlertes, data: alertes };
      return { ...allAlertes, data: alertes.filter((a: Alerte) => a.statut === filter) };
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

  const nonTraiteesCount = alertes.filter((a: Alerte) => a.statut === 'non_traitee').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Alertes</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {nonTraiteesCount > 0
              ? `${nonTraiteesCount} alerte${nonTraiteesCount > 1 ? 's' : ''} en attente de traitement`
              : 'Toutes les alertes sont traitées'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-ink-200 rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-ink-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm text-ink-700 bg-transparent focus:outline-none"
          >
            <option value="all">Toutes</option>
            <option value="non_traitee">Non traitées</option>
            <option value="traitee">Traitées</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="card text-center py-10 text-ink-400">Chargement...</div>
        ) : (
          <>
            {alertes?.map((alerte: Alerte) => (
              <div
                key={alerte.id}
                className={`card !p-5 ${alerte.statut === 'non_traitee' ? 'border-l-4 !border-l-danger-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2.5 mb-2">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                        alerte.statut === 'non_traitee' ? 'bg-danger-50 text-danger-600' : 'bg-ink-100 text-ink-400'
                      }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <h3 className="font-semibold text-ink-900">{alerte.type_alerte}</h3>
                      <span className={alerte.statut === 'non_traitee' ? 'badge badge-danger' : 'badge badge-success'}>
                        {alerte.statut === 'non_traitee' ? 'Non traitée' : 'Traité'}
                      </span>
                    </div>

                    <p className="text-sm text-ink-600 mb-3 ml-[42px]">{alerte.description}</p>

                    <div className="flex items-center flex-wrap gap-4 text-xs text-ink-400 ml-[42px]">
                      <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {new Date(alerte.horodatage).toLocaleString()}
                      </div>
                      {alerte.pdv && (
                        <div className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1.5" />
                          {alerte.pdv.nom_pdv}
                        </div>
                      )}
                    </div>
                  </div>

                  {alerte.statut === 'non_traitee' && (
                    <button
                      onClick={() => handleTraiter(alerte.id)}
                      className="btn btn-primary !bg-success-600 hover:!bg-success-700 shrink-0"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Traiter
                    </button>
                  )}
                </div>
              </div>
            ))}

            {alertes?.length === 0 && (
              <div className="card text-center py-12">
                <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-ink-300" />
                </div>
                <p className="text-ink-500">Aucune alerte trouvée</p>
              </div>
            )}

            {alertes?.length > 0 && (
              <div className="panel !mt-5">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Alertes;
