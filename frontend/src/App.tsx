import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="pdv" element={<PDVList />} />
              <Route path="pdv/:id" element={<PDVDetail />} />
              <Route path="geofence" element={<GeofenceZones />} />
              <Route path="alertes" element={<Alertes />} />
              <Route path="users" element={<Users />} />
              <Route path="tracking" element={<Tracking />} />
              <Route path="reporting" element={<Reporting />} />
              <Route path="produits" element={<Produits />} />
              <Route path="agences" element={<Agences />} />
              <Route path="pdv-attributs" element={<PdvAttributs />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;