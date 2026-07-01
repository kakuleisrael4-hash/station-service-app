import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Fuel, Droplets, Plus, Trash2, Banknote, DollarSign, AlertTriangle, CheckCircle2,
  Save, Calculator, Star as StarIcon, MessageSquare, Loader2, GaugeCircle, ShieldCheck, UserMinus,
} from 'lucide-react';
import { Card, SectionTitle, StarRating, FloatingAlert } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { computeReport, validateDraft } from '@/lib/calc';
import { lastClosingIndexByPump } from '@/lib/selectors';
import { BILLETS_FC, BALANCE_TOLERANCE, PUMPS } from '@/constants';
import { fc, usd, liters, todayISO } from '@/lib/format';
import type { EcartDecision, Expense, ReportDraft } from '@/types';

const toNum = (v: string) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

interface FormState {
  pompiste_id: string;
  report_date: string;
  pumps: Record<string, { open: string; close: string }>;
  manquant: string;
  taux_journalier: string;
  total_usd: string;
  billetage: Record<string, string>;
  expenses: Expense[];
  admin_comment: string;
}

const blankPumps = () => Object.fromEntries(PUMPS.map((p) => [p.id, { open: '', close: '' }]));
const blank: FormState = {
  pompiste_id: '', report_date: todayISO(), pumps: blankPumps(),
  manquant: '', taux_journalier: '2850', total_usd: '', billetage: {}, expenses: [], admin_comment: '',
};

