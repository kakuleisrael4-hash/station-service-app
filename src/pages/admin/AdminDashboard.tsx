import { useState } from 'react';
import { Megaphone, FilePlus2, Wallet, Droplets, Receipt, HandCoins, Landmark, Settings as SettingsIcon, LayoutTemplate, FileDown, CalendarCheck, History, Fuel } from 'lucide-react';
import { exportReportPDF } from '@/lib/pdf';
import { getDb } from '@/lib/db';
import DashboardShell from '@/components/DashboardShell';
import ChampionsPodium from '@/components/ChampionsPodium';
import AnnouncementsFeed from '@/components/AnnouncementsFeed';
import ProfitExpensesChart from '@/components/ProfitExpensesChart';
import ReportsHistory from '@/components/ReportsHistory';
import SideNav from '@/components/SideNav';
import { Card, SectionTitle, StatCard, Gauge, EmptyState } from '@/components/ui';
import NewReportForm from './NewReportForm';
import SalaryManagement from './SalaryManagement';
import CaisseExpenses from './CaisseExpenses';
import DebtsOrders from './DebtsOrders';
import Communiques from './Communiques';
import SettingsPanel from './SettingsPanel';
import SiteEditor from './SiteEditor';
import DailyClosing from './DailyClosing';
import FuelStockManagement from '../shared/FuelStockManagement';
import CapitalEvolution from '../shared/CapitalEvolution';
import { useData } from '@/context/DataContext';
import { stationRH } from '@/lib/selectors';
import { fc, liters, shortDate, currentPeriod } from '@/lib/format';

