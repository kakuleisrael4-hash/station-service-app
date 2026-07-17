import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Wallet, Droplets, Megaphone, Landmark, Receipt, History, Fuel } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import ChampionsPodium from '@/components/ChampionsPodium';
import AnnouncementsFeed from '@/components/AnnouncementsFeed';
import ProfitExpensesChart from '@/components/ProfitExpensesChart';
import ExpensesTable from '@/components/ExpensesTable';
import ReportsHistory from '@/components/ReportsHistory';
import SideNav from '@/components/SideNav';
import { Card, SectionTitle, StatCard, Gauge, EmptyState, AnimatedNumber } from '@/components/ui';
import FuelStockManagement from '../shared/FuelStockManagement';
import CapitalEvolution from '../shared/CapitalEvolution';
import { useData } from '@/context/DataContext';
import { globalDaily, volumeShare, stationRH } from '@/lib/selectors';
import { fc, liters, shortDate, fullDate, currentPeriod } from '@/lib/format';

const PIE_COLORS = ['#f97316', '#f59e0b', '#38bdf8', '#a78bfa', '#fb7185', '#fb923c'];
type Tab = 'global' | 'rapports' | 'carburant' | 'capital' | 'depenses';
const NAV_GROUPS = [
  {
    label: '📊 Tableau de bord',
    items: [{ id: 'global', label: 'Vue globale', icon: <Megaphone className="h-4 w-4" /> }],
  },
  {
    label: '⛽ Opérations',
    items: [
      { id: 'rapports', label: 'Rapports', icon: <History className="h-4 w-4" /> },
      { id: 'carburant', label: 'Citernes & Pompes', icon: <Droplets className="h-4 w-4" /> },
    ],
  },
  {
    label: '💸 Finances',
    items: [
      { id: 'capital', label: 'Capital', icon: <Landmark className="h-4 w-4" /> },
      { id: 'depenses', label: 'Audit dépenses', icon: <Receipt className="h-4 w-4" /> },
    ],
  },
];

export default function ViewerDashboard() {
  const [tab, setTab] = useState<Tab>('global');
  const { reports, pompistes, cisterns, settings, expenses, expenseCategories } = useData();
  const period = currentPeriod();

  const daily = globalDaily(reports);
  let acc = 0;
  const cumulative = daily.map((d) => ({ date: d.date, jour: d.total, cumul: (acc += d.total) }));
  const share = volumeShare(reports, pompistes);
  const rh = stationRH(pompistes, settings.taux_journalier);
  const monthReports = reports.filter((r) => r.report_date.startsWith(period) && r.status === 'valide');
  const volSuper = monthReports.reduce((s, r) => s + r.essence_litrage, 0);
  const volGasoil = monthReports.reduce((s, r) => s + r.gasoil_litrage, 0);
  const caMonth = monthReports.reduce((s, r) => s + r.total_a_remettre, 0);

  return (
    <DashboardShell accent="Vision globale">
      <div className="lg:flex lg:items-start lg:gap-6">
      <SideNav groups={NAV_GROUPS} active={tab} onSelect={(id) => setTab(id as Tab)}
        bottomBar={{ itemIds: ['global', 'rapports', 'depenses'], centerId: 'capital' }} />
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">

      {tab === 'rapports' && <ReportsHistory reports={reports} pompistes={pompistes} />}
      {tab === 'carburant' && <FuelStockManagement />}
      {tab === 'capital' && <CapitalEvolution />}
      {tab === 'depenses' && (
        <ExpensesTable
          expenses={expenses}
          categories={expenseCategories}
          title="Audit des dépenses"
          subtitle="Historique complet et chronologique — contrôle des sorties d'argent"
        />
      )}

      {tab === 'global' && (
        <div className="space-y-5">
          <ChampionsPodium />
          <AnnouncementsFeed />
          <div className="stagger grid gap-4 sm:grid-cols-4">
            <StatCard label="Volume Super (mois)" value={liters(volSuper)} icon={<Droplets className="h-4 w-4 text-energy-400" />} accent="text-energy-300" />
            <StatCard label="Volume Gasoil (mois)" value={liters(volGasoil)} icon={<Fuel className="h-4 w-4 text-fuel-400" />} accent="text-fuel-300" />
            <StatCard label="Caisse cumulée" value={<AnimatedNumber value={caMonth} format={fc} />} accent="text-energy-400" />
            <StatCard label="Manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Ventes globales du mois" subtitle="Volume cumulé Super + Gasoil (litres)" />
              {cumulative.length === 0 ? <EmptyState>Aucune vente ce mois-ci.</EmptyState> : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulative} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <defs><linearGradient id="cumul" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.5} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} formatter={(v: number) => liters(v)} labelFormatter={(l) => fullDate(String(l))} />
                      <Legend />
                      <Area type="monotone" dataKey="cumul" name="Cumul mensuel" stroke="#f97316" strokeWidth={2.5} fill="url(#cumul)" />
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
      </div>
      </div>
    </DashboardShell>
  );
}
