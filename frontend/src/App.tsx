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
      <div className="w-8 h-8 border-4 border-success-600 border-t-primary-500 rounded-full animate-spin" />
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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', padding: '14px 18px', boxShadow: '0 16px 40px -8px rgba(10,12,11,.28)' },
          success: { iconTheme: { primary: '#008840', secondary: '#fff' }, style: { borderLeft: '6px solid #008840' } },
          error: { iconTheme: { primary: '#c82828', secondary: '#fff' }, style: { borderLeft: '6px solid #c82828' } },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;