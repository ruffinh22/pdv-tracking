import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, MapPin, BellRing, BarChart3, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../contexts/authContext';
import DocumentTitle from '../components/DocumentTitle';

const ATOUTS = [
  { icon: MapPin, titre: 'Suivi terrain en direct', texte: 'Localisez vos équipes et vos points de vente.' },
  { icon: BellRing, titre: 'Alertes géographiques', texte: 'Soyez prévenu dès qu’un agent sort de sa zone.' },
  { icon: BarChart3, titre: 'Reporting des ventes', texte: 'Des chiffres clairs, exportables en un clic.' },
];

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

      {/* Panneau de marque : noir du logo, halos vert / orange / rouge */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-brand-950 flex-col">
        <div className="flag-stripe"><span /><span /><span /></div>
        <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-success-600/40 blur-3xl animate-floaty" />
        <div className="absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full bg-primary-500/35 blur-3xl animate-floaty" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-1/2 right-10 w-56 h-56 rounded-full bg-danger-500/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)', backgroundSize: '30px 30px' }}
        />

        <div className="relative z-10 flex flex-col justify-between p-14 text-white w-full flex-1">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-4">
            <div className="bg-white rounded-2xl px-3 py-2.5 shadow-xl ring-4 ring-primary-500/40">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-11 w-auto" />
            </div>
            <span className="font-display text-2xl font-extrabold tracking-tight">Tracking PDV</span>
          </motion.div>

          <div className="max-w-xl">
            <motion.span
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500 text-white text-sm font-bold shadow-glow mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Réseau national LONACI
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
              className="font-display text-5xl xl:text-6xl font-extrabold leading-[1.05] text-white mb-6"
            >
              Pilotez vos points de vente en temps réel.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.6 }}
              className="text-lg leading-relaxed text-brand-100 mb-10 max-w-lg"
            >
              Suivi terrain, alertes, reporting et gestion d’équipe réunis dans un seul tableau de bord.
            </motion.p>

            <ul className="space-y-4">
              {ATOUTS.map(({ icon: Icon, titre, texte }, i) => (
                <motion.li
                  key={titre}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.1, duration: 0.45 }}
                  className="flex items-center gap-4 rounded-2xl bg-white/[0.07] ring-1 ring-white/10 backdrop-blur px-5 py-4"
                >
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${i === 0 ? 'bg-success-600' : i === 1 ? 'bg-danger-500' : 'bg-primary-500'}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </span>
                  <span>
                    <span className="block font-bold text-white text-base">{titre}</span>
                    <span className="block text-sm text-brand-200">{texte}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-brand-300 border-t border-white/10 pt-5">
            © {new Date().getFullYear()} LONACI — Loterie Nationale de Côte d’Ivoire
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-white via-ink-50 to-success-50/60">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="bg-white rounded-xl px-2.5 py-2 shadow-card ring-1 ring-ink-200">
              <img src="/assets/lonaci-logo.png" alt="LONACI" className="h-9 w-auto" />
            </div>
            <span className="font-display text-xl font-extrabold text-ink-950">Tracking PDV</span>
          </div>

          <div className="bg-white rounded-3xl shadow-lift border border-ink-100 p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-flag-gradient" />
            <h1 className="font-display text-4xl font-extrabold text-ink-950">Connexion</h1>
            <p className="text-base font-medium text-ink-600 mt-2 mb-8">Accédez à votre espace de suivi des points de vente.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Adresse email</label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-success-600 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12" placeholder="prenom.nom@lonaci.ci" autoComplete="username" required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Mot de passe</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-success-600 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'} id="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-12 pr-12" placeholder="••••••••" autoComplete="current-password"
                    onFocus={precharger} required
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-ink-500 hover:text-primary-600 hover:bg-primary-50"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-3.5 text-base">
                {isLoading ? (<><Loader2 className="w-5 h-5 animate-spin" />Connexion…</>) : 'Se connecter'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
