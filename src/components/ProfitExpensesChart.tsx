import { ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ComposedChart } from 'recharts';
import { Scale, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { profitVsExpenses } from '@/lib/selectors';
import { fc, shortDate, fullDate, currentPeriod } from '@/lib/format';

/** Graphique comparatif Bénéfices réalisés vs Dépenses + alerte rentabilité. */
export default function ProfitExpensesChart() {
  const { reports, expenses } = useData();
  const d = profitVsExpenses(reports, expenses);
  // série cumulée pour la lecture de tendance
  let bc = 0, dc = 0;
  const data = d.series.map((p) => ({ ...p, benefices_cumul: (bc += p.benefices), depenses_cumul: (dc += p.depenses) }));

  return (
    <Card>
      <SectionTitle
        icon={<Scale className="h-5 w-5" />}
        title="Rentabilité : bénéfices vs dépenses"
        subtitle={`Mois en cours (${currentPeriod()})`}
        right={
          <span className={`chip ${d.deficit ? 'bg-rose-500/15 text-rose-300' : 'bg-energy-500/15 text-energy-300'}`}>
            {d.deficit ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {d.deficit ? 'Déficitaire' : 'Rentable'}
          </span>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Bénéfices réalisés" value={fc(d.totalBenefices)} icon={<TrendingUp className="h-4 w-4" />} accent="text-energy-400" />
        <StatCard label="Dépenses effectuées" value={fc(d.totalDepenses)} icon={<TrendingDown className="h-4 w-4" />} accent="text-rose-400" />
        <StatCard label="Résultat net" value={fc(d.resultat)} accent={d.resultat < 0 ? 'text-rose-400' : 'text-energy-400'} />
      </div>

      {d.deficit && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/40">
          <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
          Alerte : Les dépenses dépassent les bénéfices générés sur cette période !
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState>Pas encore de ventes ni de dépenses ce mois-ci.</EmptyState>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                formatter={(v: number, name) => [fc(v), name]}
                labelFormatter={(l) => fullDate(String(l))}
              />
              <Legend />
              <Bar dataKey="benefices" name="Bénéfices (jour)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="depenses" name="Dépenses (jour)" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Line type="monotone" dataKey="benefices_cumul" name="Bénéfices cumulés" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="depenses_cumul" name="Dépenses cumulées" stroke="#f43f5e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
