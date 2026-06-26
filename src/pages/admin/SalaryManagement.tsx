import { useState } from 'react';
import { Wallet, TrendingUp, History, Loader2, FileDown } from 'lucide-react';
import { Card, SectionTitle, Modal, StatCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { payroll, stationRH } from '@/lib/selectors';
import { fc, fullDate, currentPeriod } from '@/lib/format';
import { exportPayslipPDF } from '@/lib/pdf';
import type { PompisteProfile } from '@/types';

export default function SalaryManagement() {
  const { user } = useAuth();
  const { pompistes, salaryHistory, updateSalary } = useData();
  const [editing, setEditing] = useState<PompisteProfile | null>(null);
  const [newSalary, setNewSalary] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = payroll(pompistes);
  const rh = stationRH(pompistes);

  async function save() {
    if (!editing || !user) return;
    const val = parseFloat(newSalary);
    if (!Number.isFinite(val) || val <= 0) return;
    setBusy(true);
    try {
      await updateSalary(editing.id, val, user);
      setEditing(null);
      setNewSalary('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Masse salariale" value={fc(rh.masseSalariale)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Total manquants (mois)" value={fc(rh.totalManquants)} accent="text-rose-400" />
        <StatCard label="Net global à payer" value={fc(rh.netGlobal)} accent="text-energy-400" />
      </div>

      <Card>
        <SectionTitle icon={<Wallet className="h-5 w-5" />} title="Gestion des salaires" subtitle="Net à payer = Salaire de base − Cumul des manquants" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3">Pompiste</th>
                <th className="pb-3 text-right">Salaire de base</th>
                <th className="pb-3 text-right">Cumul manquants</th>
                <th className="pb-3 text-right">Net à payer</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(({ pompiste, net }) => (
                <tr key={pompiste.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-semibold">{pompiste.display_name}</td>
                  <td className="py-3 text-right tabular-nums">{fc(pompiste.base_salary)}</td>
                  <td className="py-3 text-right tabular-nums text-rose-400">− {fc(pompiste.cumul_manquants_mois)}</td>
                  <td className="py-3 text-right font-bold tabular-nums text-energy-400">{fc(net)}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => exportPayslipPDF(pompiste, currentPeriod())} className="btn-ghost !py-1.5 !px-2.5" title="Fiche de paie PDF"><FileDown className="h-4 w-4" /></button>
                      <button onClick={() => { setEditing(pompiste); setNewSalary(String(pompiste.base_salary)); }} className="btn-ghost !py-1.5 !px-3">
                        <TrendingUp className="h-4 w-4" /> Augmenter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {salaryHistory.length > 0 && (
        <Card>
          <SectionTitle icon={<History className="h-5 w-5" />} title="Historique des augmentations" />
          <ul className="space-y-2 text-sm">
            {salaryHistory.slice(0, 8).map((h) => {
              const p = pompistes.find((x) => x.id === h.pompiste_id);
              const up = h.new_salary > h.old_salary;
              return (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                  <span className="font-medium">{p?.display_name ?? 'Pompiste'}</span>
                  <span className="text-slate-400 tabular-nums">
                    {fc(h.old_salary)} → <span className={up ? 'text-energy-400' : 'text-rose-400'}>{fc(h.new_salary)}</span>
                  </span>
                  <span className="text-xs text-slate-500">{fullDate(h.changed_at)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Augmenter — ${editing?.display_name ?? ''}`}>
        <p className="mb-3 text-sm text-slate-400">
          Salaire actuel : <span className="font-semibold text-slate-200">{fc(editing?.base_salary ?? 0)}</span>.
          L'ancienne valeur sera archivée et le pompiste recevra une notification festive.
        </p>
        <label className="label">Nouveau salaire de base (FC)</label>
        <input type="number" className="field" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} autoFocus />
        <button onClick={save} disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Valider l'augmentation
        </button>
      </Modal>
    </div>
  );
}
