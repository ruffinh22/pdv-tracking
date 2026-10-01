import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../contexts/authContext';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import DocumentTitle from '../components/DocumentTitle';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Précharge le chunk du tableau de bord pendant la saisie du mot de passe.
  const precharger = () => {
    void import('./Dashboard');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('Connexion réussie');
      navigate('/');
    } catch (error) {
      toast.error('Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <DocumentTitle title="Connexion" />
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 flex-col">
        <div className="flag-stripe"><span /><span /><span /></div>
        <div
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Touche rouge, en écho au volatile du logo LONACI */}
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary-500/30 blur-3xl" />
        <div className="absolute -left-16 bottom-24 w-56 h-56 rounded-full bg-success-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full flex-1">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-md px-2 py-1.5 shadow-sm flex items-center justify-center">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-10 w-auto" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Tracking PDV</span>
          </div>

          <div className="max-w-md">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-500 text-white text-xs font-bold ring-0 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Réseau national LONACI
            </span>
            <h2 className="text-4xl font-extrabold leading-tight mb-5">
              Pilotez votre réseau de points de vente en temps réel.
            </h2>
            <p className="text-brand-100 text-base leading-relaxed">
              Suivi terrain, alertes géographiques, reporting des ventes et gestion
              d'équipe réunis dans un seul tableau de bord.
            </p>
          </div>

          <p className="text-xs text-brand-200 border-t border-white/15 pt-4">© {new Date().getFullYear()} LONACI — Loterie Nationale de Côte d'Ivoire</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="bg-white rounded-md px-2 py-1.5 shadow-card ring-1 ring-ink-200 flex items-center justify-center">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-8 w-auto" />
            </div>
            <span className="text-lg font-bold text-ink-900">Tracking PDV</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-brand-800">Connexion</h1>
            <p className="text-sm text-ink-600 mt-2 pb-4 border-b-4 border-primary-500 w-fit pr-8">Accédez à votre espace de suivi des points de vente</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="prenom.nom@lonaci.ci"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onFocus={precharger}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3 text-base"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
