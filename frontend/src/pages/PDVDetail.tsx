import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';

const PDVDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Détail PDV</h1>
          <p className="text-sm text-ink-500 mt-0.5">Fiche point de vente {id ? `#${id}` : ''}</p>
        </div>
      </div>

      <div className="card text-center py-16">
        <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
          <MapPin className="w-6 h-6 text-primary-500" />
        </div>
        <p className="text-ink-500">Cette vue détaillée est en cours de construction.</p>
      </div>
    </div>
  );
};

export default PDVDetail;
