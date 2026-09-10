import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPin, AlertTriangle, Users, LogOut, Menu, X, Activity, FileText, Package, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../contexts/authContext';
import { useState } from 'react';

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = () => location.pathname === '/users' || location.pathname === '/produits' || location.pathname === '/geofence';

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar noire */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-black shadow-lg z-20">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className="p-2 mr-4 text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-xl font-bold text-white">Tracking PDV</h1>
            <p className="text-sm text-gray-400 ml-4">Dashboard Administration</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-medium text-sm text-white">{user?.nom} {user?.prenom}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 text-sm text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-16 h-full bg-white shadow-lg z-10 transition-all duration-300 overflow-hidden ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className={`w-64 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Navigation</h2>
          </div>

          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 mr-3" />
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/pdv"
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/pdv') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MapPin className="w-5 h-5 mr-3" />
                  Points de Vente
                </Link>
              </li>
              <li>
                <Link
                  to="/alertes"
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/alertes') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 mr-3" />
                  Alertes
                </Link>
              </li>
              <li>
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                    isSettingsActive() ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <Settings className="w-5 h-5 mr-3" />
                    Paramètres
                  </div>
                  {isSettingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {isSettingsOpen && (
                  <ul className="ml-8 mt-2 space-y-1">
                    <li>
                      <Link
                        to="/users"
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                          isActive('/users') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Utilisateurs
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/produits"
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                          isActive('/produits') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Produits
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/geofence"
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                          isActive('/geofence') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Zones Geofence
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <Link
                  to="/reporting"
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/reporting') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Reporting
                </Link>
              </li>
              <li>
                <Link
                  to="/tracking"
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/tracking') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Activity className="w-5 h-5 mr-3" />
                  Tracking
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className={`mt-16 p-8 transition-all duration-300 ${
        isSidebarOpen ? 'ml-64' : 'ml-0'
      }`}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
