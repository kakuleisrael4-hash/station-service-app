import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Fuel, Droplets, Plus, Trash2, Banknote, DollarSign, AlertTriangle, CheckCircle2,
  Save, Calculator, Star as StarIcon, MessageSquare, Loader2, GaugeCircle,
} from 'lucide-react';
import { Card, SectionTitle, StarRating, FloatingAlert } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { computeReport, validateDraft, starsFromScore } from '@/lib/calc';
import { lastClosingIndexByPump } from '@/lib/selectors';
import { BILLETS_FC, PUMPS } from '@/constants';
import { fc, usd, liters, todayISO } from '@/lib/format';
import type { Currency, Expense, ReportDraft } from '@/types';

const toNum = (v: string) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

interface FormState {
  pompiste_id: string;
  report_date: string;
  pumps: Record<string, { close: string }>;
  manquant: string;
  taux_journalier: string;
  total_usd: string;
  billetage: Record<string, string>;
  expenses: Expense[];
  admin_comment: string;
}

const blankPumps = () => Object.fromEntries(PUMPS.map((p) => [p.id, { close: '' }]));
const blank: FormState = {
  pompiste_id: '', report_date: todayISO(), pumps: blankPumps(),
  manquant: '', taux_journalier: '2850', total_usd: '', billetage: {}, expenses: [], admin_comment: '',
};

