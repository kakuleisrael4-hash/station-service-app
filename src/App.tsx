import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PompisteDashboard from './pages/pompiste/PompisteDashboard';
import ViewerDashboard from './pages/viewer/ViewerDashboard';
import { Fuel } from 'lucide-react';

/** Squelettes shimmer : cartes translucides parcourues d'une vague lumineuse. */
function Splash() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-energy-500 text-night-950 shadow-glow-soft">
          <Fuel className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-44" />
          <div className="skeleton h-2.5 w-28" />
        </div>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="skeleton h-80 lg:col-span-2" />
        <div className="skeleton h-80" />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Chargement de la station…</p>
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