type Tab = 'communique' | 'rapport' | 'historique' | 'cloture' | 'carburant' | 'caisse' | 'dettes' | 'capital' | 'communiques' | 'site' | 'salaires' | 'parametres';
const NAV_GROUPS = [
  {
    label: '📊 Tableau de bord',
    items: [{ id: 'communique', label: "Vue d'ensemble", icon: <Megaphone className="h-4 w-4" /> }],
  },
  {
    label: '⛽ Opérations',
    items: [
      { id: 'rapport', label: 'Nouveau Rapport', icon: <FilePlus2 className="h-4 w-4" /> },
      { id: 'historique', label: 'Historique des rapports', icon: <History className="h-4 w-4" /> },
      { id: 'cloture', label: 'Clôture journalière', icon: <CalendarCheck className="h-4 w-4" /> },
      { id: 'carburant', label: 'Citernes & Pompes', icon: <Droplets className="h-4 w-4" /> },
    ],
  },
  {
    label: '💸 Finances',
    items: [
      { id: 'caisse', label: 'Caisse & Dépenses', icon: <Receipt className="h-4 w-4" /> },
      { id: 'dettes', label: 'Dettes & Commandes', icon: <HandCoins className="h-4 w-4" /> },
      { id: 'capital', label: 'Capital', icon: <Landmark className="h-4 w-4" /> },
    ],
  },
  {
    label: '👥 Ressources humaines',
    items: [{ id: 'salaires', label: 'Salaires & Paie', icon: <Wallet className="h-4 w-4" /> }],
  },
  {
    label: '⚙️ Configuration',
    items: [
      { id: 'communiques', label: 'Communiqués', icon: <Megaphone className="h-4 w-4" /> },
      { id: 'site', label: 'Site vitrine (CMS)', icon: <LayoutTemplate className="h-4 w-4" /> },
      { id: 'parametres', label: 'Paramètres', icon: <SettingsIcon className="h-4 w-4" /> },
    ],
  },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('communique');
  const { reports, pompistes, cisterns, settings, deleteReport } = useData();
  const rh = stationRH(pompistes, settings.taux_journalier);
  const period = currentPeriod();
  const monthReports = reports.filter((r) => r.report_date.startsWith(period) && r.status === 'valide');
  const caisseMois = monthReports.reduce((s, r) => s + r.total_a_remettre, 0);
  const volSuper = monthReports.reduce((s, r) => s + r.essence_litrage, 0);
  const volGasoil = monthReports.reduce((s, r) => s + r.gasoil_litrage, 0);
  const recent = [...reports].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  return (
    <DashboardShell>
      <div className="lg:flex lg:items-start lg:gap-6">
      <SideNav groups={NAV_GROUPS} active={tab} onSelect={(id) => setTab(id as Tab)} />
      <div className="min-w-0 flex-1">

      {tab === 'communique' && (
        <div className="space-y-5">
          <ChampionsPodium />
          <AnnouncementsFeed />
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Caisse du mois" value={fc(caisseMois)} accent="text-energy-400" />
            <StatCard label="Volume Super (mois)" value={liters(volSuper)} icon={<Droplets className="h-4 w-4 text-energy-400" />} accent="text-energy-300" />
            <StatCard label="Volume Gasoil (mois)" value={liters(volGasoil)} icon={<Fuel className="h-4 w-4 text-fuel-400" />} accent="text-fuel-300" />
            <StatCard label="Manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {cisterns.map((s) => (
              <Gauge key={s.id} label={s.name} current={s.current_l} capacity={s.capacity_l} color={s.fuel === 'gasoil' ? 'fuel' : 'energy'} />
            ))}
          </div>
          <ProfitExpensesChart />
          <Card>
            <SectionTitle title="Rapports récents" subtitle="Enregistrés (à clôturer) & clôturés" />
            {recent.length === 0 ? <EmptyState>Aucun rapport.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Date</th><th className="pb-2">Pompiste</th><th className="pb-2">Statut</th><th className="pb-2 text-right">Super</th><th className="pb-2 text-right">Gasoil</th><th className="pb-2 text-right">À remettre</th><th className="pb-2 text-right">Écart</th><th className="pb-2 text-right">Manquant</th><th className="pb-2 text-right">PDF</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {recent.map((r) => {
                      const p = pompistes.find((x) => x.id === r.pompiste_id);
                      return (
                        <tr key={r.id}>
                          <td className="py-2">{shortDate(r.report_date)}</td>
                          <td className="py-2 font-medium">{p?.display_name ?? '—'}</td>
                          <td className="py-2"><span className={`chip ${r.closed ? 'bg-energy-500/15 text-energy-300' : 'bg-fuel-500/15 text-fuel-300'}`}>{r.closed ? 'Clôturé' : 'Enregistré'}</span></td>
                          <td className="py-2 text-right tabular-nums text-energy-300">{liters(r.essence_litrage)}</td>
                          <td className="py-2 text-right tabular-nums text-fuel-300">{liters(r.gasoil_litrage)}</td>
                          <td className="py-2 text-right tabular-nums">{fc(r.total_a_remettre)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {Math.abs(r.montant_ecart ?? 0) < 1 ? <span className="text-slate-500">—</span> : (
                              <span className={r.montant_ecart < 0 ? 'text-rose-400' : 'text-fuel-400'} title={r.decision_imputation === 'tolere' ? 'Déficit toléré (perte sèche)' : r.decision_imputation === 'debit_salaire' ? 'Déficit déduit du salaire' : 'Surplus en caisse'}>
                                {r.montant_ecart > 0 ? '+' : ''}{fc(r.montant_ecart)}
                                {r.decision_imputation === 'tolere' && <span className="ml-1 text-[10px] text-energy-300">toléré</span>}
                                {r.decision_imputation === 'debit_salaire' && <span className="ml-1 text-[10px] text-rose-300">salaire</span>}
                              </span>
                            )}
                          </td>
                          <td className={`py-2 text-right tabular-nums ${r.manquant > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{r.manquant > 0 ? fc(r.manquant) : '—'}</td>
                          <td className="py-2 text-right"><button onClick={async () => { const fresh = (await getDb().fetchReport(r.id)) ?? r; exportReportPDF(fresh, p?.display_name ?? 'Pompiste'); }} className="text-slate-400 hover:text-energy-400" title="Télécharger le rapport en PDF (données fraîches)"><FileDown className="ml-auto h-4 w-4" /></button></td>
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
      {tab === 'historique' && <ReportsHistory reports={reports} pompistes={pompistes} onDelete={deleteReport} />}
      {tab === 'cloture' && <DailyClosing />}
      {tab === 'carburant' && <FuelStockManagement canEdit />}
      {tab === 'caisse' && <CaisseExpenses />}
      {tab === 'dettes' && <DebtsOrders />}
      {tab === 'capital' && <CapitalEvolution />}
      {tab === 'communiques' && <Communiques />}
      {tab === 'site' && <SiteEditor />}
      {tab === 'salaires' && <SalaryManagement />}
      {tab === 'parametres' && <SettingsPanel />}
      </div>
      </div>
    </DashboardShell>
  );
}
