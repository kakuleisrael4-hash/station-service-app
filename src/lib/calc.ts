// =====================================================================
//  Moteur de calcul TEMPS RÉEL — source de vérité côté client.
//  Calcule par POMPE (4) puis agrège par carburant (Super / Gasoil).
//  Réplique des triggers SQL (public.reports_recompute).
// =====================================================================
import type { Billetage, ComputedReport, Expense, FuelType, Pump, PumpReading, ReportDraft } from '@/types';
import { BALANCE_TOLERANCE, BILLETS_FC, PRICE_BY_FUEL, PUMPS, autoScoreFromManquant, pumpById } from '@/constants';

/** Contexte de calcul : config pompes + prix courants (défaut = constantes). */
export interface CalcContext {
  pumps?: Pump[];
  prices?: Record<FuelType, number>;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Litrage = Fermeture - Ouverture (jamais négatif). */
export function litrage(open: number, close: number): number {
  return Math.max(num(close) - num(open), 0);
}

export function sumBilletageFC(b: Billetage): number {
  return BILLETS_FC.reduce((acc, coupure) => acc + coupure * num(b[String(coupure)]), 0);
}

/** Montant d'une dépense converti en FC selon sa devise. */
export function expenseFC(e: Expense, taux: number): number {
  return e.currency === 'USD' ? num(e.amount) * num(taux) : num(e.amount);
}

export function sumExpensesFC(expenses: Expense[], taux: number): number {
  return expenses.reduce((acc, e) => acc + expenseFC(e, taux), 0);
}

/** Construit les relevés de pompe (litrage + montant par pompe). */
export function buildPumpReadings(draft: ReportDraft, ctx: CalcContext = {}): PumpReading[] {
  const pumpsCfg = ctx.pumps ?? PUMPS;
  const prices = ctx.prices ?? PRICE_BY_FUEL;
  const find = (id: string) => pumpsCfg.find((p) => p.id === id) ?? pumpById(id);
  return draft.pumps.map((pd) => {
    const pump = find(pd.pump_id);
    const fuel = pump?.fuel ?? 'super';
    const unit_price = prices[fuel];
    const l = litrage(pd.index_open, pd.index_close);
    return {
      pump_id: pd.pump_id,
      fuel,
      cistern_id: pump?.cistern_id ?? '',
      index_open: num(pd.index_open),
      index_close: num(pd.index_close),
      litrage: l,
      unit_price,
      montant: l * unit_price,
    };
  });
}

export function computeReport(d: ReportDraft, ctx: CalcContext = {}): ComputedReport {
  const pumps = buildPumpReadings(d, ctx);

  const essence_litrage = pumps.filter((p) => p.fuel === 'super').reduce((s, p) => s + p.litrage, 0);
  const gasoil_litrage = pumps.filter((p) => p.fuel === 'gasoil').reduce((s, p) => s + p.litrage, 0);
  const essence_montant = pumps.filter((p) => p.fuel === 'super').reduce((s, p) => s + p.montant, 0);
  const gasoil_montant = pumps.filter((p) => p.fuel === 'gasoil').reduce((s, p) => s + p.montant, 0);

  const total_depenses = sumExpensesFC(d.expenses, d.taux_journalier);
  const manquant = num(d.manquant);

  const total_a_remettre = essence_montant + gasoil_montant - total_depenses - manquant;

  const total_billetage_fc = sumBilletageFC(d.billetage);
  const total_usd_fc = num(d.total_usd) * num(d.taux_journalier);
  const total_encaisse = total_billetage_fc + total_usd_fc;

  const ecart = total_encaisse - total_a_remettre;
  const is_balanced = Math.abs(ecart) <= BALANCE_TOLERANCE;

  return {
    pumps,
    essence_litrage,
    essence_montant,
    gasoil_litrage,
    gasoil_montant,
    total_depenses,
    total_a_remettre,
    total_billetage_fc,
    total_usd_fc,
    total_encaisse,
    ecart,
    is_balanced,
    auto_score: autoScoreFromManquant(manquant),
  };
}

export function validateDraft(d: ReportDraft, c: ComputedReport): string[] {
  const errors: string[] = [];
  if (!d.pompiste_id) errors.push('Sélectionnez un pompiste.');
  c.pumps.forEach((p) => {
    if (p.index_close <= p.index_open) {
      const pump = pumpById(p.pump_id);
      errors.push(`${pump?.label ?? p.pump_id} : l'index de fermeture doit être strictement supérieur à l'ouverture (${p.index_open.toLocaleString('fr-FR')}).`);
    }
  });
  if (d.expenses.some((e) => num(e.amount) > 0 && !e.category_id))
    errors.push('Chaque dépense doit avoir une catégorie.');
  const hasUsdExpense = d.expenses.some((e) => e.currency === 'USD' && num(e.amount) > 0);
  if ((num(d.total_usd) > 0 || hasUsdExpense) && num(d.taux_journalier) <= 0)
    errors.push('Renseignez le taux journalier pour convertir les USD.');
  if (!c.is_balanced)
    errors.push(`Billetage (X) ≠ TOTAL À REMETTRE (Y). Écart : ${c.ecart.toLocaleString('fr-FR')} FC.`);
  return errors;
}

export function starsFromScore(score10: number): number {
  return Math.max(1, Math.min(5, Math.round(score10 / 2)));
}
