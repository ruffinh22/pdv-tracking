import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../contexts/authContext';
import { canAccess } from '../config/permissions';

/**
 * Garde-fou d'accès au back-office :
 *  1. Authentification : redirige vers /login si non connecté.
 *  2. Autorisation : redirige vers "/" si le rôle connecté n'a pas accès à la
 *     page demandée (ex: un Commercial qui tape /users dans l'URL). La liste
 *     des pages autorisées par rôle est définie une seule fois dans
 *     config/permissions.ts (PAGES) et pilote à la fois le menu (Layout) et
 *     ce garde-fou, pour ne jamais les laisser diverger.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, token, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  const relativePath = location.pathname.replace(/^\/+/, '').split('/')[0];
  if (!canAccess(user?.role, relativePath)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
