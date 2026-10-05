import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../contexts/authContext';
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
    <div className="relative min-h-screen flex flex-col bg-nation overflow-hidden">
      <DocumentTitle title="Connexion" />

      {/* Bandeau tricolore national, pleine largeur */}
      <div className="flag-stripe !h-2"><span /><span /><span /></div>

      {/* Halos discrets */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-success-400/20 blur-3xl animate-floaty" />
      <div
        className="pointer-events-none absolute -bottom-48 -right-32 w-[34rem] h-[34rem] rounded-full bg-primary-500/20 blur-3xl animate-floaty"
        style={{ animationDelay: '-3s' }}
      />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[25rem]"
        >
          <div className="overflow-hidden rounded-[4px] bg-white shadow-popover">
            {/* En-tête institutionnel */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-ink-200">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-10 w-auto shrink-0" />
              <span className="h-9 w-px bg-ink-200" aria-hidden="true" />
              <div className="leading-tight">
                <p className="font-display text-base font-extrabold text-ink-950">Tracking PDV</p>
                <p className="text-[11px] font-medium text-ink-600">Loterie Nationale de Côte d’Ivoire</p>
              </div>
            </div>

            {/* Formulaire */}
            <div className="px-6 pt-5 pb-5">
              <h1 className="font-display text-xl font-extrabold text-ink-950">Connexion</h1>
              <p className="mt-0.5 mb-4 text-sm text-ink-600">Identifiez-vous pour accéder à votre espace.</p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="email" className="label">Adresse email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-success-600" />
                    <input
                      type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="input !rounded-[4px] !py-2.5 pl-11" placeholder="prenom.nom@lonaci.ci" autoComplete="username" required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="label">Mot de passe</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-success-600" />
                    <input
                      type={showPassword ? 'text' : 'password'} id="password" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input !rounded-[4px] !py-2.5 pl-11 pr-11" placeholder="••••••••" autoComplete="current-password"
                      onFocus={precharger} required
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] p-1.5 text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-primary w-full !rounded-[4px] !py-2.5 text-[15px] font-bold">
                  {isLoading ? (<><Loader2 className="h-5 w-5 animate-spin" />Connexion…</>) : 'Se connecter'}
                </button>
              </form>
            </div>

            {/* Bandeau de sécurité */}
            <div className="flex items-center justify-center gap-2 border-t border-ink-200 bg-ink-50 px-6 py-2.5 text-xs font-medium text-ink-600">
              <ShieldCheck className="h-4 w-4 text-success-600" />
              Accès réservé aux utilisateurs autorisés
            </div>

            {/* Filet tricolore de pied de carte */}
            <div className="flag-stripe !h-1"><span /><span /><span /></div>
          </div>

          <p className="mt-4 text-center text-xs text-white/85">
            © {new Date().getFullYear()} LONACI — Loterie Nationale de Côte d’Ivoire
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Login;