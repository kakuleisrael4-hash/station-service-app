import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Filter, Receipt, Trash2, ChevronDown, LayoutList, Rows3 } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { fc, usd, shortDate, todayISO, currentPeriod } from '@/lib/format';
import type { Currency, Expense, ExpenseCategory } from '@/types';

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type OriginFilter = 'all' | 'rapport' | 'hors';
type ViewMode = 'synthese' | 'liste';

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
  /** Si fourni (Admin), affiche un bouton de suppression par ligne (hors-rapport uniquement). */
  onDelete?: (id: string) => Promise<void> | void;
}

/**
 * Journal des dépenses (Admin & Viewer).
 * Vue SYNTHÈSE (défaut) : totaux par catégorie (FC | USD | consolidé), accordéon
 * « click-to-expand » pour dérouler le détail. Vue LISTE : tableau chronologique.
 * Filtres : recherche · origine (rapport / hors-rapport) · catégorie · devise · période.
 */
export default function ExpensesTable({ expenses, categories, title = 'Journal des dépenses', subtitle = 'Synthèse par catégorie — cliquez pour dérouler le détail', onDelete }: Props) {
  const [view, setView] = useState<ViewMode>('synthese');
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState('');
  const [cur, setCur] = useState<'all' | Currency>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [origin, setOrigin] = useState<OriginFilter>('all');
  const [openCat, setOpenCat] = useState<string | null>(null);

  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const catName = (id: string | null) => catOf(id)?.name ?? 'Sans catégorie';

  const weekStart = useMemo(startOfWeekISO, []);
  const today = todayISO();
  const month = currentPeriod();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...expenses]
      .filter((e) => {
        if (origin === 'rapport' && !e.report_id) return false;
        if (origin === 'hors' && e.report_id) return false;
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
  }, [expenses, categories, q, catId, cur, period, origin, today, month, weekStart]);

  const totalFC = rows.reduce((s, e) => s + e.amount_fc, 0);

  // Synthèse : agrégats par catégorie (les filtres actifs s'appliquent).
  const byCategory = useMemo(() => {
    const map = new Map<string, { key: string; cat: ExpenseCategory | undefined; items: Expense[]; fcPart: number; usdPart: number; total: number }>();
    rows.forEach((e) => {
      const key = e.category_id ?? '__none__';
      let g = map.get(key);
      if (!g) { g = { key, cat: catOf(e.category_id), items: [], fcPart: 0, usdPart: 0, total: 0 }; map.set(key, g); }
      g.items.push(e);
      g.fcPart += e.amount || 0;
      g.usdPart += e.amount_usd || 0;
      g.total += e.amount_fc || 0;
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categories]);

  const DetailRow = ({ e }: { e: Expense }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.02] px-3 py-2 text-sm ring-1 ring-white/5">
      <span className="w-16 shrink-0 text-slate-400">{shortDate(e.date)}</span>
      <span className="min-w-0 flex-1 truncate text-slate-200" title={e.description}>{e.description || '—'}</span>
      <span className={`chip text-[10px] ${e.report_id ? 'bg-energy-500/10 text-energy-300' : 'bg-sky-500/10 text-sky-300'}`}>{e.report_id ? 'Rapport' : 'Hors-rapport'}</span>
      <span className="w-24 text-right tabular-nums text-slate-300">{e.amount > 0 ? fc(e.amount) : '—'}</span>
      <span className="w-20 text-right tabular-nums text-fuel-300">{e.amount_usd > 0 ? usd(e.amount_usd) : '—'}</span>
      <span className="w-24 text-right font-semibold tabular-nums text-rose-400">− {fc(e.amount_fc)}</span>
      {onDelete && (
        e.report_id ? (
          <span className="cursor-not-allowed text-slate-700" title="Dépense liée à un rapport — supprimez le rapport pour l'annuler (Historique)."><Trash2 className="h-4 w-4" /></span>
        ) : (
          <button onClick={() => onDelete(e.id)} className="text-slate-500 hover:text-rose-400" title="Supprimer la dépense"><Trash2 className="h-4 w-4" /></button>
        )
      )}
    </div>
  );

  return (
    <Card>
      <SectionTitle
        icon={<Receipt className="h-5 w-5" />}
        title={title}
        subtitle={subtitle}
        right={
          <div className="flex rounded-xl bg-white/5 p-0.5">
            <button onClick={() => setView('synthese')} className={`btn !py-1.5 !px-3 text-xs ${view === 'synthese' ? 'bg-energy-500 text-night-950' : 'text-slate-300'}`}><Rows3 className="h-3.5 w-3.5" /> Synthèse</button>
            <button onClick={() => setView('liste')} className={`btn !py-1.5 !px-3 text-xs ${view === 'liste' ? 'bg-energy-500 text-night-950' : 'text-slate-300'}`}><LayoutList className="h-3.5 w-3.5" /> Liste</button>
          </div>
        }
      />

      {/* Barre de recherche + filtres */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="field !pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field" value={origin} onChange={(e) => setOrigin(e.target.value as OriginFilter)}>
          <option value="all">Toutes origines</option>
          <option value="rapport">Dépenses de rapports</option>
          <option value="hors">Dépenses hors rapports</option>
        </select>
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
      ) : view === 'synthese' ? (
        /* ======= VUE SYNTHÈSE : accordéons par catégorie ======= */
        <div className="space-y-2">
          {byCategory.map((g) => {
            const open = openCat === g.key;
            const color = g.cat?.color ?? '#64748b';
            return (
              <div key={g.key} className="overflow-hidden rounded-xl ring-1 ring-white/10">
                <button onClick={() => setOpenCat(open ? null : g.key)}
                  className="flex w-full items-center gap-3 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold" style={{ color }}>{g.cat?.name ?? 'Sans catégorie'}</span>
                  <span className="hidden text-xs text-slate-500 sm:inline">{g.items.length} dépense{g.items.length > 1 ? 's' : ''}</span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums text-rose-400">{fc(g.total)}</span>
                    <span className="block text-[11px] tabular-nums text-slate-500">{fc(g.fcPart)}{g.usdPart > 0 ? ` | ${usd(g.usdPart)}` : ''}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                      <div className="space-y-1.5 border-t border-white/5 bg-night-950/40 p-2">
                        {g.items.map((e) => <DetailRow key={e.id} e={e} />)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======= VUE LISTE : tableau chronologique ======= */
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
                        {e.report_id ? (
                          <span className="cursor-not-allowed text-slate-700" title="Dépense liée à un rapport — supprimez le rapport pour l'annuler (Historique)."><Trash2 className="h-4 w-4" /></span>
                        ) : (
                          <button onClick={() => onDelete(e.id)} className="text-slate-500 hover:text-rose-400" title="Supprimer la dépense"><Trash2 className="h-4 w-4" /></button>
                        )}
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
