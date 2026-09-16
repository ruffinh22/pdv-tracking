import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { enregistrerPurgeSession } from './contexts/authContext';

// Chargement paresseux par route : chaque page (et ses dépendances lourdes comme
// Leaflet ou Recharts) n'est téléchargée que lorsqu'on y navigue, au lieu d'alourdir
// le bundle initial (utile en particulier pour /login, qui n'a besoin de rien de tout ça).
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

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
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
      const handler = () => navigate('/login');
      window.addEventListener('api:unauthorized', handler as EventListener);
      return () => window.removeEventListener('api:unauthorized', handler as EventListener);
    }, [navigate]);
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthRedirectHandler />
        <Routes>
          <Route
            path="/login"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Login />
              </Suspense>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
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
              path="pdv-attributs"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PdvAttributs />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;