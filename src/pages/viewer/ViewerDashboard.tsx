import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Wallet, Droplets, Users, Megaphone, Landmark } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import ChampionsPodium from '@/components/ChampionsPodium';
import AnnouncementsFeed from '@/components/AnnouncementsFeed';
import ProfitExpensesChart from '@/components/ProfitExpensesChart';
import { Card, SectionTitle, StatCard, Gauge, EmptyState } from '@/components/ui';
import FuelStockManagement from '../shared/FuelStockManagement';
import CapitalEvolution from '../shared/CapitalEvolution';
import { useData } from '@/context/DataContext';
import { globalDaily, volumeShare, stationRH } from '@/lib/selectors';
import { fc, liters, shortDate, fullDate, currentPeriod } from '@/lib/format';

const PIE_COLORS = ['#10b981', '#f59e0b', '#38bdf8', '#a78bfa', '#fb7185', '#34d399'];
type Tab = 'global' | 'carburant' | 'capital';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'global', label: 'Vue globale', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'carburant', label: 'Carburant & Stocks', icon: <Droplets className="h-4 w-4" /> },
  { id: 'capital', label: 'Capital', icon: <Landmark className="h-4 w-4" /> },
];

export default function ViewerDashboard() {
  const [tab, setTab] = useState<Tab>('global');
  const { reports, pompistes, cisterns, settings } = useData();
  const period = currentPeriod();

  const daily = globalDaily(reports);
  let acc = 0;
  const cumulative = daily.map((d) => ({ date: d.date, jour: d.total, cumul: (acc += d.total) }));
  const share = volumeShare(reports, pompistes);
  const rh = stationRH(pompistes, settings.taux_journalier);
  const monthReports = reports.filter((r) => r.report_date.startsWith(period) && r.status === 'valide');
  const volMonth = monthReports.reduce((s, r) => s + r.essence_litrage + r.gasoil_litrage, 0);
  const caMonth = monthReports.reduce((s, r) => s + r.total_a_remettre, 0);

  return (
    <DashboardShell accent="Vision globale">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn whitespace-nowrap ${tab === t.id ? 'bg-energy-500 text-night-950 shadow-glow' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'carburant' && <FuelStockManagement />}
      {tab === 'capital' && <CapitalEvolution />}

      {tab === 'global' && (
        <div className="space-y-5">
          <ChampionsPodium />
          <AnnouncementsFeed />
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Volume global (mois)" value={liters(volMonth)} icon={<Droplets className="h-4 w-4" />} />
            <StatCard label="Caisse cumulée" value={fc(caMonth)} accent="text-energy-400" />
            <StatCard label="Effectif" value={rh.headcount} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Ventes globales du mois" subtitle="Volume cumulé Super + Gasoil (litres)" />
              {cumulative.length === 0 ? <EmptyState>Aucune vente ce mois-ci.</EmptyState> : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulative} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <defs><linearGradient id="cumul" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} formatter={(v: number) => liters(v)} labelFormatter={(l) => fullDate(String(l))} />
                      <Legend />
                      <Area type="monotone" dataKey="cumul" name="Cumul mensuel" stroke="#10b981" strokeWidth={2.5} fill="url(#cumul)" />
                      <Area type="monotone" dataKey="jour" name="Volume du jour" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle icon={<PieIcon className="h-5 w-5" />} title="Parts de volume" subtitle="Par pompiste" />
              {share.length === 0 ? <EmptyState>Aucune donnée.</EmptyState> : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={share} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                        {share.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} formatter={(v: number) => liters(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {cisterns.map((s) => (
              <Gauge key={s.id} label={s.name} current={s.current_l} capacity={s.capacity_l} color={s.fuel === 'gasoil' ? 'fuel' : 'energy'} />
            ))}
          </div>

          <ProfitExpensesChart />

          <Card>
            <SectionTitle icon={<Wallet className="h-5 w-5" />} title="Tableau de bord RH global" />
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Masse salariale" value={fc(rh.masseSalariale)} />
              <StatCard label="Total manquants" value={fc(rh.totalManquants)} accent="text-rose-400" />
              <StatCard label="Net global à payer" value={fc(rh.netGlobal)} accent="text-energy-400" />
            </div>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
