import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Receipt, Trash2, ChevronDown, LayoutList, Rows3, FileDown, SlidersHorizontal, X } from 'lucide-react';
import { Card, SectionTitle, EmptyState, Modal } from '@/components/ui';
import { fc, usd, shortDate, todayISO, currentPeriod } from '@/lib/format';
import { exportExpensesPDF } from '@/lib/pdf';
import type { Currency, Expense, ExpenseCategory } from '@/types';

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type OriginFilter = 'all' | 'rapport' | 'hors';
type ViewMode = 'synthese' | 'liste';

const PERIOD_LABEL: Record<PeriodFilter, string> = { all: 'Toute période', today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois-ci' };
const ORIGIN_LABEL: Record<OriginFilter, string> = { all: 'Tous', rapport: 'Rapports', hors: 'Hors-rapport' };
const PAGE = 30;

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
 *  • Vue SYNTHÈSE (défaut) : totaux par catégorie, accordéon pour dérouler le détail.
 *  • Vue DÉPENSES EFFECTUÉES : liste chronologique (cartes compactes sur téléphone, tableau sur grand écran).
 *  • Filtres rangés dans un petit menu « Filtres » (source · devise · période · catégorie) ;
 *    seuls les filtres actifs s'affichent, en puces retirables.
 */
export default function ExpensesTable({ expenses, categories, title = 'Journal des dépenses', subtitle = 'Synthèse par catégorie — touchez une catégorie pour voir le détail', onDelete }: Props) {
  const [view, setView] = useState<ViewMode>('synthese');
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState('');
  const [cur, setCur] = useState<'all' | Currency>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [origin, setOrigin] = useState<OriginFilter>('all');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

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
  const shown = rows.slice(0, limit);

  const exportPdf = () => exportExpensesPDF(rows, categories, {
    period: PERIOD_LABEL[period],
    category: catId ? (catOf(catId)?.name ?? '—') : 'Toutes',
    origin: ORIGIN_LABEL[origin],
  });

  // Filtres actifs -> puces retirables (rien d'affiché tant qu'aucun filtre n'est posé).
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (origin !== 'all') active.push({ key: 'origin', label: ORIGIN_LABEL[origin], clear: () => setOrigin('all') });
  if (cur !== 'all') active.push({ key: 'cur', label: cur, clear: () => setCur('all') });
  if (period !== 'all') active.push({ key: 'period', label: PERIOD_LABEL[period], clear: () => setPeriod('all') });
  if (catId) active.push({ key: 'cat', label: catName(catId), clear: () => setCatId('') });
  const resetFilters = () => { setOrigin('all'); setCur('all'); setPeriod('all'); setCatId(''); };

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

  const DeleteBtn = ({ e }: { e: Expense }) => !onDelete ? null : e.report_id ? (
    <span className="cursor-not-allowed text-slate-700" title="Dépense liée à un rapport — supprimez le rapport pour l'annuler (Historique)."><Trash2 className="h-4 w-4" /></span>
  ) : (
    <button onClick={() => onDelete(e.id)} className="-m-3 p-3 text-slate-500 hover:text-rose-400" title="Supprimer la dépense" aria-label="Supprimer la dépense"><Trash2 className="h-4 w-4" /></button>
  );

  /** Carte compacte : ligne 1 = date · description · montant ; ligne 2 = détails. */
  const ExpenseCard = ({ e, withCategory = false }: { e: Expense; withCategory?: boolean }) => {
    const c = catOf(e.category_id);
    return (
      <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-slate-400">{shortDate(e.date)}</span>
          <span className="min-w-0 flex-1 truncate text-slate-200" title={e.description}>{e.description || '—'}</span>
          <span className="shrink-0 font-bold tabular-nums text-rose-400">− {fc(e.amount_fc)}</span>
          <DeleteBtn e={e} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {withCategory && <span className="chip !px-2 !py-0.5 text-[10px]" style={{ background: `${c?.color ?? '#64748b'}22`, color: c?.color ?? '#94a3b8' }}>{c?.name ?? 'Sans catégorie'}</span>}
          <span className={`chip !px-2 !py-0.5 text-[10px] ${e.report_id ? 'bg-energy-500/10 text-energy-300' : 'bg-sky-500/10 text-sky-300'}`}>{e.report_id ? 'Rapport' : 'Hors-rapport'}</span>
          {e.amount > 0 && <span className="tabular-nums">{fc(e.amount)}</span>}
          {e.amount_usd > 0 && <span className="tabular-nums text-fuel-300">{usd(e.amount_usd)}</span>}
        </div>
      </div>
    );
  };

  const MoreBtn = () => rows.length > limit ? (
    <button onClick={() => setLimit((l) => l + PAGE)} className="btn-ghost mt-3 w-full">Afficher plus ({rows.length - limit} restantes)</button>
  ) : null;

  const Seg = <T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`chip-filter ${value === v ? 'chip-filter-on' : ''}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <Card>
      <SectionTitle icon={<Receipt className="h-5 w-5" />} title={title} subtitle={subtitle} />

      {/* Bascule de vue : pleine largeur, ne déborde jamais */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
        <button onClick={() => setView('synthese')} className={`btn min-w-0 !px-2 text-sm ${view === 'synthese' ? 'bg-energy-500 text-night-950' : 'text-slate-300'}`}><Rows3 className="hidden h-4 w-4 shrink-0 min-[400px]:block" /> <span>Synthèse</span></button>
        <button onClick={() => setView('liste')} className={`btn min-w-0 !px-2 text-sm leading-tight ${view === 'liste' ? 'bg-energy-500 text-night-950' : 'text-slate-300'}`}><LayoutList className="hidden h-4 w-4 shrink-0 min-[400px]:block" /> <span>Dépenses effectuées</span></button>
      </div>

      {/* Recherche + petit menu Filtres (+ export) */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="field !pl-9" placeholder="Rechercher…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </div>
        <button onClick={() => setFiltersOpen(true)} className={`btn-ghost relative shrink-0 !px-3 ${active.length ? '!border-energy-400/50 text-energy-300' : ''}`} aria-label="Filtres">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtres</span>
          {active.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-energy-500 px-1 text-[11px] font-bold text-night-950">{active.length}</span>}
        </button>
        {rows.length > 0 && (
          <button onClick={exportPdf} className="btn-ghost shrink-0 !px-3" title="Exporte exactement les dépenses filtrées" aria-label="Exporter en PDF">
            <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
          </button>
        )}
      </div>

      {active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {active.map((a) => (
            <button key={a.key} onClick={() => { a.clear(); setLimit(PAGE); }} className="chip chip-filter-on bg-energy-500/15 text-energy-300 ring-1 ring-energy-400/40">
              {a.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button onClick={() => { resetFilters(); setLimit(PAGE); }} className="px-1 py-1 text-xs text-slate-400 underline">Tout effacer</button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>{rows.length} dépense{rows.length > 1 ? 's' : ''}</span>
        <span>Total : <span className="text-sm font-bold tabular-nums text-rose-400">{fc(totalFC)}</span></span>
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
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold leading-tight" style={{ color }}>{g.cat?.name ?? 'Sans catégorie'}</span>
                    <span className="block text-[11px] text-slate-500">{g.items.length} dépense{g.items.length > 1 ? 's' : ''}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums text-rose-400">{fc(g.total)}</span>
                    <span className="block text-[11px] tabular-nums text-slate-500">{fc(g.fcPart)}{g.usdPart > 0 ? ` | ${usd(g.usdPart)}` : ''}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                      <div className="space-y-1.5 border-t border-white/5 bg-night-950/40 p-2">
                        {g.items.map((e) => <ExpenseCard key={e.id} e={e} />)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======= DÉPENSES EFFECTUÉES : cartes (téléphone) / tableau (grand écran) ======= */
        <>
          <div className="space-y-2 md:hidden">
            {shown.map((e) => <ExpenseCard key={e.id} e={e} withCategory />)}
          </div>
          <div className="hidden max-h-[28rem] overflow-y-auto md:block">
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
                {shown.map((e) => {
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
                      {onDelete && <td className="py-2 text-right"><DeleteBtn e={e} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MoreBtn />
        </>
      )}

      {/* ======= Petit menu « Filtres » (feuille basse sur téléphone) ======= */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrer les dépenses">
        <div className="space-y-5">
          <div><p className="label">Source</p><Seg value={origin} onChange={(v) => { setOrigin(v); setLimit(PAGE); }} options={[['all', 'Toutes'], ['rapport', 'Rapports'], ['hors', 'Hors-rapport']]} /></div>
          <div><p className="label">Devise</p><Seg value={cur} onChange={(v) => { setCur(v); setLimit(PAGE); }} options={[['all', 'FC + USD'], ['FC', 'FC'], ['USD', 'USD']]} /></div>
          <div><p className="label">Période</p><Seg value={period} onChange={(v) => { setPeriod(v); setLimit(PAGE); }} options={[['all', 'Toute période'], ['today', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois-ci']]} /></div>
          <div>
            <p className="label">Catégorie</p>
            <select className="field" value={catId} onChange={(e) => { setCatId(e.target.value); setLimit(PAGE); }}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { resetFilters(); setLimit(PAGE); }} className="btn-ghost flex-1" disabled={active.length === 0}>Réinitialiser</button>
            <button onClick={() => setFiltersOpen(false)} className="btn-primary flex-[2]">Voir {rows.length} dépense{rows.length > 1 ? 's' : ''}</button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
