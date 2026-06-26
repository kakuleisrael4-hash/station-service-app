import { useState } from 'react';
import { HandCoins, Truck, Plus, CheckCircle2, Clock, Loader2, Wallet, FileDown } from 'lucide-react';
import { exportDebtsPDF } from '@/lib/pdf';
import { Card, SectionTitle, StatCard, EmptyState, Modal } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { debtPaid, debtRemaining, recoverableDebtsFC } from '@/lib/selectors';
import { FUEL_LABEL } from '@/constants';
import { fc, usd, liters, fullDate, todayISO } from '@/lib/format';
import type { Currency, FuelType } from '@/types';

/** Affiche un montant dans sa devise. */
const money = (amount: number, currency: Currency) => (currency === 'USD' ? usd(amount) : fc(amount));

type Sub = 'dettes' | 'commandes';

export default function DebtsOrders() {
  const { debts, debtPayments, supplierOrders, cisterns, settings, addDebt, addDebtPayment, createSupplierOrder, setOrderStatus } = useData();
  const [sub, setSub] = useState<Sub>('dettes');

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button onClick={() => setSub('dettes')} className={`btn ${sub === 'dettes' ? 'bg-energy-500 text-night-950' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}><HandCoins className="h-4 w-4" /> Dettes clients</button>
        <button onClick={() => setSub('commandes')} className={`btn ${sub === 'commandes' ? 'bg-energy-500 text-night-950' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}><Truck className="h-4 w-4" /> Commandes carburant</button>
      </div>

      {sub === 'dettes' ? (
        <DebtsTab debts={debts} debtPayments={debtPayments} recoverable={recoverableDebtsFC(debts, debtPayments, settings.taux_journalier)} addDebt={addDebt} addDebtPayment={addDebtPayment} />
      ) : (
        <OrdersTab orders={supplierOrders} cisterns={cisterns} createOrder={createSupplierOrder} setStatus={setOrderStatus} />
      )}
    </div>
  );
}

function DebtsTab({ debts, debtPayments, recoverable, addDebt, addDebtPayment }: any) {
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
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Dettes recouvrables (FC)" value={fc(recoverable)} hint="USD convertis au taux du jour" accent="text-fuel-400" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Dettes en attente" value={debts.filter((d: any) => d.status === 'en_attente').length} accent="text-rose-400" />
        <StatCard label="Dettes soldées" value={debts.filter((d: any) => d.status === 'soldee').length} accent="text-energy-400" />
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
                {debts.map((d: any) => {
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
    </>
  );
}

function OrdersTab({ orders, cisterns, createOrder, setStatus }: any) {
  const [form, setForm] = useState({ supplier_name: '', cistern_id: cisterns[0]?.id ?? '', volume_l: '', purchase_price: '', deposit: '', order_date: todayISO() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function deliver(id: string) {
    setErr(null);
    try {
      await setStatus(id, 'livre');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Livraison impossible.');
    }
  }

  async function submit() {
    const volume_l = parseFloat(form.volume_l), purchase_price = parseFloat(form.purchase_price), deposit = parseFloat(form.deposit) || 0;
    if (!form.supplier_name || !form.cistern_id || !Number.isFinite(volume_l) || volume_l <= 0) return;
    setBusy(true);
    try {
      await createOrder({ supplier_name: form.supplier_name, cistern_id: form.cistern_id, volume_l, purchase_price: purchase_price || 0, deposit, order_date: form.order_date });
      setForm({ supplier_name: '', cistern_id: cisterns[0]?.id ?? '', volume_l: '', purchase_price: '', deposit: '', order_date: todayISO() });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Commandes en cours" value={orders.filter((o: any) => o.status === 'en_cours').length} accent="text-fuel-400" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Volume commandé (en cours)" value={liters(orders.filter((o: any) => o.status === 'en_cours').reduce((s: number, o: any) => s + o.volume_l, 0))} />
        <StatCard label="Acomptes versés (en cours)" value={fc(orders.filter((o: any) => o.status === 'en_cours').reduce((s: number, o: any) => s + o.deposit, 0))} />
      </div>

      <Card>
        <SectionTitle icon={<Plus className="h-5 w-5" />} title="Nouvelle commande fournisseur" />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="field" placeholder="Nom du fournisseur" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
          <select className="field" value={form.cistern_id} onChange={(e) => setForm({ ...form, cistern_id: e.target.value })}>
            {cisterns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" className="field" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
          <input type="number" className="field" placeholder="Volume (litres)" value={form.volume_l} onChange={(e) => setForm({ ...form, volume_l: e.target.value })} />
          <input type="number" className="field" placeholder="Prix d'achat total (FC)" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
          <input type="number" className="field" placeholder="Acompte versé (FC)" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
        </div>
        {form.cistern_id && (() => {
          const cit = cisterns.find((c: any) => c.id === form.cistern_id);
          if (!cit) return null;
          const dispo = cit.capacity_l - cit.current_l;
          return <p className="mt-2 text-xs text-slate-500">Espace disponible dans {cit.name} : <span className="tabular-nums text-slate-300">{liters(dispo)}</span> sur {liters(cit.capacity_l)}.</p>;
        })()}
        <button onClick={submit} disabled={busy} className="btn-primary mt-4">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer la commande</button>
      </Card>

      {err && <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">{err}</div>}

      <Card>
        <SectionTitle title="Commandes en cours & livrées" subtitle="Passer à « Livré » incrémente automatiquement la citerne (sans dépasser sa capacité)" />
        {orders.length === 0 ? <EmptyState>Aucune commande.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Fournisseur</th><th className="pb-2">Citerne</th><th className="pb-2 text-right">Volume</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">Acompte</th><th className="pb-2">Statut</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o: any) => {
                  const cit = cisterns.find((c: any) => c.id === o.cistern_id);
                  return (
                    <tr key={o.id}>
                      <td className="py-2"><p className="font-medium">{o.supplier_name}</p><p className="text-xs text-slate-500">{fullDate(o.order_date)}</p></td>
                      <td className="py-2 text-slate-300">{cit?.name ?? o.cistern_id}</td>
                      <td className="py-2 text-right tabular-nums">{liters(o.volume_l)}</td>
                      <td className="py-2 text-right tabular-nums">{fc(o.purchase_price)}</td>
                      <td className="py-2 text-right tabular-nums">{fc(o.deposit)}</td>
                      <td className="py-2"><span className={`chip ${o.status === 'livre' ? 'bg-energy-500/15 text-energy-300' : 'bg-fuel-500/15 text-fuel-300'}`}>{o.status === 'livre' ? <><CheckCircle2 className="h-3 w-3" /> Livré</> : <><Clock className="h-3 w-3" /> En cours</>}</span></td>
                      <td className="py-2 text-right">{o.status === 'en_cours' && <button onClick={() => deliver(o.id)} className="btn-ghost !py-1.5 !px-3 text-energy-300"><CheckCircle2 className="h-4 w-4" /> Marquer livré</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
