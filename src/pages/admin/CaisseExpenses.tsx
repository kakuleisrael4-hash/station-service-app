import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Wallet, Plus, Tag, PieChart as PieIcon, Receipt, Loader2, DollarSign, Banknote, PlusCircle, Trash2 } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import ExpensesTable from '@/components/ExpensesTable';
import { useData } from '@/context/DataContext';
import { computeCaisse, expensesByCategory } from '@/lib/selectors';
import { fc, usd, shortDate, todayISO, currentPeriod } from '@/lib/format';
import type { Currency } from '@/types';

export default function CaisseExpenses() {
  const { reports, expenses, expenseCategories, debtPayments, supplierOrders, cashEntries, salaryPayments, settings, addExpense, deleteExpense, addCashEntry, deleteCashEntry, addExpenseCategory, deleteExpenseCategory } = useData();
  const taux = settings.taux_journalier;
  const caisse = computeCaisse(reports, expenses, debtPayments, supplierOrders, taux, cashEntries, salaryPayments);
  const period = currentPeriod();
  const monthExp = expenses.filter((e) => e.date.startsWith(period)).reduce((s, e) => s + e.amount_fc, 0);
  const byCat = expensesByCategory(expenses, expenseCategories);

  const [exp, setExp] = useState<{ category_id: string; description: string; amount_fc: string; amount_usd: string; date: string }>({ category_id: '', description: '', amount_fc: '', amount_usd: '', date: todayISO() });
  const [cat, setCat] = useState({ name: '', color: '#f97316' });
  const [busy, setBusy] = useState(false);
  const expTotalFc = (parseFloat(exp.amount_fc) || 0) + (parseFloat(exp.amount_usd) || 0) * taux;

  async function removeCategory(id: string, name: string) {
    const linked = expenses.filter((e) => e.category_id === id).length;
    const msg = linked > 0
      ? `⚠ ${linked} dépense(s) sont liées à « ${name} ». Elles seront conservées mais dé-catégorisées. Supprimer la catégorie ?`
      : `Supprimer la catégorie « ${name} » ?`;
    if (window.confirm(msg)) await deleteExpenseCategory(id);
  }
  async function removeCashEntry(id: string, motif: string) {
    if (window.confirm(`Supprimer l'apport « ${motif} » ? Le montant sera retiré de la caisse (recalcul du capital).`)) await deleteCashEntry(id);
  }
  async function removeExpense(id: string) {
    if (window.confirm('Supprimer cette dépense ? La caisse et le capital seront réajustés.')) await deleteExpense(id);
  }

  // --- Apport de fonds (hors rapport) ---
  const [apport, setApport] = useState<{ currency: Currency; amount: string; motif: string; date: string }>({ currency: 'FC', amount: '', motif: '', date: todayISO() });
  const [apportBusy, setApportBusy] = useState(false);
  async function submitApport() {
    const amount = parseFloat(apport.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !apport.motif.trim()) return;
    setApportBusy(true);
    try {
      await addCashEntry({ currency: apport.currency, amount, motif: apport.motif.trim(), date: apport.date });
      setApport({ currency: 'FC', amount: '', motif: '', date: todayISO() });
    } finally { setApportBusy(false); }
  }

  async function submitExpense() {
    const fcPart = parseFloat(exp.amount_fc) || 0;
    const usdPart = parseFloat(exp.amount_usd) || 0;
    if (!exp.category_id || !exp.description || (fcPart <= 0 && usdPart <= 0)) return;
    setBusy(true);
    try {
      await addExpense({ category_id: exp.category_id, description: exp.description, amount: fcPart, amount_usd: usdPart, date: exp.date });
      setExp({ category_id: '', description: '', amount_fc: '', amount_usd: '', date: todayISO() });
    } finally { setBusy(false); }
  }
  async function submitCategory() {
    if (!cat.name.trim()) return;
    await addExpenseCategory(cat.name.trim(), cat.color);
    setCat({ name: '', color: '#f97316' });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Solde caisse FC" value={fc(caisse.fc)} icon={<Banknote className="h-4 w-4" />} accent={caisse.fc < 0 ? 'text-rose-400' : 'text-slate-100'} />
        <StatCard label="Solde caisse USD" value={usd(caisse.usd)} icon={<DollarSign className="h-4 w-4" />} accent={caisse.usd < 0 ? 'text-rose-400' : 'text-fuel-400'} hint={`≈ ${fc(caisse.usd * taux)} au taux ${taux}`} />
        <StatCard label="Caisse totale (FC)" value={fc(caisse.total_fc)} icon={<Wallet className="h-4 w-4" />} accent="text-energy-400" />
        <StatCard label="Dépenses du mois" value={fc(monthExp)} accent="text-rose-400" />
      </div>

      {/* APPORT DE FONDS (hors rapport) — alimente directement la caisse */}
      <Card className="border-energy-400/20">
        <SectionTitle icon={<PlusCircle className="h-5 w-5" />} title="Apport de fonds (hors rapport)" subtitle="Injecter de l'argent dans la caisse, indépendamment des ventes" />
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Devise</label>
            <select className="field" value={apport.currency} onChange={(e) => setApport({ ...apport, currency: e.target.value as Currency })}>
              <option value="FC">FC (Franc)</option><option value="USD">USD (Dollar)</option>
            </select>
          </div>
          <div><label className="label">Montant ({apport.currency})</label><input type="number" className="field" placeholder="0" value={apport.amount} onChange={(e) => setApport({ ...apport, amount: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Motif / source *</label><input className="field" placeholder="Ex: Apport personnel gérant, Fonds de roulement, Prêt bancaire…" value={apport.motif} onChange={(e) => setApport({ ...apport, motif: e.target.value })} /></div>
          <div><label className="label">Date</label><input type="date" className="field" value={apport.date} onChange={(e) => setApport({ ...apport, date: e.target.value })} /></div>
        </div>
        {apport.currency === 'USD' && apport.amount && <p className="mt-2 text-sm text-energy-300">≈ <span className="font-bold tabular-nums">{fc((parseFloat(apport.amount) || 0) * taux)}</span> au taux du jour.</p>}
        <button onClick={submitApport} disabled={apportBusy || !apport.motif.trim() || !(parseFloat(apport.amount) > 0)} className="btn-primary mt-3">{apportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Injecter dans la caisse</button>

        {cashEntries.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Historique des apports (Entrée · Apport externe)</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5">
                {cashEntries.slice(0, 20).map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 text-slate-400">{shortDate(c.date)}</td>
                    <td className="py-2"><span className="chip bg-energy-500/15 text-energy-300">Entrée · Apport externe</span></td>
                    <td className="py-2 text-slate-300">{c.motif}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-energy-400">+ {c.currency === 'USD' ? usd(c.amount) : fc(c.amount)}</td>
                    <td className="py-2 pl-2 text-right"><button onClick={() => removeCashEntry(c.id, c.motif)} className="text-slate-500 hover:text-rose-400" title="Supprimer cet apport"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
              <label className="label flex items-center gap-1"><Banknote className="h-3 w-3" /> Montant en FC</label>
              <input type="number" className="field" placeholder="0" value={exp.amount_fc} onChange={(e) => setExp({ ...exp, amount_fc: e.target.value })} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><DollarSign className="h-3 w-3" /> Montant en USD</label>
              <input type="number" className="field" placeholder="0" value={exp.amount_usd} onChange={(e) => setExp({ ...exp, amount_usd: e.target.value })} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-400">Dépense mixte possible (FC + USD). Coût total consolidé : <span className="font-bold tabular-nums text-energy-300">{fc(expTotalFc)}</span>
            {parseFloat(exp.amount_usd) > 0 && <span className="text-slate-500"> — dont {usd(parseFloat(exp.amount_usd) || 0)} × {taux}</span>}.</p>
          <button onClick={submitExpense} disabled={busy || (!(parseFloat(exp.amount_fc) > 0) && !(parseFloat(exp.amount_usd) > 0))} className="btn-primary mt-4">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer la dépense</button>
        </Card>

        {/* Catégories */}
        <Card>
          <SectionTitle icon={<Tag className="h-5 w-5" />} title="Catégories de dépenses" />
          <div className="mb-3 flex flex-wrap gap-2">
            {expenseCategories.map((c) => (
              <span key={c.id} className="chip group" style={{ background: `${c.color}22`, color: c.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                <button onClick={() => removeCategory(c.id, c.name)} className="ml-1 text-current/60 hover:text-rose-400" title="Supprimer la catégorie"><Trash2 className="h-3 w-3" /></button>
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

      {/* Journal des dépenses — recherche & filtres avancés + suppression */}
      <ExpensesTable expenses={expenses} categories={expenseCategories} onDelete={removeExpense} subtitle="Rapport & hors-rapport — recherche, filtres catégorie / devise / période" />
    </div>
  );
}
