import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, Wallet, Droplets, HandCoins, Landmark, Truck } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { computeCapital } from '@/lib/selectors';
import { fc, shortDate, fullDate } from '@/lib/format';

export default function CapitalEvolution() {
  const { reports, cisterns, expenses, debts, debtPayments, supplierOrders, capitalHistory, settings } = useData();
  const b = computeCapital(reports, cisterns, expenses, debts, debtPayments, supplierOrders, settings.taux_journalier);

  // On s'assure que le dernier point reflète le capital courant calculé.
  const history = [...capitalHistory].sort((a, b2) => a.date.localeCompare(b2.date));

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={<Landmark className="h-5 w-5" />} title="Évolution du Capital" subtitle="Santé financière globale de la station" />
        <div className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
          <span className="font-semibold text-energy-300">Capital</span> = Caisse + Valeur Stock Carburant + Dettes Recouvrables + Commandes Fournisseurs en Cours
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Caisse (physique)" value={fc(b.caisse)} icon={<Wallet className="h-4 w-4" />} accent={b.caisse < 0 ? 'text-rose-400' : 'text-slate-100'} />
        <StatCard label="Valeur stock carburant" value={fc(b.stock_value)} icon={<Droplets className="h-4 w-4" />} />
        <StatCard label="Dettes recouvrables" value={fc(b.debts)} icon={<HandCoins className="h-4 w-4" />} accent="text-fuel-400" />
        <StatCard label="Commandes en cours" value={fc(b.orders_value)} icon={<Truck className="h-4 w-4" />} accent="text-sky-400" />
        <StatCard label="CAPITAL TOTAL" value={fc(b.capital)} icon={<TrendingUp className="h-4 w-4" />} accent="text-energy-400" />
      </div>

      <Card>
        <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Courbe du capital" subtitle="Évolution jour après jour" />
        {history.length === 0 ? (
          <EmptyState>Pas encore d'historique de capital.</EmptyState>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip
                  contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                  formatter={(v: number, name) => [fc(v), name]}
                  labelFormatter={(l) => fullDate(String(l))}
                />
                <Legend />
                <Area type="monotone" dataKey="capital" name="Capital total" stroke="#10b981" strokeWidth={2.5} fill="url(#cap)" />
                <Area type="monotone" dataKey="stock_value" name="Valeur stock" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={0} />
                <Area type="monotone" dataKey="caisse" name="Caisse" stroke="#38bdf8" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
