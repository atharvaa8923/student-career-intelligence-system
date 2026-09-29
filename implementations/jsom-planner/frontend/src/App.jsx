import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/shared/AppLayout';
import LoginPage    from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import StudentDashboard  from './pages/student/DashboardPage';
import MyCoursesPage     from './pages/student/MyCoursesPage';
import CourseCatalogPage from './pages/student/CourseCatalogPage';
import ScheduleBuilderPage from './pages/student/ScheduleBuilderPage';
import AdminOverviewPage   from './pages/admin/AdminOverviewPage';
import AdminProgramsPage   from './pages/admin/AdminProgramsPage';
import { AdminStudentsPage, AdminCoursesPage, AdminGraphPage, AdminSettingsPage } from './pages/admin/AdminPages';
import './styles/global.css';

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="spinner lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && !(role === 'student' && user.role === 'admin')) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/"         element={<RootRedirect />} />

            {/* Student routes */}
            <Route path="/dashboard" element={
              <RequireAuth role="student">
                <AppLayout><StudentDashboard /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/my-courses" element={
              <RequireAuth role="student">
                <AppLayout><MyCoursesPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/catalog" element={
              <RequireAuth role="student">
                <AppLayout><CourseCatalogPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/schedule" element={
              <RequireAuth role="student">
                <AppLayout><ScheduleBuilderPage /></AppLayout>
              </RequireAuth>
            }/>

            {/* Admin routes */}
            <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
            <Route path="/admin/overview" element={<RequireAuth role="admin"><AppLayout><AdminOverviewPage /></AppLayout></RequireAuth>} />
            <Route path="/admin/reports" element={<Navigate to="/admin/overview" replace />} />
            <Route path="/admin/programs" element={
              <RequireAuth role="admin">
                <AppLayout><AdminProgramsPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/admin/students" element={
              <RequireAuth role="admin">
                <AppLayout><AdminStudentsPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/admin/courses" element={
              <RequireAuth role="admin">
                <AppLayout><AdminCoursesPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/admin/graph" element={
              <RequireAuth role="admin">
                <AppLayout><AdminGraphPage /></AppLayout>
              </RequireAuth>
            }/>
            <Route path="/admin/settings" element={
              <RequireAuth role="admin">
                <AppLayout><AdminSettingsPage /></AppLayout>
              </RequireAuth>
            }/>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
