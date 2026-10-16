import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bell, BellOff, MapPin } from 'lucide-react';
import { libelleTypeAlerte } from '../lib/labels';
import { alerteService, type Alerte } from '../services/alerteService';

function ilYa(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Cloche d'alertes : compteur des alertes non traitées + aperçu des plus récentes. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['alertes-cloche'],
    queryFn: () => alerteService.getAllAlertes(1, 30),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const liste: Alerte[] = (Array.isArray(data) ? data : data?.data ?? []) as Alerte[];
  const enAttente = liste.filter((a) => a.statut === 'non_traitee');
  const nb = enAttente.length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="nav-round"
        aria-label={nb > 0 ? `Notifications : ${nb} alerte${nb > 1 ? 's' : ''} en attente` : 'Notifications : aucune alerte en attente'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="w-4 h-4" />
        {nb > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold leading-[17px] text-center ring-2 ring-[color:var(--brand)]">
            {nb > 9 ? '9+' : nb}
          </span>
        )}
      </button>

      {open && (
        <div className="nav-drop">
          <div className="nav-menu !min-w-[320px] max-w-[92vw]" role="dialog" aria-label="Notifications">
            <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
              <span className="nav-heading !p-0">Alertes en attente</span>
              {nb > 0 && <span className="text-[11px] font-semibold text-primary-400">{nb}</span>}
            </div>
            {nb === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center text-white/60 text-[13px]">
                <BellOff className="w-6 h-6 text-white/40" />
                Tout est calme : aucune alerte à traiter.
              </div>
            ) : (
              <ul>
                {enAttente.slice(0, 5).map((a, i) => (
                  <li key={a.id}>
                    <Link to="/alertes" onClick={() => setOpen(false)} className="nav-item !items-start" style={{ animationDelay: `${i * 28}ms` }}>
                      <AlertTriangle className="w-[15px] h-[15px] mt-0.5 text-primary-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-medium text-white truncate">{libelleTypeAlerte(a.type_alerte)}</span>
                        <span className="flex items-center gap-1 text-[11.5px] text-white/60 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {a.pdv?.nom_pdv ?? `PDV n° ${a.pdv_id}`} · {ilYa(a.horodatage)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1 border-t border-white/10 pt-1">
              <Link to="/alertes" onClick={() => setOpen(false)} className="nav-item justify-center !text-primary-400 font-semibold">
                Voir toutes les alertes
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
