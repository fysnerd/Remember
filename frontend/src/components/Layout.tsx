import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, Brain, Settings, LogOut, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/library', icon: BookOpen, label: 'Archive' },
  { to: '/review', icon: Brain, label: 'Review' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user initials
  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || '?';
  };

  return (
    <div className="min-h-screen flex bg-void">
      {/* Sidebar */}
      <aside className="w-64 bg-void-50 border-r border-void-200 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-void-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber to-amber-dark flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-void" />
            </div>
            <div>
              <h1 className="text-xl font-display text-cream tracking-tight">Remember</h1>
              <p className="text-xs text-cream-dark">Neural Archive</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to));

            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-amber/10 text-amber'
                    : 'text-cream-muted hover:text-cream hover:bg-void-100'
                )}
              >
                <Icon
                  size={20}
                  className={clsx(
                    'transition-transform duration-200',
                    isActive ? 'text-amber' : 'group-hover:scale-110'
                  )}
                />
                <span className="font-medium">{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-void-200">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-void-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sage to-sage-dark flex items-center justify-center ring-2 ring-void-200">
              <span className="text-sm font-bold text-void">
                {getInitials()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-cream-dark truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-cream-muted hover:text-rust hover:bg-rust/10 rounded-xl transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
