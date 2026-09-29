import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BookOpen, Calendar, GraduationCap,
  Settings, Users, Database, LogOut,
  ChevronRight, Bell, User, ShieldCheck, BookMarked
} from 'lucide-react';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const studentNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/my-courses', icon: BookOpen,        label: 'My Courses' },
    { to: '/schedule',   icon: Calendar,         label: 'Schedule Builder' },
    { to: '/catalog',    icon: BookMarked,       label: 'Course Catalog' },
  ];

  const adminNav = [
    { to: '/admin/overview', icon: LayoutDashboard,  label: 'Overview' },
    { to: '/admin/students', icon: Users,            label: 'Students' },
    { to: '/admin/programs', icon: GraduationCap,    label: 'Programs' },
    { to: '/admin/courses',  icon: BookOpen,         label: 'Courses' },
    { to: '/admin/graph',    icon: Database,         label: 'Knowledge Graph' },
    { to: '/admin/settings', icon: Settings,         label: 'Settings & Audit Log' },
  ];

  const navItems = user?.role === 'admin' ? adminNav : studentNav;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">J</div>
          <div>
            <div className="sidebar-logo-text">JSOM Planner</div>
            <div className="sidebar-logo-sub">UT Dallas</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">
            {user?.role === 'admin' ? 'Administration' : 'Student Portal'}
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard' || to === '/admin'}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(199,91,18,0.3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.85rem', fontWeight: 700
            }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>
                {user?.role === 'admin' ? '🛡 Admin' : user?.programName?.slice(0, 25) || 'Student'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'none', cursor: 'pointer' }}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="topbar">
          <div style={{ flex: 1 }} />
          {user?.role === 'student' && user?.programName && (
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GraduationCap size={14} />
              {user.programName}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {user?.role === 'admin' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--utd-navy-light)', color: 'var(--utd-navy)', padding: '0.25rem 0.6rem', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700 }}>
                <ShieldCheck size={12} /> Admin
              </span>
            )}
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--utd-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        <div className="utd-accent-bar" />

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

