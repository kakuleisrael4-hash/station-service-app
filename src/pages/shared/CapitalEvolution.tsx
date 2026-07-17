import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, Wallet, Droplets, HandCoins, Landmark, Truck, DollarSign, Banknote, Fuel, Coins } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState, AnimatedNumber } from '@/components/ui';
import ProfitExpensesChart from '@/components/ProfitExpensesChart';
import { useData } from '@/context/DataContext';
import { computeCapital, capitalByCurrency, salesByFuel } from '@/lib/selectors';
import { fc, usd, liters, shortDate, fullDate } from '@/lib/format';

export default function CapitalEvolution() {
  const { reports, cisterns, expenses, debts, debtPayments, supplierOrders, cashEntries, salaryPayments, capitalHistory, settings } = useData();
  const taux = settings.taux_journalier;
  const b = computeCapital(reports, cisterns, expenses, debts, debtPayments, supplierOrders, taux, cashEntries, salaryPayments);
  const cc = capitalByCurrency(reports, cisterns, expenses, debts, debtPayments, supplierOrders, taux, cashEntries, salaryPayments);
  const sales = salesByFuel(reports);

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
        <StatCard label="CAPITAL TOTAL" value={<AnimatedNumber value={b.capital} format={fc} />} icon={<TrendingUp className="h-4 w-4" />} accent="text-energy-400" />
      </div>

      {/* ===== TRANSPARENCE DEVISES : 3 blocs distincts ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bloc USD natif */}
        <Card className="ring-1 ring-fuel-400/20">
          <div className="mb-3 flex items-center gap-2 text-fuel-300"><DollarSign className="h-5 w-5" /><h3 className="font-black uppercase tracking-wide">Total Global en Dollars</h3></div>
          <p className="text-3xl font-black tabular-nums text-fuel-300"><AnimatedNumber value={cc.usd.total} format={usd} /></p>
          <p className="mb-3 text-xs text-slate-500">≈ {fc(cc.usdInFc)} au taux {taux} FC/$</p>
          <dl className="space-y-1.5 text-sm">
            <Row label="Caisse USD" value={usd(cc.usd.caisse)} />
            <Row label="Dettes clients (USD)" value={usd(cc.usd.debts)} />
          </dl>
        </Card>

        {/* Bloc FC natif */}
        <Card className="ring-1 ring-sky-400/20">
          <div className="mb-3 flex items-center gap-2 text-sky-300"><Banknote className="h-5 w-5" /><h3 className="font-black uppercase tracking-wide">Total Global en Francs</h3></div>
          <p className="mb-3 text-3xl font-black tabular-nums text-sky-300"><AnimatedNumber value={cc.fc.total} format={fc} /></p>
          <dl className="space-y-1.5 text-sm">
            <Row label="Caisse FC" value={fc(cc.fc.caisse)} />
            <Row label="Dettes clients (FC)" value={fc(cc.fc.debts)} />
            <Row label="Valeur stock carburant" value={fc(cc.fc.stock)} />
            <Row label="Commandes en cours" value={fc(cc.fc.orders)} />
          </dl>
        </Card>

        {/* Grand total consolidé */}
        <Card className="bg-energy-500/[0.06] ring-1 ring-energy-400/40">
          <div className="mb-3 flex items-center gap-2 text-energy-300"><Coins className="h-5 w-5" /><h3 className="font-black uppercase tracking-wide">Grand Total Consolidé</h3></div>
          <p className="text-3xl font-black tabular-nums text-energy-300"><AnimatedNumber value={cc.grandTotalFc} format={fc} /></p>
          <p className="mb-3 text-xs text-slate-500">Total FC + (Total USD × {taux})</p>
          <dl className="space-y-1.5 text-sm">
            <Row label="Bloc FC" value={fc(cc.fc.total)} />
            <Row label="Bloc USD converti" value={fc(cc.usdInFc)} />
          </dl>
          <p className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-500">Égal au CAPITAL TOTAL (toutes devises confondues).</p>
        </Card>
      </div>

      {/* ===== VENTES PAR CARBURANT (rapports clôturés) ===== */}
      <Card>
        <SectionTitle icon={<Fuel className="h-5 w-5" />} title="Total des ventes par produit" subtitle="Volume écoulé & montant généré (cumul clôturé)" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-energy-500/[0.06] p-4 ring-1 ring-energy-500/20">
            <div className="mb-1 flex items-center gap-2 text-energy-300"><Droplets className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-wide">Ventes Super</span></div>
            <div className="flex items-end justify-between">
              <div><p className="text-xs text-slate-400">Volume total</p><p className="text-2xl font-black tabular-nums">{liters(sales.superVol)}</p></div>
              <div className="text-right"><p className="text-xs text-slate-400">Montant total</p><p className="text-2xl font-black tabular-nums text-energy-300">{fc(sales.superMontant)}</p></div>
            </div>
          </div>
          <div className="rounded-xl bg-fuel-500/[0.06] p-4 ring-1 ring-fuel-500/20">
            <div className="mb-1 flex items-center gap-2 text-fuel-300"><Fuel className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-wide">Ventes Gasoil</span></div>
            <div className="flex items-end justify-between">
              <div><p className="text-xs text-slate-400">Volume total</p><p className="text-2xl font-black tabular-nums">{liters(sales.gasoilVol)}</p></div>
              <div className="text-right"><p className="text-xs text-slate-400">Montant total</p><p className="text-2xl font-black tabular-nums text-fuel-300">{fc(sales.gasoilMontant)}</p></div>
            </div>
          </div>
        </div>
      </Card>

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
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
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
                <Area type="monotone" dataKey="capital" name="Capital total" stroke="#f97316" strokeWidth={2.5} fill="url(#cap)" />
                <Area type="monotone" dataKey="stock_value" name="Valeur stock" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={0} />
                <Area type="monotone" dataKey="caisse" name="Caisse" stroke="#38bdf8" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <ProfitExpensesChart />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-200">{value}</dd>
    </div>
  );
}
