import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../contexts/authContext';
import DocumentTitle from '../components/DocumentTitle';
import BrandBadge from '../components/BrandBadge';
import { INSTITUTION } from '../config/institution';

/** Illustration : un point de vente géolocalisé au centre d'un réseau de modules du système. */
const TrackingIllustration = () => (
  <svg className="h-full w-full" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <linearGradient id="pinFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffa040" />
        <stop offset="1" stopColor="#ff8200" />
      </linearGradient>
    </defs>

    <circle cx="320" cy="330" r="262" fill="none" stroke="#0f3d28" strokeWidth="1.5" />
    <circle cx="320" cy="330" r="160" fill="none" stroke="#0f3d28" strokeWidth="1.2" />
    <g className="lg-orbit">
      <circle cx="320" cy="330" r="212" fill="none" stroke="#ff8200" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="3 12" />
      <circle cx="320" cy="118" r="5" fill="#ff8200" />
    </g>

    <g stroke="#1f7a4d" strokeWidth="1.4" fill="none">
      <path d="M320 330L90 190" /><path d="M320 330L556 150" /><path d="M320 330L62 430" />
      <path d="M320 330L584 440" /><path d="M320 330L120 515" /><path d="M320 330L500 570" /><path d="M320 330L320 46" />
    </g>

    <g fontFamily="Roboto,Arial,sans-serif" fontSize="12" fontWeight="600" textAnchor="middle" fill="#fff">
      <g className="lg-node"><rect x="46" y="172" width="88" height="30" rx="15" fill="#0b2c1d" stroke="#ff8200" /><text x="90" y="192">Terrain</text></g>
      <g className="lg-node n2"><rect x="506" y="132" width="100" height="30" rx="15" fill="#0b2c1d" stroke="#5cc78a" /><text x="556" y="152">Géofence</text></g>
      <g className="lg-node n3"><rect x="22" y="412" width="80" height="30" rx="15" fill="#0b2c1d" stroke="#5cc78a" /><text x="62" y="432">PDV</text></g>
      <g className="lg-node"><rect x="540" y="424" width="88" height="30" rx="15" fill="#0b2c1d" stroke="#ff8200" /><text x="584" y="444">Alertes</text></g>
      <g className="lg-node n2"><rect x="76" y="500" width="88" height="30" rx="15" fill="#0b2c1d" stroke="#ff8200" /><text x="120" y="520">Agences</text></g>
      <g className="lg-node n3"><rect x="452" y="554" width="96" height="30" rx="15" fill="#0b2c1d" stroke="#5cc78a" /><text x="500" y="574">Reporting</text></g>
      <g className="lg-node"><rect x="276" y="30" width="88" height="30" rx="15" fill="#0b2c1d" stroke="#ff8200" /><text x="320" y="50">Produits</text></g>
    </g>

    {/* Ondes de localisation au sol */}
    <ellipse cx="320" cy="470" rx="110" ry="13" fill="#24ab62" opacity=".14" />
    <ellipse className="lg-ping" cx="320" cy="470" rx="46" ry="7" fill="none" stroke="#5cc78a" strokeWidth="2" />
    <ellipse className="lg-ping p2" cx="320" cy="470" rx="46" ry="7" fill="none" stroke="#5cc78a" strokeWidth="2" />

    {/* Repère GPS */}
    <g className="lg-float">
      <path
        d="M320 190C268 190 228 230 228 282c0 62 92 160 92 160s92-98 92-160c0-52-40-92-92-92z"
        fill="url(#pinFill)" stroke="#ffc58a" strokeWidth="3" filter="url(#pinGlow)"
      />
      <circle cx="320" cy="282" r="44" fill="#062316" />
      <circle cx="320" cy="282" r="26" fill="none" stroke="#24ab62" strokeWidth="3" />
      <circle cx="320" cy="282" r="10" fill="#5cc78a" />
    </g>
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Précharge le chunk du tableau de bord pendant la saisie du mot de passe.
  const precharger = () => {
    void import('./Dashboard');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie');
      navigate('/');
    } catch (err) {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldLabel = 'block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-600 mb-1.5';
  const fieldInput =
    'w-full h-[46px] rounded-xl border border-[color:var(--border-strong)] bg-white text-[14.5px] text-ink-900 placeholder:text-ink-400 ' +
    'transition focus:outline-none focus:border-success-600 focus:shadow-[0_0_0_4px_rgba(0,136,64,.2)]';

  return (
    <div className="relative isolate min-h-screen flex overflow-auto" style={{ background: 'var(--deep)' }}>
      <DocumentTitle title="Connexion" />

      {/* Trame de points */}
      <svg className="absolute inset-0 -z-20 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="lgDots" width="34" height="34" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="#fff" fillOpacity=".09" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lgDots)" />
      </svg>
      {/* Halos */}
      <div className="pointer-events-none absolute -top-40 -left-40 -z-10 h-[34rem] w-[34rem] rounded-full bg-success-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-primary-500/15 blur-3xl" />

      {/* Colonne gauche : marque + illustration */}
      <div className="relative hidden lg:flex lg:basis-[48%] lg:max-w-[48%] flex-col justify-between px-12 py-9 text-white">
        <div className="pointer-events-none absolute left-[3%] top-[47%] -translate-y-1/2 h-[min(72vh,660px)] w-auto max-w-[54vw] aspect-square">
          <TrackingIllustration />
        </div>

        <span className="relative self-start rounded-xl bg-white px-4 py-2.5 shadow-lg">
          <img src="/assets/lonaci-logo.png" alt={INSTITUTION.sigle} className="h-9 w-auto" />
        </span>

        <div className="relative self-start max-w-[420px]">
          <span className="mb-3.5 inline-block text-[11px] uppercase tracking-[0.16em] text-primary-500">
            {INSTITUTION.systeme}
          </span>
          <h2 className="font-display text-[34px] font-semibold leading-[1.08] tracking-[0.02em] text-white mb-2.5">
            Chaque point de vente,<br />en temps réel.
          </h2>
          <p className="text-[13.5px] leading-relaxed text-white/65">
            Localisation GPS, zones géofence, alertes terrain et reporting : pilotez tout le réseau {INSTITUTION.sigle} depuis un seul espace.
          </p>
        </div>
      </div>

      {/* Colonne droite : carte de connexion */}
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-[410px] rounded-[20px] bg-white border px-[30px] pt-7 pb-6"
            style={{ borderColor: 'var(--border)', boxShadow: '0 24px 70px rgba(0,0,0,.5)' }}
          >
            <div className="mb-[22px] flex items-center gap-4">
              <BrandBadge size={58} tone="dark" />
              <div>
                <h1 className="!text-[28px] !font-semibold !normal-case tracking-[0.04em] text-ink-950 leading-none mb-1">Connexion</h1>
                <p className="text-[13px] text-ink-500">Accédez à votre espace Tracking PDV.</p>
              </div>
            </div>

            <div className="mb-3.5">
              <label htmlFor="email" className={fieldLabel}>Adresse e-mail</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink-400" />
                <input
                  id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={`${fieldInput} pl-[42px] pr-3`} placeholder="prenom.nom@lonaci.ci"
                  autoComplete="username" required autoFocus
                />
              </div>
            </div>

            <div className="mb-3.5">
              <label htmlFor="password" className={fieldLabel}>Mot de passe</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink-400" />
                <input
                  id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldInput} pl-[42px] pr-11`} placeholder="••••••••"
                  autoComplete="current-password" onFocus={precharger} required
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-mist-100 hover:text-ink-900"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mb-3 rounded-[10px] border-l-[3px] border-danger-500 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={isLoading}
              className="btn btn-primary !h-[46px] !w-full !rounded-xl !text-[14.5px] !font-semibold"
            >
              {isLoading ? (<><Loader2 className="h-[17px] w-[17px] animate-spin" />Connexion…</>) : (<>Se connecter <ArrowRight className="h-[17px] w-[17px]" /></>)}
            </button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-400">
              <Lock className="h-3 w-3" /> Accès réservé aux utilisateurs autorisés.
            </p>
          </motion.form>
        </div>
        <p className="pb-5 text-center text-[11.5px] text-white/50">
          © {new Date().getFullYear()} {INSTITUTION.sigle} — {INSTITUTION.nom}
        </p>
      </div>
    </div>
  );
};

export default Login;