export default function NewReportForm() {
  const { user } = useAuth();
  const { pompistes, expenseCategories, pumps, cisterns, settings, reports, createReport } = useData();
  const [f, setF] = useState<FormState>(() => ({ ...blank, taux_journalier: String(settings.taux_journalier) }));

  // Règle d'or : index d'ouverture = dernière fermeture validée de chaque pompe.
  const openings = useMemo(() => lastClosingIndexByPump(reports), [reports]);
  const [stars, setStars] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const setClose = (id: string, v: string) =>
    setF((p) => ({ ...p, pumps: { ...p.pumps, [id]: { close: v } } }));

  const draft: ReportDraft = useMemo(() => ({
    pompiste_id: f.pompiste_id,
    report_date: f.report_date,
    pumps: pumps.map((p) => ({ pump_id: p.id, index_open: openings[p.id] ?? 0, index_close: toNum(f.pumps[p.id]?.close ?? '') })),
    manquant: toNum(f.manquant),
    taux_journalier: toNum(f.taux_journalier),
    total_usd: toNum(f.total_usd),
    billetage: Object.fromEntries(Object.entries(f.billetage).map(([k, v]) => [k, toNum(v)])),
    expenses: f.expenses,
    final_stars: stars,
    admin_comment: f.admin_comment,
  }), [f, stars, pumps, openings]);

  const calcCtx = useMemo(() => ({ pumps, prices: { super: settings.essence_price, gasoil: settings.gasoil_price } }), [pumps, settings]);
  const c = useMemo(() => computeReport(draft, calcCtx), [draft, calcCtx]);
  const errors = useMemo(() => validateDraft(draft, c), [draft, c]);
  const touched = c.total_encaisse > 0 || draft.manquant > 0 || c.total_a_remettre > 0;
  const canSave = errors.length === 0 && c.is_balanced && !!f.pompiste_id;
  const suggestedStars = starsFromScore(c.auto_score);

  function addExpense() {
    set('expenses', [...f.expenses, { id: crypto.randomUUID?.() ?? String(Math.random()), category_id: expenseCategories[0]?.id ?? null, description: '', amount: 0, currency: 'FC', amount_fc: 0, date: f.report_date }]);
  }
  const updateExpense = (id: string, patch: Partial<Expense>) => set('expenses', f.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExpense = (id: string) => set('expenses', f.expenses.filter((e) => e.id !== id));

  async function submit() {
    if (!canSave || !user) return;
    setBusy(true);
    try {
      await createReport({ ...draft, final_stars: stars ?? suggestedStars }, user);
      setDone(true);
      setTimeout(() => { setF(blank); setStars(null); setDone(false); }, 1800);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* ===================== SAISIE ===================== */}
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <SectionTitle icon={<Calculator className="h-5 w-5" />} title="Nouveau Rapport" subtitle="Saisie par pompe — calculs temps réel & décrément automatique des citernes" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Pompiste *</label>
              <select className="field" value={f.pompiste_id} onChange={(e) => set('pompiste_id', e.target.value)}>
                <option value="">— Sélectionner —</option>
                {pompistes.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date du rapport</label>
              <input type="date" className="field" value={f.report_date} onChange={(e) => set('report_date', e.target.value)} />
            </div>
          </div>
        </Card>

        {/* 4 pompes */}
        <div className="grid gap-4 sm:grid-cols-2">
          {pumps.map((pump) => {
            const reading = c.pumps.find((x) => x.pump_id === pump.id)!;
            const isGas = pump.fuel === 'gasoil';
            const open = openings[pump.id] ?? 0;
            const close = f.pumps[pump.id]?.close ?? '';
            const invalid = close !== '' && toNum(close) <= open;
            const cisternName = cisterns.find((cc) => cc.id === pump.cistern_id)?.name ?? pump.cistern_id;
            return (
              <Card key={pump.id}>
                <div className="mb-3 flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${isGas ? 'bg-fuel-500/15 text-fuel-400' : 'bg-energy-500/15 text-energy-400'}`}>
                    {isGas ? <Fuel className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold leading-tight">{pump.label}</h3>
                    <p className="text-xs text-slate-400">{reading.unit_price.toLocaleString('fr-FR')} FC/L · {cisternName}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-slate-500">Litrage</p>
                    <p className="font-bold tabular-nums">{liters(reading.litrage)}</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label">Index ouv. (auto)</label>
                    <input type="number" className="field !py-2 cursor-not-allowed bg-night-950/60 text-slate-400" value={open} disabled readOnly title="Repris automatiquement du dernier rapport validé de cette pompe" />
                  </div>
                  <div>
                    <label className="label">Index ferm.</label>
                    <input type="number" className={`field !py-2 ${invalid ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''}`} placeholder="0" value={close} onChange={(e) => setClose(pump.id, e.target.value)} />
                    {invalid && <p className="mt-1 text-xs text-rose-400">Doit être &gt; {open.toLocaleString('fr-FR')}.</p>}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm ring-1 ring-white/10">
                  <span className="text-slate-400">Montant</span>
                  <span className="font-semibold tabular-nums text-energy-300">{fc(reading.montant)}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Dépenses catégorisées */}
        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Dépenses" subtitle="Catégorie obligatoire" right={<button onClick={addExpense} className="btn-ghost !py-1.5 !px-3"><Plus className="h-4 w-4" /> Ajouter</button>} />
          {f.expenses.length === 0 && <p className="text-sm text-slate-500">Aucune dépense.</p>}
          <div className="space-y-2">
            {f.expenses.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2">
                <select className="field w-36" value={e.category_id ?? ''} onChange={(ev) => updateExpense(e.id, { category_id: ev.target.value || null })}>
                  <option value="">Catégorie…</option>
                  {expenseCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <input className="field flex-1 min-w-[7rem]" placeholder="Description" value={e.description} onChange={(ev) => updateExpense(e.id, { description: ev.target.value })} />
                <select className="field w-20" value={e.currency} onChange={(ev) => updateExpense(e.id, { currency: ev.target.value as Currency })}>
                  <option value="FC">FC</option><option value="USD">USD</option>
                </select>
                <input className="field w-28" type="number" placeholder={e.currency === 'USD' ? 'Montant $' : 'Montant FC'} value={e.amount || ''} onChange={(ev) => updateExpense(e.id, { amount: toNum(ev.target.value) })} />
                {e.currency === 'USD' && <span className="text-xs font-semibold tabular-nums text-energy-300">≈ {fc(e.amount * toNum(f.taux_journalier))}</span>}
                <button onClick={() => removeExpense(e.id)} className="btn-ghost !px-2.5 text-rose-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-slate-400">Total dépenses</span><span className="font-bold tabular-nums">{fc(c.total_depenses)}</span>
          </div>
        </Card>

        {/* Manquant */}
        <Card className="border-rose-500/30">
          <SectionTitle icon={<AlertTriangle className="h-5 w-5" />} title="Manquant" subtitle="Montant non justifié (impacte la RH)" />
          <input type="number" className="field border-rose-500/50 bg-rose-500/5 text-lg font-bold text-rose-300 focus:border-rose-400" placeholder="0 FC" value={f.manquant} onChange={(e) => set('manquant', e.target.value)} />
        </Card>

        {/* Billetage */}
        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Grille de billetage" subtitle="Comptage physique de la caisse (X)" />
          <div className="grid gap-2 sm:grid-cols-2">
            {BILLETS_FC.map((coupure) => {
              const qty = toNum(f.billetage[String(coupure)] ?? '');
              return (
                <div key={coupure} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-slate-300">{coupure.toLocaleString('fr-FR')}</span>
                  <span className="text-slate-500">×</span>
                  <input type="number" min={0} className="field !py-1.5 w-20" placeholder="0" value={f.billetage[String(coupure)] ?? ''} onChange={(e) => set('billetage', { ...f.billetage, [String(coupure)]: e.target.value })} />
                  <span className="ml-auto text-sm font-semibold tabular-nums text-slate-400">{fc(qty * coupure)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 sm:grid-cols-3">
            <div><label className="label flex items-center gap-1"><DollarSign className="h-3 w-3" /> Total USD</label><input type="number" className="field !py-1.5" placeholder="0.00" value={f.total_usd} onChange={(e) => set('total_usd', e.target.value)} /></div>
            <div><label className="label">Taux du jour</label><input type="number" className="field !py-1.5" placeholder="2850" value={f.taux_journalier} onChange={(e) => set('taux_journalier', e.target.value)} /></div>
            <div><label className="label">≈ Converti</label><div className="field !py-1.5 tabular-nums text-energy-300">{fc(c.total_usd_fc)}</div></div>
          </div>
        </Card>
      </div>

      {/* ===================== RÉSULTATS ===================== */}
      <div className="space-y-5">
        <div className="sticky top-20 space-y-5">
          <Card>
            <SectionTitle icon={<GaugeCircle className="h-5 w-5" />} title="Caisse en direct" />
            <dl className="space-y-2 text-sm">
              <Line label="Total Super (P2-P4)" value={fc(c.essence_montant)} sub={liters(c.essence_litrage)} />
              <Line label="Total Gasoil (P1)" value={fc(c.gasoil_montant)} sub={liters(c.gasoil_litrage)} />
              <Line label="− Dépenses" value={fc(c.total_depenses)} />
              <Line label="− Manquant" value={fc(draft.manquant)} danger />
              <div className="my-2 border-t border-white/10" />
              <div className="flex items-end justify-between">
                <span className="text-slate-300">TOTAL À REMETTRE <span className="text-xs text-slate-500">(Y)</span></span>
                <span className="text-2xl font-black tabular-nums text-energy-400">{fc(c.total_a_remettre)}</span>
              </div>
            </dl>
          </Card>

          <Card className={touched ? (c.is_balanced ? 'ring-1 ring-energy-400/50' : 'ring-1 ring-rose-500/50') : ''}>
            <div className="space-y-2 text-sm">
              <Line label="Billetage physique (X)" value={fc(c.total_encaisse)} />
              <Line label="À remettre (Y)" value={fc(c.total_a_remettre)} />
              <div className="my-1 border-t border-white/10" />
              <div className="flex items-center justify-between"><span className="text-slate-400">Écart (X − Y)</span><span className={`font-bold tabular-nums ${c.is_balanced ? 'text-energy-400' : 'text-rose-400'}`}>{fc(c.ecart)}</span></div>
              <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${c.is_balanced ? 'bg-energy-500/15 text-energy-300' : 'bg-rose-500/15 text-rose-300'}`}>
                {c.is_balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {c.is_balanced ? 'Caisse équilibrée (X = Y)' : 'Caisse déséquilibrée'}
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={<StarIcon className="h-5 w-5" />} title="Notation" />
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
              <span className="text-sm text-slate-400">Note automatique</span>
              <span className={`text-xl font-black tabular-nums ${c.auto_score >= 9 ? 'text-energy-400' : c.auto_score >= 7 ? 'text-fuel-400' : 'text-rose-400'}`}>{c.auto_score}/10</span>
            </div>
            <div className="mt-3"><label className="label">Note finale de l'admin</label><StarRating value={stars ?? suggestedStars} onChange={setStars} /></div>
            <div className="mt-3"><label className="label flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Suggestions</label><textarea className="field h-20 resize-none" placeholder="Conseils au pompiste…" value={f.admin_comment} onChange={(e) => set('admin_comment', e.target.value)} /></div>
          </Card>

          {errors.length > 0 && (
            <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">
              <p className="mb-1 font-semibold">À corriger :</p>
              <ul className="list-inside list-disc space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          <motion.button whileTap={{ scale: canSave ? 0.97 : 1 }} onClick={submit} disabled={!canSave || busy}
            className={`btn w-full !py-3 text-base font-bold ${canSave ? 'bg-energy-500 text-night-950 hover:bg-energy-400 shadow-glow' : 'cursor-not-allowed bg-white/5 text-slate-500'}`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : done ? <CheckCircle2 className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {done ? 'Rapport enregistré !' : 'ENREGISTRER LE RAPPORT'}
          </motion.button>
        </div>
      </div>

      <FloatingAlert show={touched && !c.is_balanced} kind="error">⚠ Billetage ≠ total à remettre — écart de {fc(Math.abs(c.ecart))}</FloatingAlert>
      <FloatingAlert show={done} kind="success">✓ Rapport validé — citernes, RH, caisse & capital mis à jour</FloatingAlert>
    </div>
  );
}

function Line({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}{sub && <span className="ml-2 text-xs text-slate-600">{sub}</span>}</span>
      <span className={`font-semibold tabular-nums ${danger ? 'text-rose-400' : ''}`}>{value}</span>
    </div>
  );
}
