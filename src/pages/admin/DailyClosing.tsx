import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Loader2, History, Droplets, Wallet, TrendingUp, Fuel, Trash2, AlertTriangle, Eye, X, FileDown } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { exportClosingPDF } from '@/lib/pdf';
import { getDb } from '@/lib/db';
import { fc, liters, shortDate, fullDate } from '@/lib/format';
import type { DailyClosing as DailyClosingType } from '@/types';

export default function DailyClosing() {
  const { reports, pompistes, dailyClosings, closeDay, deleteClosing } = useData();
  const open = reports
    .filter((r) => r.status === 'valide' && !r.closed)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<DailyClosingType | null>(null);
  const [toDelete, setToDelete] = useState<DailyClosingType | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const nameOf = (id: string | null) => pompistes.find((p) => p.id === id)?.display_name ?? '—';

  async function confirmDeleteClosing() {
    if (!toDelete) return;
    setDelBusy(true);
    try { await deleteClosing(toDelete.id); setToDelete(null); setDetail(null); } finally { setDelBusy(false); }
  }

  // PDF de clôture sur données FRAÎCHES : les rapports fusionnés sont re-fetchés
  // depuis la base au moment du clic (jointures complètes), pas depuis l'état local.
  async function exportClosing(d: DailyClosingType) {
    const fresh = await getDb().fetchReportsByIds(d.report_ids);
    await exportClosingPDF(d, fresh, nameOf);
  }

  const selected = open.filter((r) => sel.has(r.id));
  const t = selected.reduce(
    (a, r) => ({
      sup: a.sup + r.essence_litrage, supM: a.supM + r.essence_montant,
      gas: a.gas + r.gasoil_litrage, gasM: a.gasM + r.gasoil_montant,
      enc: a.enc + r.total_encaisse, ben: a.ben + r.benefice,
    }),
    { sup: 0, supM: 0, gas: 0, gasM: 0, enc: 0, ben: 0 },
  );
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = open.length > 0 && selected.length === open.length;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(open.map((r) => r.id)));

  async function close() {
    if (!selected.length) return;
    setBusy(true);
    try { await closeDay([...sel]); setSel(new Set()); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={<CalendarCheck className="h-5 w-5" />} title="Clôture journalière" subtitle="Cochez les rapports composant la journée (2, 3, 4 shifts…), puis consolidez les ventes" />
        {open.length === 0 ? (
          <EmptyState>Aucun rapport en attente de clôture. Enregistrez d'abord des rapports.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-energy-500" /></th>
                    <th className="pb-2">Date</th><th className="pb-2">Pompiste</th>
                    <th className="pb-2 text-right">Volume</th><th className="pb-2 text-right">Encaissé</th><th className="pb-2 text-right">Bénéfice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {open.map((r) => {
                    const p = pompistes.find((x) => x.id === r.pompiste_id);
                    const on = sel.has(r.id);
                    return (
                      <tr key={r.id} onClick={() => toggle(r.id)} className={`cursor-pointer ${on ? 'bg-energy-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
                        <td className="py-2 pr-2"><input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="h-4 w-4 accent-energy-500" /></td>
                        <td className="py-2">{shortDate(r.report_date)}</td>
                        <td className="py-2 font-medium">{p?.display_name ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{liters(r.essence_litrage + r.gasoil_litrage)}</td>
                        <td className="py-2 text-right tabular-nums">{fc(r.total_encaisse)}</td>
                        <td className="py-2 text-right tabular-nums text-energy-400">{fc(r.benefice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <StatCard label="Rapports sélectionnés" value={selected.length} />
              <StatCard label="Volume total" value={liters(t.sup + t.gas)} icon={<Droplets className="h-4 w-4" />} hint={`Super ${liters(t.sup)} · Gasoil ${liters(t.gas)}`} />
              <StatCard label="Total encaissé" value={fc(t.enc)} icon={<Wallet className="h-4 w-4" />} accent="text-energy-400" />
              <StatCard label="Bénéfice du jour" value={fc(t.ben)} icon={<TrendingUp className="h-4 w-4" />} accent="text-fuel-400" />
            </div>

            {/* Détail explicite par produit (Super / Gasoil) */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-energy-500/[0.06] p-4 ring-1 ring-energy-500/20">
                <div className="mb-1 flex items-center gap-2 text-energy-300"><Droplets className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-wide">Ventes Super</span></div>
                <div className="flex items-end justify-between">
                  <div><p className="text-xs text-slate-400">Volume</p><p className="text-xl font-black tabular-nums">{liters(t.sup)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-400">Montant généré</p><p className="text-xl font-black tabular-nums text-energy-300">{fc(t.supM)}</p></div>
                </div>
              </div>
              <div className="rounded-xl bg-fuel-500/[0.06] p-4 ring-1 ring-fuel-500/20">
                <div className="mb-1 flex items-center gap-2 text-fuel-300"><Fuel className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-wide">Ventes Gasoil</span></div>
                <div className="flex items-end justify-between">
                  <div><p className="text-xs text-slate-400">Volume</p><p className="text-xl font-black tabular-nums">{liters(t.gas)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-400">Montant généré</p><p className="text-xl font-black tabular-nums text-fuel-300">{fc(t.gasM)}</p></div>
                </div>
              </div>
            </div>

            <button onClick={close} disabled={!selected.length || busy} className="btn-primary mt-4 !py-3 text-base font-bold">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarCheck className="h-5 w-5" />}
              Enregistrer le total des ventes journalières{selected.length ? ` (${selected.length})` : ''}
            </button>
            <p className="mt-2 text-xs text-slate-500">La clôture décrémente les citernes, impute les manquants, et injecte le total dans le capital + la courbe d'évolution.</p>
          </>
        )}
      </Card>

      {dailyClosings.length > 0 && (
        <Card>
          <SectionTitle icon={<History className="h-5 w-5" />} title="Historique des clôtures" subtitle="Cliquez une journée pour voir les rapports fusionnés" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Clôturé le</th><th className="pb-2 text-right">Rapports</th><th className="pb-2 text-right">Super</th><th className="pb-2 text-right">Gasoil</th><th className="pb-2 text-right">Encaissé</th><th className="pb-2 text-right">Bénéfice</th><th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dailyClosings.slice(0, 30).map((d) => (
                  <tr key={d.id} onClick={() => setDetail(d)} className="cursor-pointer hover:bg-white/[0.03]">
                    <td className="py-2 text-slate-300">{fullDate(d.closed_at)}</td>
                    <td className="py-2 text-right tabular-nums">{d.report_count}</td>
                    <td className="py-2 text-right tabular-nums text-energy-300">{liters(d.total_super_l)}</td>
                    <td className="py-2 text-right tabular-nums text-fuel-300">{liters(d.total_gasoil_l)}</td>
                    <td className="py-2 text-right tabular-nums">{fc(d.total_encaisse)}</td>
                    <td className="py-2 text-right tabular-nums text-energy-400">{fc(d.total_benefice)}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setDetail(d); }} className="text-slate-400 hover:text-energy-400" title="Voir le détail"><Eye className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); void exportClosing(d); }} className="text-slate-400 hover:text-energy-400" title="Télécharger la clôture en PDF (données fraîches)"><FileDown className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setToDelete(d); }} className="text-slate-400 hover:text-rose-400" title="Supprimer la clôture"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL DÉTAIL : rapports fusionnés dans une clôture */}
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-night-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-energy-200">Détail de la clôture</h3>
                <p className="text-sm text-slate-400">{fullDate(detail.closed_at)} · {detail.report_count} rapport{detail.report_count > 1 ? 's' : ''} fusionné{detail.report_count > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setDetail(null)} className="btn-ghost !px-2"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Super" value={liters(detail.total_super_l)} />
              <StatCard label="Gasoil" value={liters(detail.total_gasoil_l)} />
              <StatCard label="Encaissé" value={fc(detail.total_encaisse)} accent="text-energy-400" />
              <StatCard label="Bénéfice" value={fc(detail.total_benefice)} accent="text-fuel-400" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rapports individuels fusionnés</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Date</th><th className="pb-2">Pompiste</th><th className="pb-2 text-right">Super</th><th className="pb-2 text-right">Gasoil</th><th className="pb-2 text-right">À remettre</th><th className="pb-2 text-right">Écart</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {detail.report_ids.map((rid) => {
                  const r = reports.find((x) => x.id === rid);
                  if (!r) return <tr key={rid}><td className="py-2 text-slate-500" colSpan={6}>Rapport supprimé ({rid.slice(0, 8)}…)</td></tr>;
                  return (
                    <tr key={rid}>
                      <td className="py-2 text-slate-400">{shortDate(r.report_date)}</td>
                      <td className="py-2 font-medium">{nameOf(r.pompiste_id)}</td>
                      <td className="py-2 text-right tabular-nums text-energy-300">{liters(r.essence_litrage)}</td>
                      <td className="py-2 text-right tabular-nums text-fuel-300">{liters(r.gasoil_litrage)}</td>
                      <td className="py-2 text-right tabular-nums">{fc(r.total_a_remettre)}</td>
                      <td className={`py-2 text-right tabular-nums ${Math.abs(r.montant_ecart ?? 0) < 1 ? 'text-slate-500' : r.montant_ecart < 0 ? 'text-rose-400' : 'text-fuel-400'}`}>{Math.abs(r.montant_ecart ?? 0) < 1 ? '—' : `${r.montant_ecart > 0 ? '+' : ''}${fc(r.montant_ecart)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => void exportClosing(detail)} className="btn bg-energy-500/15 text-energy-300 hover:bg-energy-500/25"><FileDown className="h-4 w-4" /> Exporter en PDF</button>
              <button onClick={() => { setToDelete(detail); }} className="btn bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Trash2 className="h-4 w-4" /> Supprimer cette clôture</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL CONFIRMATION : suppression d'une clôture */}
      {toDelete && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm" onClick={() => !delBusy && setToDelete(null)}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-night-900 p-6 shadow-2xl ring-1 ring-rose-500/20">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-400"><AlertTriangle className="h-6 w-6" /></div>
              <h3 className="text-lg font-black text-rose-200">Supprimer cette clôture ?</h3>
            </div>
            <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20">
              Les {toDelete.report_count} rapport{toDelete.report_count > 1 ? 's' : ''} repasseront <span className="font-bold">« En cours »</span>. Le système va automatiquement ré-injecter le carburant dans les citernes, annuler les manquants imputés aux pompistes, et recalculer le capital.
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setToDelete(null)} disabled={delBusy} className="btn flex-1 bg-white/5 text-slate-200 hover:bg-white/10">Annuler</button>
              <button onClick={confirmDeleteClosing} disabled={delBusy} className="btn flex-1 bg-rose-500 font-bold text-night-950 hover:bg-rose-400">
                {delBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
