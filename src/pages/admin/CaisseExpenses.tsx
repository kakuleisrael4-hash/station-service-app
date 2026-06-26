import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Wallet, Plus, Tag, PieChart as PieIcon, Receipt, Loader2, DollarSign, Banknote } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { computeCaisse, expensesByCategory } from '@/lib/selectors';
import { fc, usd, todayISO, currentPeriod } from '@/lib/format';
import type { Currency } from '@/types';

export default function CaisseExpenses() {
  const { reports, expenses, expenseCategories, debtPayments, supplierOrders, settings, addExpense, addExpenseCategory } = useData();
  const taux = settings.taux_journalier;
  const caisse = computeCaisse(reports, expenses, debtPayments, supplierOrders, taux);
  const period = currentPeriod();
  const monthExp = expenses.filter((e) => e.date.startsWith(period)).reduce((s, e) => s + e.amount_fc, 0);
  const byCat = expensesByCategory(expenses, expenseCategories);

  const [exp, setExp] = useState<{ category_id: string; description: string; amount: string; currency: Currency; date: string }>({ category_id: '', description: '', amount: '', currency: 'FC', date: todayISO() });
  const [cat, setCat] = useState({ name: '', color: '#10b981' });
  const [busy, setBusy] = useState(false);

  async function submitExpense() {
    const amount = parseFloat(exp.amount);
    if (!exp.category_id || !exp.description || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    try {
      await addExpense({ category_id: exp.category_id, description: exp.description, amount, currency: exp.currency, date: exp.date });
      setExp({ category_id: '', description: '', amount: '', currency: 'FC', date: todayISO() });
    } finally { setBusy(false); }
  }
  async function submitCategory() {
    if (!cat.name.trim()) return;
    await addExpenseCategory(cat.name.trim(), cat.color);
    setCat({ name: '', color: '#10b981' });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Solde caisse FC" value={fc(caisse.fc)} icon={<Banknote className="h-4 w-4" />} accent={caisse.fc < 0 ? 'text-rose-400' : 'text-slate-100'} />
        <StatCard label="Solde caisse USD" value={usd(caisse.usd)} icon={<DollarSign className="h-4 w-4" />} accent={caisse.usd < 0 ? 'text-rose-400' : 'text-fuel-400'} hint={`≈ ${fc(caisse.usd * taux)} au taux ${taux}`} />
        <StatCard label="Caisse totale (FC)" value={fc(caisse.total_fc)} icon={<Wallet className="h-4 w-4" />} accent="text-energy-400" />
        <StatCard label="Dépenses du mois" value={fc(monthExp)} accent="text-rose-400" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Saisie dépense hors-rapport */}
        <Card className="lg:col-span-2">
          <SectionTitle icon={<Receipt className="h-5 w-5" />} title="Nouvelle dépense (hors rapport)" subtitle="Catégorie obligatoire" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Catégorie *</label>
              <select className="field" value={exp.category_id} onChange={(e) => setExp({ ...exp, category_id: e.target.value })}>
                <option value="">— Choisir —</option>
                {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Date</label><input type="date" className="field" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Description</label><input className="field" placeholder="Ex: Facture SNEL" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} /></div>
            <div>
              <label className="label">Devise</label>
              <select className="field" value={exp.currency} onChange={(e) => setExp({ ...exp, currency: e.target.value as Currency })}>
                <option value="FC">FC (Franc)</option><option value="USD">USD (Dollar)</option>
              </select>
            </div>
            <div>
              <label className="label">Montant ({exp.currency})</label>
              <input type="number" className="field" placeholder="0" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
            </div>
          </div>
          {exp.currency === 'USD' && exp.amount && (
            <p className="mt-2 text-sm text-energy-300">≈ <span className="font-bold tabular-nums">{fc((parseFloat(exp.amount) || 0) * taux)}</span> au taux du jour ({taux} FC/$).</p>
          )}
          <button onClick={submitExpense} disabled={busy} className="btn-primary mt-4">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer la dépense</button>
        </Card>

        {/* Catégories */}
        <Card>
          <SectionTitle icon={<Tag className="h-5 w-5" />} title="Catégories de dépenses" />
          <div className="mb-3 flex flex-wrap gap-2">
            {expenseCategories.map((c) => (
              <span key={c.id} className="chip" style={{ background: `${c.color}22`, color: c.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="field flex-1" placeholder="Nouvelle catégorie" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
            <input type="color" className="h-10 w-12 rounded-lg bg-night-900 ring-1 ring-white/10" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} />
            <button onClick={submitCategory} className="btn-ghost !px-3"><Plus className="h-4 w-4" /></button>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Analytique par catégorie */}
        <Card>
          <SectionTitle icon={<PieIcon className="h-5 w-5" />} title="Dépenses par catégorie" subtitle="Où part l'argent" />
          {byCat.length === 0 ? <EmptyState>Aucune dépense.</EmptyState> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="total" nameKey="category.name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {byCat.map((r) => <Cell key={r.category.id} fill={r.category.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0b101e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} formatter={(v: number, _n, p: any) => [fc(v), p?.payload?.category?.name]} />
                  <Legend formatter={(_v, _e, i) => byCat[i as number]?.category.name} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Journal des transactions */}
        <Card>
          <SectionTitle title="Journal des dépenses" subtitle="Rapport & hors-rapport" />
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5">
                {expenses.slice(0, 40).map((e) => {
                  const c = expenseCategories.find((x) => x.id === e.category_id);
                  return (
                    <tr key={e.id}>
                      <td className="py-2"><span className="chip" style={{ background: `${c?.color ?? '#64748b'}22`, color: c?.color ?? '#94a3b8' }}>{c?.name ?? 'Sans catégorie'}</span></td>
                      <td className="py-2 text-slate-300">{e.description}</td>
                      <td className="py-2 text-xs text-slate-500">{e.report_id ? 'Rapport' : 'Hors-rapport'}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-rose-400">
                        − {e.currency === 'USD' ? usd(e.amount) : fc(e.amount)}
                        {e.currency === 'USD' && <span className="ml-1 block text-[10px] font-normal text-slate-500">≈ {fc(e.amount_fc)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
