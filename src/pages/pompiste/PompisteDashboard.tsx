import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Megaphone, LineChart as LineIcon, Wallet, Star, MessageSquare, Droplets, Fuel, TrendingDown } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import ChampionsPodium from '@/components/ChampionsPodium';
import AnnouncementsFeed from '@/components/AnnouncementsFeed';
import { Card, SectionTitle, StatCard, StarRating, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { pompisteDaily } from '@/lib/selectors';
import { fc, liters, shortDate, fullDate, currentPeriod } from '@/lib/format';

type Tab = 'communique' | 'performances' | 'compte';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'communique', label: 'Communiqué', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'performances', label: 'Mes performances', icon: <LineIcon className="h-4 w-4" /> },
  { id: 'compte', label: 'Mon Compte & Salaire', icon: <Wallet className="h-4 w-4" /> },
];

export default function PompisteDashboard() {
  const { user } = useAuth();
  const { reports, pompistes } = useData();
  const [tab, setTab] = useState<Tab>('communique');

  const me = pompistes.find((p) => p.id === user?.pompiste_id || p.user_id === user?.id);
  const myReports = reports
    .filter((r) => r.pompiste_id === me?.id && r.status === 'valide')
    .sort((a, b) => b.report_date.localeCompare(a.report_date));
  const series = me ? pompisteDaily(reports, me.id) : [];
  const last = myReports[0];

  const period = currentPeriod();
  const monthReports = myReports.filter((r) => r.report_date.startsWith(period));
  const volMonth = monthReports.reduce((s, r) => s + r.essence_litrage + r.gasoil_litrage, 0);
  const starsValues = myReports.map((r) => r.final_stars ?? Math.round((r.auto_score ?? 0) / 2)).filter((x) => x > 0);
  const avgStars = starsValues.length ? Math.round(starsValues.reduce((a, b) => a + b, 0) / starsValues.length) : 0;

  const base = me?.base_salary ?? 0;
  const retenues = me?.cumul_manquants_mois ?? 0;
  const net = base - retenues;

  if (!me) {
    return (
      <DashboardShell>
        <EmptyState>Aucune fiche pompiste n'est rattachée à votre compte. Contactez l'administrateur.</EmptyState>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell accent={`Bonjour, ${me.display_name}`}>
      <div className="mb-5 flex gap-2 overflow-x-auto">
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
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Volume vendu (mois)" value={liters(volMonth)} icon={<Droplets className="h-4 w-4" />} />
            <StatCard label="Rapports validés" value={monthReports.length} />
            <StatCard label="Note moyenne" value={`${avgStars}★`} accent="text-fuel-400" />
          </div>
          {last?.admin_comment && (
            <Card>
              <SectionTitle icon={<MessageSquare className="h-5 w-5" />} title="Dernier mot de l'admin" subtitle={fullDate(last.report_date)} />
              <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-slate-200 ring-1 ring-white/10">“{last.admin_comment}”</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'performances' && (
        <div className="space-y-5">
          {/* Graphique QUANTITÉS uniquement (jamais de montants) */}
          <Card>
            <SectionTitle icon={<LineIcon className="h-5 w-5" />} title="Évolution des ventes" subtitle="Quantités vendues par jour (litres) — essence & gasoil" />
            {series.length === 0 ? (
              <EmptyState>Pas encore de données ce mois-ci.</EmptyState>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                      formatter={(v: number) => liters(v)}
                      labelFormatter={(l) => fullDate(String(l))}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="essence" name="Essence" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="gasoil" name="Gasoil" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">ℹ Votre espace affiche uniquement les volumes vendus, jamais les montants financiers.</p>
          </Card>

          {/* Évaluation */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={<Star className="h-5 w-5" />} title="Mon évaluation" />
              {last ? (
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Note auto</p>
                    <p className={`text-4xl font-black ${(last.auto_score ?? 0) >= 9 ? 'text-energy-400' : (last.auto_score ?? 0) >= 7 ? 'text-fuel-400' : 'text-rose-400'}`}>{last.auto_score ?? 0}<span className="text-lg text-slate-500">/10</span></p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Étoiles admin</p>
                    <StarRating value={last.final_stars ?? Math.round((last.auto_score ?? 0) / 2)} readOnly />
                  </div>
                </div>
              ) : <p className="text-sm text-slate-500">Aucune évaluation disponible.</p>}
            </Card>

            {/* Suggestions */}
            <Card>
              <SectionTitle icon={<MessageSquare className="h-5 w-5" />} title="Suggestions de l'admin" />
              <div className="space-y-2">
                {myReports.filter((r) => r.admin_comment).slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-xl bg-white/[0.03] p-3 text-sm ring-1 ring-white/10">
                    <p className="text-slate-200">“{r.admin_comment}”</p>
                    <p className="mt-1 text-xs text-slate-500">{shortDate(r.report_date)}</p>
                  </div>
                ))}
                {myReports.filter((r) => r.admin_comment).length === 0 && <p className="text-sm text-slate-500">Aucune suggestion pour l'instant.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'compte' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle icon={<Wallet className="h-5 w-5" />} title="Fiche de paie en direct" subtitle={`Période ${period}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
                <span className="text-slate-300">Salaire de base</span>
                <span className="text-lg font-bold tabular-nums">{fc(base)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-rose-500/10 px-4 py-3 ring-1 ring-rose-500/30">
                <span className="flex items-center gap-2 text-rose-300"><TrendingDown className="h-4 w-4" /> Retenues (manquants cumulés)</span>
                <span className="text-lg font-bold tabular-nums text-rose-400">− {fc(retenues)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-energy-500/15 to-fuel-500/10 px-4 py-4 ring-1 ring-energy-400/30">
                <span className="font-semibold">Net estimé en fin de mois</span>
                <span className="text-2xl font-black tabular-nums text-energy-400">{fc(net)}</span>
              </div>
              <p className="text-xs text-slate-500">Les retenues correspondent à vos manquants imputés ce mois-ci. Un mois sans manquant = salaire de base intégral.</p>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Détail des manquants du mois" />
            <div className="space-y-2">
              {monthReports.filter((r) => r.manquant > 0).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm ring-1 ring-white/10">
                  <span>{shortDate(r.report_date)}</span>
                  <span className="font-semibold tabular-nums text-rose-400">− {fc(r.manquant)}</span>
                </div>
              ))}
              {monthReports.filter((r) => r.manquant > 0).length === 0 && (
                <p className="rounded-xl bg-energy-500/10 px-3 py-3 text-sm text-energy-300">Aucun manquant ce mois-ci — bravo ! 🎉</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
