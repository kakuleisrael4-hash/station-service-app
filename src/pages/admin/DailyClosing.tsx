import { useState } from 'react';
import { CalendarCheck, Loader2, History, Droplets, Wallet, TrendingUp } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { fc, liters, shortDate, fullDate } from '@/lib/format';

export default function DailyClosing() {
  const { reports, pompistes, dailyClosings, closeDay } = useData();
  const open = reports
    .filter((r) => r.status === 'valide' && !r.closed)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const selected = open.filter((r) => sel.has(r.id));
  const t = selected.reduce(
    (a, r) => ({ sup: a.sup + r.essence_litrage, gas: a.gas + r.gasoil_litrage, enc: a.enc + r.total_encaisse, ben: a.ben + r.benefice }),
    { sup: 0, gas: 0, enc: 0, ben: 0 },
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
          <SectionTitle icon={<History className="h-5 w-5" />} title="Historique des clôtures" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Clôturé le</th><th className="pb-2 text-right">Rapports</th><th className="pb-2 text-right">Volume</th><th className="pb-2 text-right">Encaissé</th><th className="pb-2 text-right">Bénéfice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dailyClosings.slice(0, 15).map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 text-slate-300">{fullDate(d.closed_at)}</td>
                    <td className="py-2 text-right tabular-nums">{d.report_count}</td>
                    <td className="py-2 text-right tabular-nums">{liters(d.total_volume_l)}</td>
                    <td className="py-2 text-right tabular-nums">{fc(d.total_encaisse)}</td>
                    <td className="py-2 text-right tabular-nums text-energy-400">{fc(d.total_benefice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
