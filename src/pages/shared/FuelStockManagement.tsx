import { useState } from 'react';
import { Droplets, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, ClipboardCheck, Scale, Loader2 } from 'lucide-react';
import { Card, SectionTitle, Gauge, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { stockValue } from '@/lib/selectors';
import { CRITICAL_STOCK_PCT } from '@/constants';
import { fc, liters, fullDate } from '@/lib/format';

export default function FuelStockManagement({ canEdit = false }: { canEdit?: boolean }) {
  const { cisterns, fuelMovements, stockLogs, addStockLog } = useData();
  const critical = cisterns.filter((c) => (c.current_l / c.capacity_l) * 100 < CRITICAL_STOCK_PCT);
  const totalL = cisterns.reduce((s, c) => s + c.current_l, 0);

  // Saisie du relevé physique par citerne
  const [phys, setPhys] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [adjust, setAdjust] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toNum = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : NaN; };

  async function saveReading(cisternId: string) {
    const val = toNum(phys[cisternId] ?? '');
    if (!Number.isFinite(val)) return;
    setBusy(cisternId);
    try {
      await addStockLog(cisternId, val, note, adjust);
      setPhys((p) => ({ ...p, [cisternId]: '' }));
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Volume total en stock" value={liters(totalL)} icon={<Droplets className="h-4 w-4" />} />
        <StatCard label="Valeur du stock" value={fc(stockValue(cisterns))} accent="text-energy-400" />
        <StatCard label="Citernes critiques" value={critical.length} accent={critical.length ? 'text-rose-400' : 'text-slate-100'} />
      </div>

      {critical.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Stock critique (&lt; {CRITICAL_STOCK_PCT}%) : {critical.map((c) => c.name).join(', ')}. Planifiez une commande fournisseur.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {cisterns.map((c) => (
          <Gauge key={c.id} label={c.name} current={c.current_l} capacity={c.capacity_l} color={c.fuel === 'gasoil' ? 'fuel' : 'energy'} criticalPct={CRITICAL_STOCK_PCT} />
        ))}
      </div>

      {/* DOUBLE SÉCURISATION : relevé physique vs théorique */}
      {canEdit && (
        <Card>
          <SectionTitle icon={<Scale className="h-5 w-5" />} title="Double sécurisation du stock" subtitle="Relevé de jauge physique vs stock théorique — détection du coulage" />
          <div className="space-y-2">
            {cisterns.map((c) => {
              const val = toNum(phys[c.id] ?? '');
              const ecart = Number.isFinite(val) ? val - c.current_l : null;
              return (
                <div key={c.id} className="grid items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">Théorique : <span className="tabular-nums text-slate-300">{liters(c.current_l)}</span></p>
                  </div>
                  <input type="number" className="field !py-2 w-32" placeholder="Relevé (L)" value={phys[c.id] ?? ''} onChange={(e) => setPhys((p) => ({ ...p, [c.id]: e.target.value }))} />
                  <div className="w-28 text-right">
                    <p className="text-xs text-slate-500">Écart</p>
                    <p className={`font-bold tabular-nums ${ecart == null ? 'text-slate-500' : ecart < 0 ? 'text-rose-400' : ecart > 0 ? 'text-fuel-400' : 'text-energy-400'}`}>
                      {ecart == null ? '—' : `${ecart > 0 ? '+' : ''}${liters(ecart)}`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{ecart != null && ecart < 0 ? 'coulage' : ecart != null && ecart > 0 ? 'surplus' : ''}</span>
                  <button onClick={() => saveReading(c.id)} disabled={busy === c.id || !Number.isFinite(val)} className="btn-ghost !py-1.5 !px-3">
                    {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Enregistrer
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <input className="field flex-1 min-w-[12rem]" placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} className="h-4 w-4 accent-energy-500" />
              Ajuster le stock théorique au relevé
            </label>
          </div>
        </Card>
      )}

      {/* Historique des écarts (audit) */}
      <Card>
        <SectionTitle title="Historique des relevés / écarts" subtitle="Audit théorique vs physique" />
        {stockLogs.length === 0 ? <EmptyState>Aucun relevé enregistré.</EmptyState> : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-night-950/80 backdrop-blur"><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Date</th><th className="pb-2">Citerne</th><th className="pb-2 text-right">Théorique</th><th className="pb-2 text-right">Physique</th><th className="pb-2 text-right">Écart</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {stockLogs.map((l) => {
                  const cit = cisterns.find((c) => c.id === l.cistern_id);
                  return (
                    <tr key={l.id}>
                      <td className="py-2 text-slate-400">{fullDate(l.created_at)}</td>
                      <td className="py-2 font-medium">{cit?.name ?? l.cistern_id}</td>
                      <td className="py-2 text-right tabular-nums">{liters(l.theoretical_l)}</td>
                      <td className="py-2 text-right tabular-nums">{liters(l.physical_l)}</td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${l.ecart < 0 ? 'text-rose-400' : l.ecart > 0 ? 'text-fuel-400' : 'text-energy-400'}`}>{l.ecart > 0 ? '+' : ''}{liters(l.ecart)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Historique des flux de carburant" subtitle="Entrées (livraisons) & sorties (ventes)" />
        {fuelMovements.length === 0 ? <EmptyState>Aucun mouvement.</EmptyState> : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-night-950/80 backdrop-blur"><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Date</th><th className="pb-2">Citerne</th><th className="pb-2">Type</th><th className="pb-2 text-right">Volume</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {fuelMovements.slice(0, 60).map((m) => {
                  const cit = cisterns.find((c) => c.id === m.cistern_id);
                  const entree = m.kind === 'entree';
                  return (
                    <tr key={m.id}>
                      <td className="py-2 text-slate-400">{fullDate(m.created_at)}</td>
                      <td className="py-2 font-medium">{cit?.name ?? m.cistern_id}</td>
                      <td className="py-2"><span className={`chip ${entree ? 'bg-energy-500/15 text-energy-300' : 'bg-fuel-500/15 text-fuel-300'}`}>{entree ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}{entree ? 'Entrée' : 'Sortie'} · {m.source}</span></td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${entree ? 'text-energy-400' : 'text-fuel-400'}`}>{entree ? '+' : '−'} {liters(m.volume_l)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
