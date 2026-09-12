import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../contexts/authContext';
import { Radar, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

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
    <div className="min-h-screen flex bg-ink-50">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-700 flex-col">
        <div className="flag-stripe"><span /><span /><span /></div>
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white/15 flex items-center justify-center">
              <Radar className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold">Tracking PDV</span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-snug mb-4">
              Pilotez votre réseau de points de vente en temps réel.
            </h2>
            <p className="text-primary-100 text-sm leading-relaxed">
              Suivi terrain, alertes géographiques, reporting des ventes et gestion
              d'équipe réunis dans un seul tableau de bord.
            </p>
          </div>

          <p className="text-xs text-primary-200">© {new Date().getFullYear()} Tracking PDV. Tous droits réservés.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-md bg-primary-600 flex items-center justify-center">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-ink-900">Tracking PDV</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink-900">Connexion</h1>
            <p className="text-sm text-ink-500 mt-1.5">Accédez à votre tableau de bord d'administration</p>
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
                placeholder="admin@trackingpdv.com"
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
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-2.5"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-white rounded-lg border border-ink-200">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Comptes de test</p>
            <div className="space-y-1 text-sm text-ink-600">
              <p><span className="text-ink-400">Admin —</span> admin@trackingpdv.com / admin123</p>
              <p><span className="text-ink-400">Superviseur —</span> superviseur@trackingpdv.com / superviseur123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