export default function NewReportForm() {
  const { user } = useAuth();
  const { pompistes, expenseCategories, pumps, cisterns, settings, reports, createReport } = useData();
  const [f, setF] = useState<FormState>(() => ({ ...blank, taux_journalier: String(settings.taux_journalier) }));

  // Suggestion : index d'ouverture = dernière fermeture de chaque pompe (modifiable).
  const openings = useMemo(() => lastClosingIndexByPump(reports), [reports]);
  const [stars, setStars] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const setPump = (id: string, side: 'open' | 'close', v: string) =>
    setF((p) => ({ ...p, pumps: { ...p.pumps, [id]: { ...(p.pumps[id] ?? { open: '', close: '' }), [side]: v } } }));

  // Pré-remplit l'ouverture avec la dernière fermeture (suggestion) tant que le
  // champ est vide — mais il reste entièrement modifiable par l'Admin.
  useEffect(() => {
    setF((p) => {
      let changed = false;
      const np = { ...p.pumps };
      pumps.forEach((pm) => {
        const cur = np[pm.id] ?? { open: '', close: '' };
        if (!cur.open && openings[pm.id] != null) { np[pm.id] = { ...cur, open: String(openings[pm.id]) }; changed = true; }
      });
      return changed ? { ...p, pumps: np } : p;
    });
  }, [openings, pumps]);

  const draft: ReportDraft = useMemo(() => ({
    pompiste_id: f.pompiste_id,
    report_date: f.report_date,
    // Fermeture vide = pompe non utilisée ce shift : on aligne fermeture sur
    // ouverture (litrage 0) pour ne pas déclencher de fausse erreur de saisie.
    pumps: pumps.map((p) => {
      const openS = f.pumps[p.id]?.open ?? '';
      const closeS = f.pumps[p.id]?.close ?? '';
      return { pump_id: p.id, index_open: toNum(openS), index_close: closeS === '' ? toNum(openS) : toNum(closeS) };
    }),
    manquant: toNum(f.manquant),
    taux_journalier: toNum(f.taux_journalier),
    total_usd: toNum(f.total_usd),
    billetage: Object.fromEntries(Object.entries(f.billetage).map(([k, v]) => [k, toNum(v)])),
    expenses: f.expenses,
    final_stars: stars,
    admin_comment: f.admin_comment,
  }), [f, stars, pumps]);

  const calcCtx = useMemo(() => ({
    pumps,
    prices: { super: settings.essence_price, gasoil: settings.gasoil_price },
    buyPrices: { super: settings.essence_buy_price, gasoil: settings.gasoil_buy_price },
  }), [pumps, settings]);
  const c = useMemo(() => computeReport(draft, calcCtx), [draft, calcCtx]);
  const errors = useMemo(() => validateDraft(draft, c), [draft, c]);
  const touched = c.total_encaisse > 0 || draft.manquant > 0 || c.total_a_remettre > 0;
  // L'écart ne bloque plus : seuls les autres contrôles (pompiste, catégories, taux…) bloquent.
  const canSave = errors.length === 0 && !!f.pompiste_id;
  // Déficit = Y − X (positif = manque). Surplus = X − Y (= c.ecart, positif).
  const shortfall = c.total_a_remettre - c.total_encaisse;
  const isDeficit = shortfall > BALANCE_TOLERANCE;
  const isSurplus = c.ecart > BALANCE_TOLERANCE;

  function addExpense() {
    set('expenses', [...f.expenses, { id: crypto.randomUUID?.() ?? String(Math.random()), category_id: expenseCategories[0]?.id ?? null, description: '', amount: 0, amount_usd: 0, currency: 'FC', amount_fc: 0, date: f.report_date }]);
  }
  const updateExpense = (id: string, patch: Partial<Expense>) => set('expenses', f.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExpense = (id: string) => set('expenses', f.expenses.filter((e) => e.id !== id));

  async function doSave(d: ReportDraft, decision: EcartDecision) {
    if (!user) return;
    setBusy(true);
    try {
      // montant_ecart = écart constaté X − Y au moment de la décision (c.ecart,
      // avant tout report sur le manquant). decision = traitement choisi.
      await createReport({ ...d, final_stars: stars, montant_ecart: c.ecart, decision_imputation: decision }, user);
      setDone(true);
      setTimeout(() => { setF(blank); setStars(null); setDone(false); }, 1800);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally { setBusy(false); }
  }

  function submit() {
    if (!canSave || !user) return;
    // DÉFICIT (X < Y) → choix obligatoire (Tolérer / Déduire). Sinon (équilibré
    // ou SURPLUS X ≥ Y) → enregistrement direct, sans pénalité ('aucun').
    if (isDeficit) { setConfirmOpen(true); return; }
    void doSave(draft, 'aucun');
  }

  // Tolérer : écart consigné en perte sèche, pompiste NON pénalisé (manquant inchangé).
  // Déduire : le déficit (Y − X) est ajouté au manquant → imputé au salaire et
  //           rééquilibre le rapport (Y' = X).
  function decide(decision: EcartDecision) {
    setConfirmOpen(false);
    if (decision === 'debit_salaire') void doSave({ ...draft, manquant: draft.manquant + shortfall }, 'debit_salaire');
    else void doSave(draft, 'tolere');
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
              <label className="label">Date du rapport * <span className="font-normal text-slate-500">(saisie manuelle — saisie décalée possible)</span></label>
              <input type="date" className="field" value={f.report_date} max={todayISO()} onChange={(e) => set('report_date', e.target.value)} required />
            </div>
          </div>
        </Card>

        {/* 4 pompes */}
        <div className="grid gap-4 sm:grid-cols-2">
          {pumps.map((pump) => {
            const reading = c.pumps.find((x) => x.pump_id === pump.id)!;
            const isGas = pump.fuel === 'gasoil';
            const open = f.pumps[pump.id]?.open ?? '';
            const close = f.pumps[pump.id]?.close ?? '';
            const invalid = close !== '' && toNum(close) < toNum(open);
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
                    <label className="label">Index ouv. <span className="text-slate-500">(modifiable)</span></label>
                    <input type="number" className="field !py-2" placeholder="0" value={open} onChange={(e) => setPump(pump.id, 'open', e.target.value)} title="Suggéré depuis la dernière fermeture — librement modifiable" />
                  </div>
                  <div>
                    <label className="label">Index ferm.</label>
                    <input type="number" className={`field !py-2 ${invalid ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''}`} placeholder="0" value={close} onChange={(e) => setPump(pump.id, 'close', e.target.value)} />
                    {invalid && <p className="mt-1 text-xs text-rose-400">Ne peut pas être &lt; {toNum(open).toLocaleString('fr-FR')}.</p>}
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
                <input className="field w-24" type="number" placeholder="FC" title="Part en FC" value={e.amount || ''} onChange={(ev) => updateExpense(e.id, { amount: toNum(ev.target.value) })} />
                <input className="field w-24" type="number" placeholder="USD" title="Part en USD" value={e.amount_usd || ''} onChange={(ev) => updateExpense(e.id, { amount_usd: toNum(ev.target.value) })} />
                <span className="text-xs font-semibold tabular-nums text-energy-300 whitespace-nowrap">= {fc((e.amount || 0) + (e.amount_usd || 0) * toNum(f.taux_journalier))}</span>
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
              <div className="mt-1 flex items-center justify-between rounded-lg bg-energy-500/10 px-3 py-1.5">
                <span className="text-xs text-energy-300">Bénéfice généré (marge)</span>
                <span className="font-bold tabular-nums text-energy-300">{fc(c.benefice)}</span>
              </div>
            </dl>
          </Card>

          <Card className={touched ? (isDeficit ? 'ring-1 ring-rose-500/50' : isSurplus ? 'ring-1 ring-fuel-400/50' : 'ring-1 ring-energy-400/50') : ''}>
            <div className="space-y-2 text-sm">
              <Line label="Billetage physique (X)" value={fc(c.total_encaisse)} />
              <Line label="À remettre (Y)" value={fc(c.total_a_remettre)} />
              <div className="my-1 border-t border-white/10" />
              <div className="flex items-center justify-between"><span className="text-slate-400">Écart (X − Y)</span><span className={`font-bold tabular-nums ${isDeficit ? 'text-rose-400' : isSurplus ? 'text-fuel-400' : 'text-energy-400'}`}>{fc(c.ecart)}</span></div>
              <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isDeficit ? 'bg-rose-500/15 text-rose-300' : isSurplus ? 'bg-fuel-500/15 text-fuel-300' : 'bg-energy-500/15 text-energy-300'}`}>
                {isDeficit ? <AlertTriangle className="h-4 w-4" /> : isSurplus ? <DollarSign className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {isDeficit ? `Déficit de caisse — il manque ${fc(Math.abs(shortfall))}` : isSurplus ? `Surplus de caisse — +${fc(c.ecart)} (reste en caisse)` : 'Caisse équilibrée (X = Y)'}
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={<StarIcon className="h-5 w-5" />} title="Évaluation du pompiste" subtitle="Note 100 % à la discrétion de l'admin" />
            <div><label className="label">Note (1 à 5 étoiles)</label><StarRating value={stars ?? 0} onChange={setStars} /></div>
            <div className="mt-3"><label className="label flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Suggestions / remarques</label><textarea className="field h-20 resize-none" placeholder="Conseils et remarques au pompiste…" value={f.admin_comment} onChange={(e) => set('admin_comment', e.target.value)} /></div>
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

      <FloatingAlert show={touched && isDeficit} kind="error">⚠ Déficit de caisse — il manque {fc(Math.abs(shortfall))} (décision requise à la validation)</FloatingAlert>
      <FloatingAlert show={done} kind="success">✓ Rapport enregistré — à clôturer dans « Clôture journalière » pour l'intégrer au capital</FloatingAlert>

      {/* POP-UP DE DÉCISION : déficit de caisse (X < Y) — choix obligatoire */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-night-900 p-6 shadow-2xl ring-1 ring-rose-500/20">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-400"><AlertTriangle className="h-6 w-6" /></div>
              <h3 className="text-lg font-black text-rose-200">Déficit de caisse détecté</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Il manque <span className="font-bold tabular-nums text-rose-300">{fc(Math.abs(shortfall))}</span> dans la caisse physique (X)
              par rapport au total à remettre (Y). Choisissez le traitement de cet écart :
            </p>
            <div className="mt-4 space-y-3">
              <button onClick={() => decide('tolere')} disabled={busy}
                className="group w-full rounded-xl border border-energy-500/30 bg-energy-500/[0.07] p-4 text-left transition hover:bg-energy-500/15">
                <div className="flex items-center gap-2 font-bold text-energy-300"><ShieldCheck className="h-5 w-5" /> 🟢 Tolérer l'écart</div>
                <p className="mt-1 text-xs text-slate-400">Erreur excusable. L'écart est consigné comme <span className="font-semibold text-slate-300">perte sèche d'exploitation</span> — le pompiste n'est <span className="font-semibold">pas</span> pénalisé (manquant et salaire inchangés, note 10/10).</p>
              </button>
              <button onClick={() => decide('debit_salaire')} disabled={busy}
                className="group w-full rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4 text-left transition hover:bg-rose-500/15">
                <div className="flex items-center gap-2 font-bold text-rose-300"><UserMinus className="h-5 w-5" /> 🔴 Déduire sur le salaire</div>
                <p className="mt-1 text-xs text-slate-400">L'écart devient un <span className="font-semibold text-slate-300">manquant officiel</span> : ajouté au cumul du mois et déduit du salaire net. Manquant total du rapport : <span className="font-bold tabular-nums text-rose-300">{fc(draft.manquant + shortfall)}</span>.</p>
              </button>
            </div>
            <div className="mt-5 flex">
              <button onClick={() => setConfirmOpen(false)} className="btn ml-auto bg-white/5 text-slate-200 hover:bg-white/10">Annuler</button>
            </div>
          </motion.div>
        </div>
      )}
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
