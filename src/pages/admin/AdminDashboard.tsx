import { useState } from 'react';
import { Megaphone, FilePlus2, Wallet, Gauge as GaugeIcon, Droplets, Receipt, HandCoins, Landmark, Settings as SettingsIcon, LayoutTemplate } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import ChampionsPodium from '@/components/ChampionsPodium';
import AnnouncementsFeed from '@/components/AnnouncementsFeed';
import { Card, SectionTitle, StatCard, Gauge, EmptyState } from '@/components/ui';
import NewReportForm from './NewReportForm';
import SalaryManagement from './SalaryManagement';
import CaisseExpenses from './CaisseExpenses';
import DebtsOrders from './DebtsOrders';
import Communiques from './Communiques';
import SettingsPanel from './SettingsPanel';
import SiteEditor from './SiteEditor';
import FuelStockManagement from '../shared/FuelStockManagement';
import CapitalEvolution from '../shared/CapitalEvolution';
import { useData } from '@/context/DataContext';
import { stationRH } from '@/lib/selectors';
import { fc, liters, shortDate, currentPeriod } from '@/lib/format';

type Tab = 'communique' | 'rapport' | 'carburant' | 'caisse' | 'dettes' | 'capital' | 'communiques' | 'site' | 'salaires' | 'parametres';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'communique', label: 'Communiqué', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'rapport', label: 'Nouveau Rapport', icon: <FilePlus2 className="h-4 w-4" /> },
  { id: 'carburant', label: 'Carburant & Stocks', icon: <Droplets className="h-4 w-4" /> },
  { id: 'caisse', label: 'Caisse & Dépenses', icon: <Receipt className="h-4 w-4" /> },
  { id: 'dettes', label: 'Dettes & Commandes', icon: <HandCoins className="h-4 w-4" /> },
  { id: 'capital', label: 'Capital', icon: <Landmark className="h-4 w-4" /> },
  { id: 'communiques', label: 'Communiqués', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'site', label: 'Site vitrine', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'salaires', label: 'Salaires', icon: <Wallet className="h-4 w-4" /> },
  { id: 'parametres', label: 'Paramètres', icon: <SettingsIcon className="h-4 w-4" /> },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('communique');
  const { reports, pompistes, cisterns } = useData();
  const rh = stationRH(pompistes);
  const period = currentPeriod();
  const monthReports = reports.filter((r) => r.report_date.startsWith(period) && r.status === 'valide');
  const caisseMois = monthReports.reduce((s, r) => s + r.total_a_remettre, 0);
  const volMois = monthReports.reduce((s, r) => s + r.essence_litrage + r.gasoil_litrage, 0);
  const recent = [...reports].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  return (
    <DashboardShell>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn whitespace-nowrap ${tab === t.id ? 'bg-energy-500 text-night-950 shadow-glow' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'communique' && (
        <div className="space-y-5">
          <ChampionsPodium />
          <AnnouncementsFeed />
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Caisse du mois" value={fc(caisseMois)} accent="text-energy-400" />
            <StatCard label="Volume vendu" value={liters(volMois)} icon={<GaugeIcon className="h-4 w-4" />} />
            <StatCard label="Masse salariale" value={fc(rh.masseSalariale)} />
            <StatCard label="Manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {cisterns.map((s) => (
              <Gauge key={s.id} label={s.name} current={s.current_l} capacity={s.capacity_l} color={s.fuel === 'gasoil' ? 'fuel' : 'energy'} />
            ))}
          </div>
          <Card>
            <SectionTitle title="Rapports récents" subtitle="Derniers rapports validés" />
            {recent.length === 0 ? <EmptyState>Aucun rapport.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Date</th><th className="pb-2">Pompiste</th><th className="pb-2 text-right">Volume</th><th className="pb-2 text-right">À remettre</th><th className="pb-2 text-right">Manquant</th><th className="pb-2 text-right">Note</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {recent.map((r) => {
                      const p = pompistes.find((x) => x.id === r.pompiste_id);
                      return (
                        <tr key={r.id}>
                          <td className="py-2">{shortDate(r.report_date)}</td>
                          <td className="py-2 font-medium">{p?.display_name ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums">{liters(r.essence_litrage + r.gasoil_litrage)}</td>
                          <td className="py-2 text-right tabular-nums">{fc(r.total_a_remettre)}</td>
                          <td className={`py-2 text-right tabular-nums ${r.manquant > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{r.manquant > 0 ? fc(r.manquant) : '—'}</td>
                          <td className="py-2 text-right tabular-nums">{r.final_stars ?? Math.round((r.auto_score ?? 0) / 2)}★</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'rapport' && <NewReportForm />}
      {tab === 'carburant' && <FuelStockManagement canEdit />}
      {tab === 'caisse' && <CaisseExpenses />}
      {tab === 'dettes' && <DebtsOrders />}
      {tab === 'capital' && <CapitalEvolution />}
      {tab === 'communiques' && <Communiques />}
      {tab === 'site' && <SiteEditor />}
      {tab === 'salaires' && <SalaryManagement />}
      {tab === 'parametres' && <SettingsPanel />}
    </DashboardShell>
  );
}
