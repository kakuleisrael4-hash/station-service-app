import { useState } from 'react';
import { Wallet, TrendingUp, History, Loader2, FileDown, DollarSign, Banknote, BadgeCheck, CalendarClock, HandCoins } from 'lucide-react';
import { Card, SectionTitle, Modal, StatCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { payroll, payrollOf, stationRH } from '@/lib/selectors';
import { fc, usd, fullDate, shortDate, currentPeriod, monthLabel, recentPeriods, todayISO } from '@/lib/format';
import { exportPayslipPDF } from '@/lib/pdf';
import type { PompisteProfile, TempsUnite } from '@/types';

export default function SalaryManagement() {
  const { user } = useAuth();
  const { pompistes, salaryHistory, salaryPayments, settings, updateSalary, paySalary } = useData();
  const taux = settings.taux_journalier;
  const [editing, setEditing] = useState<PompisteProfile | null>(null);
  const [editFc, setEditFc] = useState('');
  const [editUsd, setEditUsd] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Paiement de salaire ---
  const [paying, setPaying] = useState<PompisteProfile | null>(null);
  const [payPeriod, setPayPeriod] = useState(currentPeriod());
  const [payDate, setPayDate] = useState(todayISO());
  const [payTemps, setPayTemps] = useState('');
  const [payUnite, setPayUnite] = useState<TempsUnite>('jours');
  const [payBusy, setPayBusy] = useState(false);
  const periods = recentPeriods(12);
  const payInfo = paying ? payrollOf(paying, taux) : null;
  const payFcAmount = payInfo ? Math.max(0, payInfo.net_fc) : 0;
  const payUsdAmount = payInfo ? Math.max(0, payInfo.net_usd) : 0;

  const rows = payroll(pompistes, taux);
  const rh = stationRH(pompistes, taux);

  function open(p: PompisteProfile) {
    setEditing(p);
    setEditFc(String(p.base_salary));
    setEditUsd(String(p.base_salary_usd));
  }
  async function save() {
    if (!editing || !user) return;
    setBusy(true);
    try {
      await updateSalary(editing.id, { base_salary: parseFloat(editFc) || 0, base_salary_usd: parseFloat(editUsd) || 0 }, user);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  function openPay(p: PompisteProfile) {
    setPaying(p); setPayPeriod(currentPeriod()); setPayDate(todayISO()); setPayTemps(''); setPayUnite('jours');
  }
  async function confirmPay() {
    if (!paying || !user) return;
    setPayBusy(true);
    try {
      await paySalary({
        pompiste_id: paying.id, mois_concerne: payPeriod, date_paiement: payDate,
        temps_travail: parseFloat(payTemps) || 0, temps_unite: payUnite,
        montant_paye_fc: payFcAmount, montant_paye_usd: payUsdAmount,
      }, user);
      setPaying(null);
    } finally { setPayBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Masse salariale (FC)" value={fc(rh.masseSalariale)} icon={<Wallet className="h-4 w-4" />} hint={`USD convertis au taux ${taux}`} />
        <StatCard label="Total manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
        <StatCard label="Net global à payer (FC)" value={fc(rh.netGlobal)} accent="text-energy-400" />
      </div>

      <Card>
        <SectionTitle icon={<Wallet className="h-5 w-5" />} title="Gestion des salaires bi-devise" subtitle="Le manquant (FC) coupe d'abord le salaire FC, puis bascule en USD au taux du jour" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3">Pompiste</th>
                <th className="pb-3 text-right">Salaire de base</th>
                <th className="pb-3 text-right">Manquants</th>
                <th className="pb-3 text-right">Net à payer</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(({ pompiste, b }) => (
                <tr key={pompiste.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-semibold">{pompiste.display_name}</td>
                  <td className="py-3 text-right tabular-nums">
                    {fc(b.base_fc)}{b.base_usd > 0 && <span className="block text-xs text-fuel-300">+ {usd(b.base_usd)}</span>}
                  </td>
                  <td className="py-3 text-right tabular-nums text-rose-400">
                    − {fc(b.retenue_fc)}{b.retenue_usd > 0 && <span className="block text-xs">− {usd(b.retenue_usd)}</span>}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    <span className="font-bold text-energy-400">{fc(b.net_fc)}</span>
                    {pompiste.base_salary_usd > 0 && <span className={`block text-xs ${b.net_usd < 0 ? 'text-rose-400' : 'text-fuel-300'}`}>+ {usd(b.net_usd)}</span>}
                    <span className="block text-[10px] text-slate-500">≈ {fc(b.net_total_fc)}</span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => exportPayslipPDF(pompiste, currentPeriod(), taux)} className="btn-ghost !py-1.5 !px-2.5" title="Fiche de paie PDF"><FileDown className="h-4 w-4" /></button>
                      <button onClick={() => open(pompiste)} className="btn-ghost !py-1.5 !px-3"><TrendingUp className="h-4 w-4" /> Modifier</button>
                      <button onClick={() => openPay(pompiste)} className="btn !py-1.5 !px-3 bg-energy-500 font-semibold text-night-950 hover:bg-energy-400"><HandCoins className="h-4 w-4" /> Payer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {salaryPayments.length > 0 && (
        <Card>
          <SectionTitle icon={<BadgeCheck className="h-5 w-5" />} title="Historique des paies" subtitle="Salaires officiellement versés" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Pompiste</th><th className="pb-2">Période</th><th className="pb-2">Payé le</th><th className="pb-2 text-right">Temps</th><th className="pb-2 text-right">Montant FC</th><th className="pb-2 text-right">Montant USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {salaryPayments.slice(0, 20).map((p) => {
                  const who = pompistes.find((x) => x.id === p.pompiste_id);
                  return (
                    <tr key={p.id}>
                      <td className="py-2 font-medium">{who?.display_name ?? '—'}</td>
                      <td className="py-2 text-slate-300">{monthLabel(p.mois_concerne)}</td>
                      <td className="py-2 text-slate-400">{shortDate(p.date_paiement)}</td>
                      <td className="py-2 text-right tabular-nums">{p.temps_travail} {p.temps_unite}</td>
                      <td className="py-2 text-right tabular-nums text-energy-400">{fc(p.montant_paye_fc)}</td>
                      <td className="py-2 text-right tabular-nums text-fuel-300">{p.montant_paye_usd > 0 ? usd(p.montant_paye_usd) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {salaryHistory.length > 0 && (
        <Card>
          <SectionTitle icon={<History className="h-5 w-5" />} title="Historique des salaires" />
          <ul className="space-y-2 text-sm">
            {salaryHistory.slice(0, 8).map((h) => {
              const p = pompistes.find((x) => x.id === h.pompiste_id);
              return (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                  <span className="font-medium">{p?.display_name ?? 'Pompiste'}</span>
                  <span className="text-slate-400 tabular-nums text-xs">
                    {fc(h.old_salary)} / {usd(h.old_salary_usd ?? 0)} → <span className="text-energy-400">{fc(h.new_salary)} / {usd(h.new_salary_usd ?? 0)}</span>
                  </span>
                  <span className="text-xs text-slate-500">{fullDate(h.changed_at)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Salaire — ${editing?.display_name ?? ''}`}>
        <p className="mb-3 text-sm text-slate-400">Le salaire de base peut combiner une part en FC et une part en USD (ou 100 % de l'une).</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label flex items-center gap-1"><Banknote className="h-3 w-3" /> Part FC</label>
            <input type="number" className="field" value={editFc} onChange={(e) => setEditFc(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label flex items-center gap-1"><DollarSign className="h-3 w-3" /> Part USD</label>
            <input type="number" className="field" value={editUsd} onChange={(e) => setEditUsd(e.target.value)} />
          </div>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Enregistrer le salaire
        </button>
      </Modal>

      {/* PAIEMENT DE SALAIRE */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Paiement du salaire — ${paying?.display_name ?? ''}`}>
        {paying && payInfo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Période concernée *</label>
                <select className="field" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}>
                  {periods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date de paiement *</label>
                <input type="date" className="field" value={payDate} max={todayISO()} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Temps de travail</label>
                <input type="number" className="field" placeholder="0" value={payTemps} onChange={(e) => setPayTemps(e.target.value)} />
              </div>
              <div>
                <label className="label">Unité</label>
                <select className="field" value={payUnite} onChange={(e) => setPayUnite(e.target.value as TempsUnite)}>
                  <option value="jours">Jours</option>
                  <option value="heures">Heures</option>
                </select>
              </div>
            </div>

            {/* Récapitulatif lecture seule */}
            <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Récapitulatif (Net à payer)</p>
              <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Salaire de base</span><span className="tabular-nums">{fc(payInfo.base_fc)}{payInfo.base_usd > 0 && ` + ${usd(payInfo.base_usd)}`}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-rose-300">− Cumul manquants</span><span className="tabular-nums text-rose-400">− {fc(payInfo.retenue_fc)}{payInfo.retenue_usd > 0 && ` / − ${usd(payInfo.retenue_usd)}`}</span></div>
              <div className="my-2 border-t border-white/10" />
              <div className="flex items-end justify-between">
                <span className="font-semibold text-energy-300">= Net à payer</span>
                <span className="text-right">
                  <span className="block text-xl font-black tabular-nums text-energy-400">{fc(payFcAmount)}</span>
                  {payUsdAmount > 0 && <span className="block text-sm font-bold text-fuel-300">+ {usd(payUsdAmount)}</span>}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">À la validation : le cumul des manquants est remis à 0, le montant est décaissé de la caisse, et le pompiste est notifié.</p>

            <button onClick={confirmPay} disabled={payBusy} className="btn w-full !py-3 bg-energy-500 text-base font-bold text-night-950 hover:bg-energy-400 shadow-glow">
              {payBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />} ENREGISTRER LE PAIEMENT
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
