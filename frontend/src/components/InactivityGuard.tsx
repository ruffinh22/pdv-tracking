import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  /** false : surveillance suspendue (ex. écran de supervision en continu). */
  actif: boolean;
  minutes?: number;
  avertissementSecondes?: number;
  onExpire: () => void;
}

const EVENEMENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

/** Déconnexion automatique après inactivité, avec avertissement et compte à rebours. */
export default function InactivityGuard({ actif, minutes = 30, avertissementSecondes = 60, onExpire }: Props) {
  const derniere = useRef(Date.now());
  const [restant, setRestant] = useState<number | null>(null);

  const rester = useCallback(() => {
    derniere.current = Date.now();
    setRestant(null);
  }, []);

  useEffect(() => {
    if (!actif) {
      setRestant(null);
      return;
    }
    derniere.current = Date.now();
    const marquer = () => {
      // Pendant l'avertissement, seule une action explicite prolonge la session.
      if (Date.now() - derniere.current < (minutes * 60 - avertissementSecondes) * 1000) derniere.current = Date.now();
    };
    EVENEMENTS.forEach((e) => window.addEventListener(e, marquer, { passive: true }));
    const timer = window.setInterval(() => {
      const ecoule = (Date.now() - derniere.current) / 1000;
      const reste = minutes * 60 - ecoule;
      if (reste <= 0) {
        window.clearInterval(timer);
        onExpire();
      } else if (reste <= avertissementSecondes) {
        setRestant(Math.ceil(reste));
      } else {
        setRestant(null);
      }
    }, 1000);
    return () => {
      EVENEMENTS.forEach((e) => window.removeEventListener(e, marquer));
      window.clearInterval(timer);
    };
  }, [actif, minutes, avertissementSecondes, onExpire]);

  if (restant === null) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4" role="alertdialog" aria-modal="true" aria-labelledby="inact-titre">
      <div className="w-full max-w-[400px] rounded-[20px] bg-white p-6 text-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h2 id="inact-titre" className="!text-[22px] !font-semibold uppercase tracking-[0.04em]">Session bientôt expirée</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-600">
          Sans activité de votre part, vous serez déconnecté dans <b className="text-danger-600">{restant} s</b>.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={rester} autoFocus>Rester connecté</button>
          <button type="button" className="btn btn-secondary" onClick={onExpire}>Me déconnecter</button>
        </div>
      </div>
    </div>
  );
}
