import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PDVList from './pages/PDVList';
import PDVDetail from './pages/PDVDetail';
import GeofenceZones from './pages/GeofenceZones';
import Alertes from './pages/Alertes';
import Users from './pages/Users';
import Tracking from './pages/Tracking';
import Reporting from './pages/Reporting';
import Produits from './pages/Produits';
import Agences from './pages/Agences';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

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
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;