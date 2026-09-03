import { useState } from 'react';
import { HandCoins, Plus, Loader2, Wallet, FileDown } from 'lucide-react';
import { exportDebtsPDF } from '@/lib/pdf';
import { Card, SectionTitle, StatCard, EmptyState, Modal } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { debtPaid, debtRemaining, recoverableDebtsFC } from '@/lib/selectors';
import { FUEL_LABEL } from '@/constants';
import { fc, usd, liters, fullDate, todayISO } from '@/lib/format';
import type { Currency, FuelType } from '@/types';

/** Affiche un montant dans sa devise. */
const money = (amount: number, currency: Currency) => (currency === 'USD' ? usd(amount) : fc(amount));

export default function Debts() {
  const { debts, debtPayments, settings, addDebt, addDebtPayment } = useData();
  const recoverable = recoverableDebtsFC(debts, debtPayments, settings.taux_journalier);

  const [form, setForm] = useState({ client_name: '', phone: '', fuel: 'gasoil' as FuelType, currency: 'FC' as Currency, liters: '', total_amount: '', date: todayISO() });
  const [payFor, setPayFor] = useState<any>(null);
  const [pay, setPay] = useState({ amount: '', date: todayISO() });
  const [busy, setBusy] = useState(false);

  async function submit() {
    const liters = parseFloat(form.liters), total = parseFloat(form.total_amount);
    if (!form.client_name || !Number.isFinite(total) || total <= 0) return;
    setBusy(true);
    try {
      await addDebt({ client_name: form.client_name, phone: form.phone, fuel: form.fuel, liters: liters || 0, total_amount: total, currency: form.currency, date: form.date });
      setForm({ client_name: '', phone: '', fuel: 'gasoil', currency: 'FC', liters: '', total_amount: '', date: todayISO() });
    } finally { setBusy(false); }
  }
  async function submitPayment() {
    const amount = parseFloat(pay.amount);
    if (!payFor || !Number.isFinite(amount) || amount <= 0) return;
    await addDebtPayment(payFor.id, amount, pay.date);
    setPayFor(null); setPay({ amount: '', date: todayISO() });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Dettes recouvrables (FC)" value={fc(recoverable)} hint="USD convertis au taux du jour" accent="text-fuel-400" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Dettes en attente" value={debts.filter((d) => d.status === 'en_attente').length} accent="text-rose-400" />
        <StatCard label="Dettes soldées" value={debts.filter((d) => d.status === 'soldee').length} accent="text-energy-400" />
      </div>

      <Card>
        <SectionTitle icon={<Plus className="h-5 w-5" />} title="Enregistrer une dette" subtitle="Crédit client / partenaire" />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="field" placeholder="Nom du client / entreprise" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          <input className="field" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="date" className="field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className="field" value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value as FuelType })}>
            <option value="gasoil">Gasoil</option><option value="super">Super</option>
          </select>
          <select className="field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}>
            <option value="FC">Devise : FC</option><option value="USD">Devise : USD</option>
          </select>
          <input type="number" className="field" placeholder="Litres pris" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} />
          <input type="number" className="field" placeholder={`Montant total (${form.currency})`} value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary mt-4">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter la dette</button>
      </Card>

      <Card>
        <SectionTitle title="Registre des dettes" right={debts.length > 0 ? <button onClick={() => exportDebtsPDF(debts, debtPayments)} className="btn-ghost !py-1.5 !px-3"><FileDown className="h-4 w-4" /> Exporter PDF</button> : undefined} />
        {debts.length === 0 ? <EmptyState>Aucune dette.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Client</th><th className="pb-2">Carburant</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Payé</th><th className="pb-2 text-right">Reste</th><th className="pb-2">Statut</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {debts.map((d) => {
                  const paid = debtPaid(d, debtPayments), rem = debtRemaining(d, debtPayments);
                  return (
                    <tr key={d.id}>
                      <td className="py-2"><p className="font-medium">{d.client_name}</p><p className="text-xs text-slate-500">{d.phone} · {fullDate(d.date)}</p></td>
                      <td className="py-2 text-slate-300">{FUEL_LABEL[d.fuel as FuelType]} · {liters(d.liters)} <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">{d.currency}</span></td>
                      <td className="py-2 text-right tabular-nums">{money(d.total_amount, d.currency)}</td>
                      <td className="py-2 text-right tabular-nums text-energy-400">{money(paid, d.currency)}</td>
                      <td className="py-2 text-right tabular-nums text-rose-400">{money(rem, d.currency)}</td>
                      <td className="py-2"><span className={`chip ${d.status === 'soldee' ? 'bg-energy-500/15 text-energy-300' : 'bg-rose-500/15 text-rose-300'}`}>{d.status === 'soldee' ? 'Soldée' : 'En attente'}</span></td>
                      <td className="py-2 text-right">{d.status === 'en_attente' && <button onClick={() => setPayFor(d)} className="btn-ghost !py-1.5 !px-3"><Wallet className="h-4 w-4" /> Paiement</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`Paiement — ${payFor?.client_name ?? ''}`}>
        <p className="mb-3 text-sm text-slate-400">Reste dû : <span className="font-semibold text-rose-300">{payFor ? money(debtRemaining(payFor, debtPayments), payFor.currency) : ''}</span> <span className="text-xs">(remboursement en {payFor?.currency})</span></p>
        <label className="label">Montant du paiement ({payFor?.currency})</label>
        <input type="number" className="field" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} autoFocus />
        <label className="label mt-3">Date</label>
        <input type="date" className="field" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
        <button onClick={submitPayment} className="btn-primary mt-4 w-full"><Wallet className="h-4 w-4" /> Enregistrer le paiement</button>
      </Modal>
    </div>
  );
}
