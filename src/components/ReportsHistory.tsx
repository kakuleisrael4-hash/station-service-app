import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, History, Droplets, Fuel, Trash2, AlertTriangle, Loader2, FileDown } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { exportReportPDF } from '@/lib/pdf';
import { fc, liters, shortDate } from '@/lib/format';
import type { PompisteProfile, Report } from '@/types';

type StatusFilter = 'all' | 'encours' | 'cloture';

interface Props {
  reports: Report[];
  pompistes: PompisteProfile[];
  /** Si fourni (Admin), affiche le bouton de suppression sécurisé. */
  onDelete?: (reportId: string) => Promise<void>;
}

/**
 * Historique des rapports avec recherche (pompiste), plage de dates et statut.
 * Volumes Super / Gasoil distincts. Suppression sécurisée (Admin) via pop-up.
 */
export default function ReportsHistory({ reports, pompistes, onDelete }: Props) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string | null) => pompistes.find((p) => p.id === id)?.display_name ?? '—';

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...reports]
      .filter((r) => {
        if (status === 'encours' && r.closed) return false;
        if (status === 'cloture' && !r.closed) return false;
        if (from && r.report_date < from) return false;
        if (to && r.report_date > to) return false;
        if (term && !nameOf(r.pompiste_id).toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.created_at.localeCompare(a.created_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, pompistes, q, from, to, status]);

  async function confirmDelete() {
    if (!pending || !onDelete) return;
    setBusy(true);
    try { await onDelete(pending.id); setPending(null); } finally { setBusy(false); }
  }

  return (
    <Card>
      <SectionTitle icon={<History className="h-5 w-5" />} title="Historique des rapports" subtitle="Recherche par pompiste · plage de dates · statut" />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="field !pl-9" placeholder="Nom du pompiste…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="encours">En cours (non clôturés)</option>
          <option value="cloture">Clôturés</option>
        </select>
        <div>
          <label className="label !mb-0.5 text-[10px]">Du</label>
          <input type="date" className="field !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label !mb-0.5 text-[10px]">Au</label>
          <input type="date" className="field !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mb-2 text-xs text-slate-400">{rows.length} rapport{rows.length > 1 ? 's' : ''}</div>

      {rows.length === 0 ? (
        <EmptyState>Aucun rapport ne correspond à ces critères.</EmptyState>
      ) : (
        <div className="max-h-[32rem] overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-night-950/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Pompiste</th>
                <th className="py-2 pr-2 text-right"><span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3 text-energy-400" />Super</span></th>
                <th className="py-2 pr-2 text-right"><span className="inline-flex items-center gap-1"><Fuel className="h-3 w-3 text-fuel-400" />Gasoil</span></th>
                <th className="py-2 pr-2 text-right">À remettre</th>
                <th className="py-2 pr-2 text-right">Écart</th>
                <th className="py-2 pr-2">Statut</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-2 whitespace-nowrap text-slate-400">{shortDate(r.report_date)}</td>
                  <td className="py-2 pr-2 font-medium">{nameOf(r.pompiste_id)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-energy-300">{liters(r.essence_litrage)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-fuel-300">{liters(r.gasoil_litrage)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fc(r.total_a_remettre)}</td>
                  <td className={`py-2 pr-2 text-right tabular-nums ${Math.abs(r.montant_ecart ?? 0) < 1 ? 'text-slate-500' : r.montant_ecart < 0 ? 'text-rose-400' : 'text-fuel-400'}`}>
                    {Math.abs(r.montant_ecart ?? 0) < 1 ? '—' : `${r.montant_ecart > 0 ? '+' : ''}${fc(r.montant_ecart)}`}
                  </td>
                  <td className="py-2 pr-2"><span className={`chip ${r.closed ? 'bg-energy-500/15 text-energy-300' : 'bg-fuel-500/15 text-fuel-300'}`}>{r.closed ? 'Clôturé' : 'En cours'}</span></td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => exportReportPDF(r, nameOf(r.pompiste_id))} className="text-slate-400 hover:text-energy-400" title="Télécharger en PDF"><FileDown className="h-4 w-4" /></button>
                      {onDelete && <button onClick={() => setPending(r)} className="text-slate-400 hover:text-rose-400" title="Supprimer le rapport"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* POP-UP de confirmation de suppression */}
      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm" onClick={() => !busy && setPending(null)}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-night-900 p-6 shadow-2xl ring-1 ring-rose-500/20">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-400"><AlertTriangle className="h-6 w-6" /></div>
              <h3 className="text-lg font-black text-rose-200">Supprimer ce rapport ?</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Rapport de <span className="font-semibold text-slate-100">{nameOf(pending.pompiste_id)}</span> du {shortDate(pending.report_date)} ({liters(pending.essence_litrage)} Super · {liters(pending.gasoil_litrage)} Gasoil).
            </p>
            {pending.closed && (
              <div className="mt-3 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-200 ring-1 ring-rose-500/20">
                Ce rapport est <span className="font-bold">clôturé</span>. La suppression va automatiquement : ré-injecter le carburant dans les citernes{pending.manquant > 0 ? `, annuler le manquant de ${fc(pending.manquant)} imputé au pompiste` : ''}, et recalculer le capital.
              </div>
            )}
            <p className="mt-3 text-sm font-semibold text-slate-200">Cette action est irréversible.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setPending(null)} disabled={busy} className="btn flex-1 bg-white/5 text-slate-200 hover:bg-white/10">Annuler</button>
              <button onClick={confirmDelete} disabled={busy} className="btn flex-1 bg-rose-500 font-bold text-night-950 hover:bg-rose-400">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer définitivement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Card>
  );
}
