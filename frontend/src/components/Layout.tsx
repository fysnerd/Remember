import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, FileText, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import clsx from 'clsx';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation - 4 pages
  const navItems = [
    { to: '/', icon: BookOpen, label: 'Apprendre' },
    { to: '/notes', icon: FileText, label: 'Notes' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Remember</h1>
          <p className="text-xs text-gray-500">Wireframe Mode</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to));

            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded text-sm',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">
                {user?.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen bg-white">
        <Outlet />
      </main>
    </div>
  );
}
