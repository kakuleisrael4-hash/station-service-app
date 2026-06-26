import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PompisteDashboard from './pages/pompiste/PompisteDashboard';
import ViewerDashboard from './pages/viewer/ViewerDashboard';
import { Fuel } from 'lucide-react';

function Splash() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <Fuel className="h-10 w-10 text-energy-400" />
        <p className="text-slate-400 text-sm">Chargement de la station…</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'pompiste':
      return <PompisteDashboard />;
    case 'viewer':
      return <ViewerDashboard />;
    default:
      return <Navigate to="/" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
