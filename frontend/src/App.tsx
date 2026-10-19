import { Suspense, lazy, useEffect } from 'react';
import { BRAND } from './lib/theme';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './pages/ErrorPage';
import { enregistrerPurgeSession } from './contexts/authContext';

// Chargement paresseux par route : chaque page (et ses dépendances lourdes comme
// Recharts) n'est téléchargée que lorsqu'on y navigue, au lieu d'alourdir
// le bundle initial (utile en particulier pour /login, qui n'a besoin de rien de tout ça).
const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PDVList = lazy(() => import('./pages/PDVList'));
const PDVDetail = lazy(() => import('./pages/PDVDetail'));
const GeofenceZones = lazy(() => import('./pages/GeofenceZones'));
const Alertes = lazy(() => import('./pages/Alertes'));
const Users = lazy(() => import('./pages/Users'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Reporting = lazy(() => import('./pages/Reporting'));
const Produits = lazy(() => import('./pages/Produits'));
const Agences = lazy(() => import('./pages/Agences'));
const PdvAttributs = lazy(() => import('./pages/PdvAttributs'));
const Help = lazy(() => import('./pages/Help'));

function RouteFallback() {
  return <PageLoader />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Vide tout le cache de requêtes à chaque connexion et à chaque déconnexion,
// pour qu'aucune donnée d'un compte ne soit visible par le suivant.
enregistrerPurgeSession(() => {
  queryClient.clear();
});

function App() {
  // Handler component to perform SPA navigation on global API events.
  function AuthRedirectHandler() {
    const navigate = useNavigate();
    useEffect(() => {
      const handler = () => navigate('/session-expiree', { replace: true });
      window.addEventListener('api:unauthorized', handler as EventListener);
      return () => window.removeEventListener('api:unauthorized', handler as EventListener);
    }, [navigate]);
    return null;
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthRedirectHandler />
        <Routes>
          <Route
            path="/login"
            element={
              <Suspense fallback={<PageLoader fullscreen />}>
                <Login />
              </Suspense>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader fullscreen />}>
                  <Layout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="pdv"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PDVList />
                </Suspense>
              }
            />
            <Route
              path="pdv/:id"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PDVDetail />
                </Suspense>
              }
            />
            <Route
              path="geofence"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <GeofenceZones />
                </Suspense>
              }
            />
            <Route
              path="alertes"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Alertes />
                </Suspense>
              }
            />
            <Route
              path="users"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Users />
                </Suspense>
              }
            />
            <Route
              path="tracking"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Tracking />
                </Suspense>
              }
            />
            <Route
              path="reporting"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Reporting />
                </Suspense>
              }
            />
            <Route
              path="produits"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Produits />
                </Suspense>
              }
            />
            <Route
              path="agences"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Agences />
                </Suspense>
              }
            />
            <Route
              path="aide"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Help />
                </Suspense>
              }
            />
            <Route
              path="pdv-attributs"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PdvAttributs />
                </Suspense>
              }
            />
          </Route>
          <Route path="/acces-refuse" element={<ErrorPage variant="refuse" />} />
          <Route path="/session-expiree" element={<ErrorPage variant="session" />} />
          <Route path="*" element={<ErrorPage variant="introuvable" />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '14px', fontWeight: 500, fontSize: '0.92rem', padding: '12px 16px', boxShadow: '0 12px 40px rgba(6,35,22,.22)', background: 'var(--surface)', color: 'var(--text)' },
          success: { iconTheme: { primary: BRAND.green, secondary: '#fff' }, style: { borderLeft: `6px solid ${BRAND.green}` } },
          error: { iconTheme: { primary: BRAND.red, secondary: '#fff' }, style: { borderLeft: `6px solid ${BRAND.red}` } },
        }}
      />
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;