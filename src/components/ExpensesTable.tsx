import { useMemo, useState } from 'react';
import { Search, Filter, Receipt, Trash2 } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { fc, usd, shortDate, todayISO, currentPeriod } from '@/lib/format';
import type { Currency, Expense, ExpenseCategory } from '@/types';

type PeriodFilter = 'all' | 'today' | 'week' | 'month';

/** Lundi de la semaine courante (ISO yyyy-mm-dd) — base du filtre « Cette semaine ». */
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

interface Props {
  expenses: Expense[];
  categories: ExpenseCategory[];
  title?: string;
  subtitle?: string;
  /** Si fourni (Admin), affiche un bouton de suppression par ligne. */
  onDelete?: (id: string) => Promise<void> | void;
}

/**
 * Journal des dépenses filtrable et cherchable (partagé Admin & Viewer).
 * Colonnes : Date · Description · Catégorie · Source · Montant d'origine · ≈ FC.
 */
export default function ExpensesTable({ expenses, categories, title = 'Journal des dépenses', subtitle = 'Recherche, filtres et conversion FC', onDelete }: Props) {
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState('');
  const [cur, setCur] = useState<'all' | Currency>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const catName = (id: string | null) => catOf(id)?.name ?? 'Sans catégorie';

  const weekStart = useMemo(startOfWeekISO, []);
  const today = todayISO();
  const month = currentPeriod();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...expenses]
      .filter((e) => {
        if (catId && e.category_id !== catId) return false;
        if (cur === 'FC' && !(e.amount > 0)) return false;
        if (cur === 'USD' && !(e.amount_usd > 0)) return false;
        if (period === 'today' && e.date !== today) return false;
        if (period === 'week' && e.date < weekStart) return false;
        if (period === 'month' && !e.date.startsWith(month)) return false;
        if (term && !`${e.description} ${catName(e.category_id)}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => (b.created_at ?? b.date).localeCompare(a.created_at ?? a.date) || b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, categories, q, catId, cur, period, today, month, weekStart]);

  const totalFC = rows.reduce((s, e) => s + e.amount_fc, 0);

  return (
    <Card>
      <SectionTitle icon={<Receipt className="h-5 w-5" />} title={title} subtitle={subtitle} />

      {/* Barre de recherche + filtres */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="field !pl-9" placeholder="Rechercher (motif, catégorie…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="field" value={cur} onChange={(e) => setCur(e.target.value as 'all' | Currency)}>
          <option value="all">Toutes devises</option>
          <option value="FC">FC (Franc)</option>
          <option value="USD">USD (Dollar)</option>
        </select>
        <select className="field" value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
          <option value="all">Toute la période</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois-ci</option>
        </select>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" /> {rows.length} dépense{rows.length > 1 ? 's' : ''}</span>
        <span>Total filtré : <span className="font-bold tabular-nums text-rose-400">{fc(totalFC)}</span></span>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Aucune dépense ne correspond à ces critères.</EmptyState>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-night-950/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pr-2">Catégorie</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2 pr-2 text-right">Part FC</th>
                <th className="py-2 pr-2 text-right">Part USD</th>
                <th className="py-2 pr-2 text-right">Total FC</th>
                {onDelete && <th className="py-2 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((e) => {
                const c = catOf(e.category_id);
                return (
                  <tr key={e.id}>
                    <td className="py-2 pr-2 whitespace-nowrap text-slate-400">{shortDate(e.date)}</td>
                    <td className="py-2 pr-2 text-slate-200">{e.description || '—'}</td>
                    <td className="py-2 pr-2">
                      <span className="chip" style={{ background: `${c?.color ?? '#64748b'}22`, color: c?.color ?? '#94a3b8' }}>{c?.name ?? 'Sans catégorie'}</span>
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{e.report_id ? 'Rapport' : 'Hors-rapport'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-slate-300">{e.amount > 0 ? fc(e.amount) : '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-fuel-300">{e.amount_usd > 0 ? usd(e.amount_usd) : '—'}</td>
                    <td className="py-2 pr-2 text-right font-semibold tabular-nums text-rose-400">− {fc(e.amount_fc)}</td>
                    {onDelete && (
                      <td className="py-2 text-right">
                        <button onClick={() => onDelete(e.id)} className="text-slate-500 hover:text-rose-400" title="Supprimer la dépense"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
